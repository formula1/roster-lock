import { PropsWithChildren, ReactNode, useEffect, useRef } from "react";

import "./style.css";
import { ClickableButton } from "./ClickableButton";

export type FollowButtonConfig = {
  label: string,
  onClick: ()=>any,
  disabled?: boolean,
};

type Props = PropsWithChildren<{
  side?: "left" | "right",
  info: { title: string, description?: string, note?: ReactNode },
  buttons: Array<FollowButtonConfig>,
}>;

export function FollowButtonForm({ side, info, buttons, children }: Props){
  side = !side ? "left" : side;
  return (
    <div className="follow-button-container">
      {side === "left" ? (
        <ButtonsContainer info={info} buttons={buttons} />
      ) : null}
      <div className="form-container">
        {children}
      </div>
      {side === "right" ? (
        <ButtonsContainer info={info} buttons={buttons} />
      ) : null}
    </div>
  );
}

function ButtonsContainer({ info, buttons }: { info: Props["info"], buttons: Props["buttons"] }){
  const footerElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (footerElementRef.current) {
      footerElementRef.current.scrollTop = 0;
    }
  }, [info.note]); // Reset when note content changes

  return (
    <div className="action-container">
      <div>
        <div>
          <h3>{info.title}</h3>
          {info.description && <p>{info.description}</p>}
        </div>

        <ul className="button-list">
        {buttons.map((button, i) => (
          <li key={button.label + i}>
            <ClickableButton
              onClick={button.onClick}
              disabled={button.disabled}
            >
              {button.label}
            </ClickableButton>
          </li>
        ))}
        </ul>

        {info.note && (
          <footer ref={footerElementRef} >
            <div>{info.note}</div>
          </footer>
        )}
      </div>
    </div>
  );
}