import { Navigate } from "react-router-dom";
import { ReactNode } from "react";

export function RequireStep({
  ok,
  redirectTo,
  children,
}: {
  ok: boolean;
  redirectTo: string;
  children: ReactNode;
}) {
  if (!ok) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}
