import { CSSProperties } from "react";
import toolttipIcon from "./icons8-info.svg";

export const SPAN_STYLE: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "0.25em"
};

export const TOOL_TIP_IDS = {
  CLICKABLE: "config-editor-global-tooltip-clickable",
  UNCLICKABLE: "config-editor-global-tooltip-non-clickable",
}

export function ToolTipSpan(
  { children, tip, clickable = false, className, style }: {
    children: React.ReactNode,
    tip: string,
    clickable?: boolean,
    className?: string,
    style?: React.CSSProperties
  }
){
  return <span
    data-tooltip-id={clickable ? TOOL_TIP_IDS.CLICKABLE : TOOL_TIP_IDS.UNCLICKABLE}
    data-tooltip-content={tip}
    style={{ ...SPAN_STYLE, ...style }}
    className={className}
  >
    <img
      src={toolttipIcon} alt="View For More Info"
      style={{
        height: "1em",
        width: "auto",
        verticalAlign: "middle",
        maxWidth: "1em",
      }}
    />
    {children}
  </span>
}
