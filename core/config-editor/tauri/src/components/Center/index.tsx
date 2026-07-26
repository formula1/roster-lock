import { PropsWithChildren } from "react";


export function Center(
  { children }: PropsWithChildren
){
  return (
    <div style={{ width: "100%", height: "100%", display: "flex" }}>
      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}
