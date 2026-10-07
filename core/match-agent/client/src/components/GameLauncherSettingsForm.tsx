import { useEffect, useState } from "react";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type { RJSFSchema } from "@rjsf/utils";
import { useMatchAgent } from "../context/MatchAgentContext";
import {
  getGameLauncherSettings, setGameLauncherSettings, getGameLauncherVersion, updateGameLauncherBinary,
  validateGameLauncherBinaryLocation, listAvailableGameLaunchers, pickGameLauncherBinaryLocation,
  listGameLauncherBinaries, removeGameLauncherBinary, DownloadedGameLauncherBinary,
} from "../api/matchAgent";

// A schema with no declared properties renders nothing useful in rjsf - most
// plugins (e.g. ikemen-go today) have nothing beyond binaryLocation, so this
// is what most of the time skips rendering the form at all rather than
// showing an empty box.
function hasProperties(schema: unknown): schema is RJSFSchema {
  return !!schema && typeof schema === "object" && !!(schema as RJSFSchema).properties
    && Object.keys((schema as RJSFSchema).properties!).length > 0;
}

// binaryLocation/version/update form for one game-launcher plugin - shared by
// pages/GameLauncher/Detail.tsx (the standalone settings route) and
// components/InstallGameLauncherLightbox.tsx (the same form, right after a
// fresh install, inside the lightbox the host opens for the
// installGameLauncherPlugin bridge call).
export function GameLauncherSettingsForm({ pluginName }: { pluginName: string }) {
  const { settings } = useMatchAgent();
  const [binaryLocation, setBinaryLocation] = useState("");
  const [version, setVersion] = useState<{ local: { title: string }, supported: { title: string } } | null>(null);
  // Set right after load/save, not just on-demand - so a bad folder is
  // flagged before the user ever hits "Check version" or "Download / update"
  // and gets a raw spawn/ENOENT-flavored error instead (see
  // docs/v2/binary-location.md's Validation section). Left `undefined` while
  // there's no binaryLocation to check at all, as opposed to `null` (never
  // checked yet) or a real result.
  const [validation, setValidation] = useState<{ valid: true } | { valid: false, message: string } | null>(null);
  // The plugin's own per-machine settings beyond binaryLocation - schema
  // comes from AvailableGameLauncher.localConfigSchema (listAvailableGameLaunchers),
  // not from getGameLauncherSettings, since that route only ever returns the
  // stored *value* (GameLauncherLocalSettings), never the plugin's schema.
  const [localConfigSchema, setLocalConfigSchema] = useState<unknown>(null);
  const [localConfig, setLocalConfig] = useState<unknown>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Everything getBinary has put under this plugin's own dataDir so far -
  // reloaded after every download/remove so the "hoarding old versions"
  // list a player sees always matches what's actually on disk.
  const [binaries, setBinaries] = useState<Array<DownloadedGameLauncherBinary>>([]);

  const loadBinaries = () => {
    listGameLauncherBinaries(settings.url, settings.authCode, pluginName)
      .then(setBinaries)
      .catch((e) => setError(e.message));
  };

  const validate = async (location: string) => {
    if(!location){
      setValidation(null);
      return;
    }
    try {
      setValidation(await validateGameLauncherBinaryLocation(settings.url, settings.authCode, pluginName));
    } catch (e) {
      setValidation({ valid: false, message: (e as Error).message });
    }
  };

  const load = () => {
    setError(null);
    Promise.all([
      getGameLauncherSettings(settings.url, settings.authCode, pluginName),
      listAvailableGameLaunchers(settings.url, settings.authCode),
    ])
      .then(([s, available]) => {
        setBinaryLocation(s.binaryLocation ?? "");
        setLocalConfig(s.localConfig);
        setLocalConfigSchema(available.find((a) => a.pluginName === pluginName)?.localConfigSchema ?? null);
        return validate(s.binaryLocation ?? "");
      })
      .catch((e) => setError(e.message));
  };

  useEffect(load, [pluginName, settings]);
  useEffect(loadBinaries, [pluginName, settings]);

  // validateGameLauncherBinaryLocation checks whatever is currently *saved*
  // on the match-agent side, not a value the client merely holds in state -
  // so any caller that wants a freshly-picked/edited location validated has
  // to persist it first, otherwise it'd just re-validate the old one.
  const persistAndValidate = async (location: string) => {
    await setGameLauncherSettings(settings.url, settings.authCode, pluginName, { binaryLocation: location, localConfig });
    await validate(location);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await persistAndValidate(binaryLocation);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const checkVersion = async () => {
    setBusy(true);
    setError(null);
    try {
      setVersion(await getGameLauncherVersion(settings.url, settings.authCode, pluginName));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const browse = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await pickGameLauncherBinaryLocation(settings.url, settings.authCode, pluginName);
      if ("path" in result) {
        setBinaryLocation(result.path);
        await persistAndValidate(result.path);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Deliberately doesn't require binaryLocation to already be set (unlike
  // checkVersion) - getBinary acquires one from scratch, so this is also
  // how a plugin that supports it gets its *first* binaryLocation, not
  // just later updates. The returned path is both displayed and validated
  // immediately, same as a freshly Browse'd/typed one would be.
  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const { binaryLocation: newLocation } = await updateGameLauncherBinary(settings.url, settings.authCode, pluginName);
      setBinaryLocation(newLocation);
      await validate(newLocation);
      await checkVersion();
      loadBinaries();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeBinary = async (location: string) => {
    setBusy(true);
    setError(null);
    try {
      await removeGameLauncherBinary(settings.url, settings.authCode, pluginName, location);
      loadBinaries();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="game-launcher-settings-form">
      <label>
        Binary location
        <input value={binaryLocation} onChange={(e) => setBinaryLocation(e.target.value)} />
      </label>
      <button type="button" disabled={busy} onClick={browse}>Browse...</button>
      {hasProperties(localConfigSchema) && (
        // Own submit button suppressed - localConfig just feeds into this
        // component's own state via onChange, and goes out through the
        // Save button below alongside binaryLocation, as one settings write.
        <Form
          schema={localConfigSchema}
          formData={localConfig}
          validator={validator}
          onChange={(e) => setLocalConfig(e.formData)}
          uiSchema={{ "ui:submitButtonOptions": { norender: true } }}
        />
      )}
      <button type="button" disabled={busy} onClick={save}>Save</button>
      <button type="button" disabled={busy || !binaryLocation} onClick={checkVersion}>Check version</button>
      <button type="button" disabled={busy} onClick={download}>Download / update</button>
      {validation && !validation.valid && <p className="error">{validation.message}</p>}
      {version && (
        <p>Local: {version.local.title} - Supported: {version.supported.title}</p>
      )}
      {binaries.length > 0 && (
        <ul className="game-launcher-binaries-list">
          {binaries.map((binary) => (
            <li key={binary.binaryLocation}>
              <span>
                {binary.version?.title ?? "(unrecognized install)"}
                {binary.active && " - active"}
                {binary.downloadedAt && ` - downloaded ${new Date(binary.downloadedAt).toLocaleString()}`}
                {binary.lastUsedAt && ` - last used ${new Date(binary.lastUsedAt).toLocaleString()}`}
              </span>
              <button type="button" disabled={busy} onClick={() => removeBinary(binary.binaryLocation)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
