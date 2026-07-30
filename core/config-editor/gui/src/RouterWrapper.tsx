import { type PropsWithChildren } from "react";
import { Tooltip } from "react-tooltip";
import { TOOL_TIP_IDS } from "./components/ToolTip";
import { Markdown } from "./components/Markdown";
import { LightboxProvider } from "./components/LightBox";
import { ConfigContextProvider, ConfigSourceProvider } from "./globals/ConfigContext";
import { HostProvider, type HostFunctions } from "./globals/Host";
import { AgentConnectionProvider } from "./globals/agent";
import "./base.css";

export function RouterWrapper({ children, host }: PropsWithChildren<{ host: HostFunctions }>) {
  return (
    <HostProvider host={host}>
      <AgentConnectionProvider>
      <LightboxProvider>
        <ConfigSourceProvider>
          <ConfigContextProvider>
            {children}
          </ConfigContextProvider>
        </ConfigSourceProvider>
        <Tooltip
          id={TOOL_TIP_IDS.CLICKABLE}
          clickable={true}
          render={({ content })=>(<Markdown>{content}</Markdown>)}
        />
        <Tooltip
          id={TOOL_TIP_IDS.UNCLICKABLE}
          clickable={false}
          render={({ content })=>(<Markdown>{content}</Markdown>)}
        />
      </LightboxProvider>
      </AgentConnectionProvider>
    </HostProvider>
  );
}
