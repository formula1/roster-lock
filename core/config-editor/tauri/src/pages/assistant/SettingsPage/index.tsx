import { useState, useEffect, useCallback } from "react";
import { useAssistantContext, ollamaListModels, type OllamaModelInfo } from "../../../globals/assistant";
import "./style.css";

export function AssistantSettingsPage() {
  const { settings, setSettings, status, statusError, recheckStatus } = useAssistantContext();
  const [baseUrlDraft, setBaseUrlDraft] = useState(settings.baseUrl);
  const [models, setModels] = useState<Array<OllamaModelInfo> | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => { setBaseUrlDraft(settings.baseUrl); }, [settings.baseUrl]);

  const loadModels = useCallback(async () => {
    setLoadingModels(true);
    setModelsError(null);
    try {
      setModels(await ollamaListModels(settings.baseUrl));
    } catch (e) {
      setModelsError(e instanceof Error ? e.message : String(e));
      setModels(null);
    } finally {
      setLoadingModels(false);
    }
  }, [settings.baseUrl]);

  useEffect(() => {
    if (status === "available") loadModels();
  }, [status, loadModels]);

  const handleBaseUrlBlur = useCallback(() => {
    const trimmed = baseUrlDraft.trim();
    if (trimmed && trimmed !== settings.baseUrl) {
      setSettings({ ...settings, baseUrl: trimmed });
    }
  }, [baseUrlDraft, settings, setSettings]);

  const handleModelSelect = useCallback((name: string) => {
    setSettings({ ...settings, model: name });
  }, [settings, setSettings]);

  return (
    <div className="assistant-settings-page">
      <div className="assistant-settings-field">
        <label>Ollama server URL</label>
        <input
          value={baseUrlDraft}
          onChange={e => setBaseUrlDraft(e.target.value)}
          onBlur={handleBaseUrlBlur}
          placeholder="http://localhost:11434"
        />
      </div>

      <div className={`assistant-settings-status assistant-settings-status-${status}`}>
        <span>
          {status === "checking" && "Checking…"}
          {status === "available" && "Connected"}
          {status === "unavailable" && `Not reachable${statusError ? `: ${statusError}` : ""}`}
        </span>
        <button onClick={recheckStatus}>Check again</button>
      </div>

      <div className="assistant-settings-models">
        <div className="assistant-settings-models-header">
          <span>Model</span>
          <button onClick={loadModels} disabled={status !== "available" || loadingModels}>
            {loadingModels ? "Refreshing…" : "Refresh list"}
          </button>
        </div>

        {modelsError && <div className="assistant-message-error">{modelsError}</div>}
        {status !== "available" && !modelsError && (
          <div className="assistant-settings-models-empty">Connect to Ollama to see pulled models.</div>
        )}
        {models && models.length === 0 && (
          <div className="assistant-settings-models-empty">No models pulled yet - run "ollama pull &lt;model&gt;".</div>
        )}

        <ul>
          {models?.map(model => (
            <li key={model.name}>
              <label>
                <input
                  type="radio"
                  name="assistant-model"
                  checked={model.name === settings.model}
                  onChange={() => handleModelSelect(model.name)}
                />
                {model.name}
                {model.parameterSize ? ` (${model.parameterSize})` : ""}
                {model.supportsTools
                  ? <span className="assistant-model-badge assistant-model-badge-ok">tool calling</span>
                  : <span className="assistant-model-badge assistant-model-badge-warn">no tool calling</span>
                }
              </label>
            </li>
          ))}
        </ul>

        {settings.model && models && !models.some(m => m.name === settings.model) && (
          <div className="assistant-settings-models-empty">
            Current model "{settings.model}" isn't in the pulled list above - pull it with Ollama, or pick one that is.
          </div>
        )}
      </div>
    </div>
  );
}
