import { ChangeEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type { RJSFSchema } from "@rjsf/utils";
import { RosterLockV1Config } from "@roster-lock/types";
import { useAccount } from "../../context/AccountContext";
import { createRoom } from "../../api/titledRoom";
import * as bridge from "../../bridge";
import { TITLED_ROOM_URL } from "../../config";

type InstalledGameLauncher = { id: string, version: string, gameConfigSchema: unknown };

// A schema with no declared properties renders nothing useful in rjsf - mirrors
// match-agent-client's own GameLauncherSettingsForm.hasProperties, which does the
// same thing for localConfigSchema.
function hasProperties(schema: unknown): schema is RJSFSchema {
  return !!schema && typeof schema === "object" && !!(schema as RJSFSchema).properties
    && Object.keys((schema as RJSFSchema).properties!).length > 0;
}

export function CreateRoomPage() {
  const navigate = useNavigate();
  const account = useAccount();

  const [installed, setInstalled] = useState<Array<InstalledGameLauncher>>([]);
  const [installPackage, setInstallPackage] = useState("");
  const [installing, setInstalling] = useState(false);
  const [title, setTitle] = useState("");
  const [gameLauncherPlugin, setGameLauncherPlugin] = useState("");
  const [gameConfig, setGameConfig] = useState<unknown>({});
  const [rosterConfig, setRosterConfig] = useState<RosterLockV1Config | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [minPlayers, setMinPlayers] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshInstalled = () => {
    bridge.getInstalledGameLauncherPlugins()
      .then((plugins) => {
        setInstalled(plugins);
        if (!gameLauncherPlugin && plugins[0]) setGameLauncherPlugin(plugins[0].id);
      })
      .catch((e) => setError(e.message));
  };

  // Before creating a room, confirm this machine actually has a game-launcher
  // plugin installed - the host mediates this (getInstalledGameLauncherPlugins),
  // this app never talks to match-agent directly.
  useEffect(refreshInstalled, []);

  const handleInstall = async () => {
    if (!installPackage) return;
    setInstalling(true);
    setError(null);
    try {
      await bridge.installGameLauncherPlugin(installPackage);
      refreshInstalled();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInstalling(false);
    }
  };

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as RosterLockV1Config;
      if (parsed?.configIdentity?.namespace !== "roster-lock" || parsed?.configIdentity?.purpose !== "lock") {
        throw new Error("This doesn't look like a roster-lock config file.");
      }
      setRosterConfig(parsed);
      setFileName(file.name);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const handleCreate = async () => {
    if (!account.token || !account.identity || !rosterConfig) return;
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom(TITLED_ROOM_URL, account.token, {
        title, gameLauncherPlugin, rosterConfig, gameConfig, maxPlayers, minPlayers,
        machineId: account.identity.machineId,
      });
      // The host is the one that eventually calls match-agent's start route,
      // so it needs to know this room's gameConfig ahead of time - see
      // core/types' matchmaker-bridge docs on updateGameLauncherSettings.
      await bridge.updateGameLauncherSettings(gameLauncherPlugin, gameConfig);
      navigate(`/rooms/${room.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <h1>Create Room</h1>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label>
        Game Launcher
        <select
          value={gameLauncherPlugin}
          onChange={(e) => {
            setGameLauncherPlugin(e.target.value);
            // A previous plugin's gameConfig is unlikely to match the newly
            // selected plugin's schema - start clean rather than carry over
            // fields the new form won't recognize.
            setGameConfig({});
          }}
        >
          {installed.map((r) => <option key={r.id} value={r.id}>{r.id} (v{r.version})</option>)}
        </select>
      </label>
      {installed.length === 0 && <p>No game-launcher plugins installed on this machine yet.</p>}

      <div className="install-plugin-row">
        <input
          placeholder="Package name to install (e.g. @roster-lock/game-launcher-ikemen-go)"
          value={installPackage}
          onChange={(e) => setInstallPackage(e.target.value)}
        />
        <button type="button" disabled={installing || !installPackage} onClick={handleInstall}>
          {installing ? "Installing..." : "Install"}
        </button>
      </div>

      {(() => {
        const gameConfigSchema = installed.find((r) => r.id === gameLauncherPlugin)?.gameConfigSchema;
        if (!hasProperties(gameConfigSchema)) return null;
        // Schema's own title/description (see e.g. ikemen-go's gameConfigSchema)
        // drive rjsf's rendered heading/blurb here - no separate hardcoded
        // label needed on top of them.
        return (
          <div className="game-launcher-settings">
            <Form
              schema={gameConfigSchema}
              formData={gameConfig}
              validator={validator}
              onChange={(e) => setGameConfig(e.formData)}
              uiSchema={{ "ui:submitButtonOptions": { norender: true } }}
            />
          </div>
        );
      })()}

      <label>
        Roster Lock Config (.json)
        <input type="file" accept=".json,application/json" onChange={handleFile} />
      </label>
      {rosterConfig && <p>Loaded {fileName}: {rosterConfig.title} v{rosterConfig.version}</p>}
      <label>
        Min players
        <input type="number" min={2} value={minPlayers} onChange={(e) => setMinPlayers(Number(e.target.value))} />
      </label>
      <label>
        Max players
        <input type="number" min={2} value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))} />
      </label>
      <button type="button" disabled={busy || !title || !gameLauncherPlugin || !rosterConfig} onClick={handleCreate}>
        Create Room
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
