import { ChangeEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type { RJSFSchema } from "@rjsf/utils";
import { RosterLockV1Config } from "@roster-lock/types";
import { useAccount } from "../../context/AccountContext";
import { createRoom, listAllowedGameLaunchers } from "../../api/titledRoom";
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
  const [allowed, setAllowed] = useState<Array<string>>([]);
  const [installPackage, setInstallPackage] = useState("");
  const [installingPlugin, setInstallingPlugin] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [gameLauncherPlugin, setGameLauncherPlugin] = useState("");
  const [gameConfig, setGameConfig] = useState<unknown>({});
  const [rosterConfig, setRosterConfig] = useState<RosterLockV1Config | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [minPlayers, setMinPlayers] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [validationProblems, setValidationProblems] = useState<Array<string>>([]);
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
  // this app never talks to match-agent directly. `allowed` is what this
  // deployment's admin has permitted (GET /game-launchers, public) - diffing
  // the two below is what lets "missing" plugins get an Install button
  // instead of the user having to already know a package name.
  useEffect(refreshInstalled, []);
  useEffect(() => {
    listAllowedGameLaunchers(TITLED_ROOM_URL)
      .then((runners) => setAllowed(runners.map((r) => r.pluginName)))
      .catch((e) => setError(e.message));
  }, []);

  const installedIds = new Set(installed.map((r) => r.id));
  const missing = allowed.filter((pluginName) => !installedIds.has(pluginName));

  const installPlugin = async (pluginName: string) => {
    setInstallingPlugin(pluginName);
    setError(null);
    try {
      await bridge.installGameLauncherPlugin(pluginName);
      refreshInstalled();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInstallingPlugin(null);
    }
  };

  const handleInstall = () => installPackage && installPlugin(installPackage);

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
    setValidationProblems([]);
    try {
      // Ask the host to run the real plugin's validateGameConfig (if it has one) - e.g. ikemen-go
      // rejecting a teamMode override that's incompatible with the roster's selection config -
      // before this room is ever submitted, not just after the matchmaker rejects it. The
      // matchmaker itself re-checks this too (see titled-room's pluginValidators.ts), so this
      // client-side pass is a UX improvement, not the only enforcement.
      const problems = await bridge.validateGameConfig(gameLauncherPlugin, gameConfig, rosterConfig);
      if (problems.length > 0) {
        setValidationProblems(problems);
        return;
      }

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

      {missing.length > 0 && (
        <div className="missing-plugins">
          <p>This matchmaker supports game launchers you don't have installed yet:</p>
          <ul>
            {missing.map((pluginName) => (
              <li key={pluginName}>
                {pluginName}{" "}
                <button
                  type="button"
                  disabled={installingPlugin === pluginName}
                  onClick={() => installPlugin(pluginName)}
                >
                  {installingPlugin === pluginName ? "Installing..." : "Install"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="install-plugin-row">
        <input
          placeholder="Package name to install (e.g. @roster-lock/game-launcher-ikemen-go)"
          value={installPackage}
          onChange={(e) => setInstallPackage(e.target.value)}
        />
        <button type="button" disabled={!!installingPlugin || !installPackage} onClick={handleInstall}>
          {installingPlugin === installPackage ? "Installing..." : "Install"}
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
      {validationProblems.length > 0 && (
        <ul className="error">
          {validationProblems.map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      )}
    </div>
  );
}
