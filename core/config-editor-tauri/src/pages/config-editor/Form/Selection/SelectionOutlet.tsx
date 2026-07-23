import { useFollowButtons } from "../Contexts/Buttons";
import { FollowButtonForm } from "../../../../components/FollowButtonForm";
import { Outlet } from "react-router";
import { usePageInfo } from "../../Contexts/PageTitle";
import { useEffect } from "react";
import { SelectionLegend } from "./Legend";
import { useRosterLock } from "../Contexts/RosterLock";

export function SelectionOutlet() {
  const { onChange: setPageInfo } = usePageInfo();
  const { value: lock } = useRosterLock();


  useEffect(()=>{
    setPageInfo({ title: "Selection Config", note: <SelectionLegend config={lock} /> })
  }, []);

  return (
    <>
      <Outlet />
    </>
  );
}
