import { ProcessGroup, waitForHttpOk } from "../../../integration/src/lib/process-utils";
import { REPO_ROOT } from "../../../integration/src/constants";

// Started once and shared by both simulated players' browser contexts -
// per-player isolation comes from separate Playwright browser contexts
// (separate localStorage/cookies), not separate servers. Ports match each
// app's own vite.config.ts default, and 5183 is also match-agent-client's
// hardcoded matchmaker-URL default (pages/MatchMaking), so no extra config
// plumbing is needed to point the host shell's iframe at titled-room/client.
export const MATCH_AGENT_CLIENT_PORT = 5182;
export const TITLED_ROOM_CLIENT_PORT = 5183;

export async function startViteServer(
  processes: ProcessGroup, label: string, packageFilter: string, port: number, env: Record<string, string> = {}
): Promise<string> {
  const url = `http://localhost:${port}`;
  processes.spawnBackground(
    `vite-${label}`, "pnpm",
    ["--filter", packageFilter, "exec", "vite", "--port", String(port), "--strictPort"],
    { cwd: REPO_ROOT, env: { ...process.env, ...env } }
  );
  await waitForHttpOk(url, 30_000);
  return url;
}
