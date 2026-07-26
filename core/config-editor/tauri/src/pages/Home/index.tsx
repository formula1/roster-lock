
import { AgentSettingsSection } from "@roster-lock/config-editor-gui";

import { RecentFiles } from "./RecentFiles";
import { DialogButtons } from "./DialogButtons";

export function HomePage(){

  return (
    <div style={{ padding: '20px' }}>
      <h1>Roster Lock Config</h1>

      <div style={{ marginBottom: '30px' }}>
        <DialogButtons />
      </div>

      <div style={{ marginBottom: '30px' }}>
        <RecentFiles />
      </div>

      <AgentSettingsSection />
    </div>
  )
}
