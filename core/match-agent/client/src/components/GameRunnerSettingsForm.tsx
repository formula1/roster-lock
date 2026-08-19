import { useEffect, useState } from "react";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type { RJSFSchema } from "@rjsf/utils";
import { useMatchAgent } from "../context/MatchAgentContext";
import {
  getGameRunnerSettings, setGameRunnerSettings, getGameRunnerVersion, updateGameRunnerBinary,
  validateGameRunnerBinaryLocation, listAvailableGameRunners,
} from "../api/matchAgent";

// A schema with no declared properties renders nothing useful in rjsf - most
// plugins (e.g. ikemen-go today) have nothing beyond binaryLocation, so this
// is what most of the time skips rendering the form at all rather than
// showing an empty box.
function hasProperties(schema: unknown): schema is RJSFSchema {
  return !!schema && typeof schema === "object" && !!(schema as RJSFSchema).properties
    && Object.keys((schema as RJSFSchema).properties!).length > 0;
}

// binaryLocation/version/update form for one game-runner plugin - shared by
// pages/GameRunner/Detail.tsx (the standalone settings route) and
// components/InstallGameRunnerLightbox.tsx (the same form, right after a
// fresh install, inside the lightbox the host opens for the
// installGameRunnerPlugin bridge call).
export function GameRunnerSettingsForm({ pluginName }: { pluginName: string }) {
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
  // comes from AvailableGameRunner.localConfigSchema (listAvailableGameRunners),
  // not from getGameRunnerSettings, since that route only ever returns the
  // stored *value* (GameRunnerLocalSettings), never the plugin's schema.
  const [localConfigSchema, setLocalConfigSchema] = useState<unknown>(null);
  const [localConfig, setLocalConfig] = useState<unknown>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = async (location: string) => {
    if(!location){
      setValidation(null);
      return;
    }
    try {
      setValidation(await validateGameRunnerBinaryLocation(settings.url, settings.authCode, pluginName));
    } catch (e) {
      setValidation({ valid: false, message: (e as Error).message });
    }
  };

  const load = () => {
    setError(null);
    Promise.all([
      getGameRunnerSettings(settings.url, settings.authCode, pluginName),
      listAvailableGameRunners(settings.url, settings.authCode),
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

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await setGameRunnerSettings(settings.url, settings.authCode, pluginName, { binaryLocation, localConfig });
      await validate(binaryLocation);
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
      setVersion(await getGameRunnerVersion(settings.url, settings.authCode, pluginName));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateGameRunnerBinary(settings.url, settings.authCode, pluginName);
      await checkVersion();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="game-runner-settings-form">
      <label>
        Binary location
        <input value={binaryLocation} onChange={(e) => setBinaryLocation(e.target.value)} />
      </label>
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
      <button type="button" disabled={busy || !binaryLocation} onClick={download}>Download / update</button>
      {validation && !validation.valid && <p className="error">{validation.message}</p>}
      {version && (
        <p>Local: {version.local.title} - Supported: {version.supported.title}</p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
