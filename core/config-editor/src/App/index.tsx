import { useState } from "react";
import { Router } from "./Router";
import { Tooltip } from "react-tooltip";
import "./common.css";
import { UserSettingsDialog } from "../pages/user-settings";
import { Markdown } from "../components/Markdown";
import { LightboxProvider } from "../components";

function App() {
  const [isReady, setIsReady] = useState(false);

  if(!isReady){
    return <UserSettingsDialog onSelect={()=>(setIsReady(true))} />
  };

  return (
    <LightboxProvider>
      <Router />
      <Tooltip
        id="global-tooltip-clickable"
        clickable={true}
        render={({ content })=>(<Markdown>{content}</Markdown>)}
      />
      <Tooltip
        id="global-tooltip-non-clickable"
        clickable={false}
        render={({ content })=>(<Markdown>{content}</Markdown>)}
      />
    </LightboxProvider>
  );
}

export default App
