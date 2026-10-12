import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useMatchAgent } from "../context/MatchAgentContext";

export function RequireConnection({ children }: { children: ReactNode }) {
  const { connected } = useMatchAgent();
  if (!connected) return <Navigate to="/connect" replace />;
  return <>{children}</>;
}
