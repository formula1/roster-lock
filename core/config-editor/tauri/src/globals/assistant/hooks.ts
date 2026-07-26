import { useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { resolvePagePath, type AssistantPage } from "./pages";
import type { AssistantGlobals } from "./types";

// filePath comes from useParams() regardless of how deep this is mounted
// under the /config/:filePath/... route tree - react-router merges params
// from all matched ancestor routes. Outside that tree (home, about) it's
// just undefined, which resolvePagePath already handles.
export function useAssistantGlobals(): AssistantGlobals {
  const navigate = useNavigate();
  const { filePath } = useParams<{ filePath?: string }>();

  const navigateHandler = useCallback((
    page: AssistantPage, params: Record<string, string> | undefined, _reason: string
  ) => {
    navigate(resolvePagePath(page, filePath, params));
  }, [navigate, filePath]);

  return { navigate: navigateHandler };
}
