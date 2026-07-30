import { useState } from "react";
import { Router } from "./Router";
import "./common.css";
import { UserSettingsDialog } from "../pages/user-settings";
import { AssistantProvider } from "../globals/assistant";
import { HOST } from "../host";
import { RouterWrapper } from "@roster-lock/config-editor-gui";

function App() {
  const [isReady, setIsReady] = useState(false);

  if(!isReady){
    return <UserSettingsDialog onSelect={()=>(setIsReady(true))} />
  };

  return (
    <RouterWrapper host={HOST}>
      <AssistantProvider>
        <Router />
      </AssistantProvider>
    </RouterWrapper>
  );
}

export default App
