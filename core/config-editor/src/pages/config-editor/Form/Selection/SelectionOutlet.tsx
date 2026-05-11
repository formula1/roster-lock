import { useFollowButtons } from "../Contexts/Buttons";
import { FollowButtonForm } from "../../../../components/FollowButtonForm";
import { Outlet } from "react-router";

export function SelectionOutlet() {
  const buttons = useFollowButtons();

  return (
    <>
    <h1>Selection Config</h1>
    <div style={{ overflow: "hidden", flexGrow: 1 }}>
      <FollowButtonForm
        info={{ title: "Selection Config" }}
        buttons={buttons}
      >
        <Outlet />
      </FollowButtonForm>
    </div>
    </>
  );
}
