// Shared by playwright.config.ts (which spins both servers up) and every
// spec (which needs to know where to point the browser/pre-seed settings,
// or - for CONFIG_FILE_PATH/ROSTER_LOCK_FOLDER - create fixtures the
// spawned match-agent will actually see).
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const MATCH_AGENT_PORT = 58799;
export const MATCH_AGENT_AUTH_CODE = "e2e-nav-test-auth-code";
export const MATCH_AGENT_URL = `http://localhost:${MATCH_AGENT_PORT}`;

export const CLIENT_PORT = 5199;
export const CLIENT_URL = `http://localhost:${CLIENT_PORT}`;

// This module gets loaded independently in several separate Node
// processes - playwright.config.ts's own loader, each test worker, and
// (indirectly) the spawned match-agent server never loads it at all but
// has to agree on where CONFIG_FILE_PATH/ROSTER_LOCK_FOLDER are regardless.
// A random mkdtemp() per load would give each process its own answer, so
// this has to be a fixed, deterministic path instead - safe here (unlike
// production use) because exactly one e2e run is ever expected on a
// machine at a time, same assumption MATCH_AGENT_PORT/CLIENT_PORT already
// make by being fixed rather than randomly chosen.
const CONFIG_DIR = join(tmpdir(), "roster-lock-match-agent-client-e2e");
export const CONFIG_FILE_PATH = join(CONFIG_DIR, "match-agent.json");
// match-agent's own default resolution of rosterLockFolder relative to
// CONFIG_FILE_PATH (a sibling "roster-locks" folder - see
// resolveConfigFolders), computed here rather than left implicit, so a
// spec can create fixtures inside the exact folder OnScreenFileDialog will
// browse by default, without needing its own --roster-lock-folder override.
export const ROSTER_LOCK_FOLDER = join(CONFIG_DIR, "roster-locks");
mkdirSync(ROSTER_LOCK_FOLDER, { recursive: true });
// Same reasoning as ROSTER_LOCK_FOLDER above, for match-agent's default
// pluginFolder (a sibling "plugins" folder - see resolveConfigFolders) -
// lets gamepad-only.spec.ts's binaries-list test install a real plugin
// straight onto disk (via @roster-lock/plugin-runtime's installPlugin)
// without needing a --plugin-folder override, and without match-agent
// ever needing a restart to see it: plugin-management's readManifest
// re-reads plugins.json fresh on every request, so a plugin dropped in
// after the server has already started is picked up by its very next
// request.
export const PLUGIN_FOLDER = join(CONFIG_DIR, "plugins");
mkdirSync(PLUGIN_FOLDER, { recursive: true });

// MatchAgentContext's own localStorage key/shape (core/match-agent/client/
// src/context/MatchAgentContext.tsx) - pre-seeding it lets a spec start
// already past the Connect page without a mouse *or* keyboard/gamepad text
// entry, for specs whose own point is something further into the app.
export const MATCH_AGENT_SETTINGS_STORAGE_KEY = "match-agent-client:match-agent";
