import * as path from "node:path";

export const REPO_ROOT = path.resolve(__dirname, "../../../..");
export const MUGEN_DIR = path.resolve(REPO_ROOT, "./examples/mugen");
export const ENV_VARS_DIR = path.join(MUGEN_DIR, "services/env-vars");
// "tag", not "simul" - ikemen-go's plugin rejects "simul" outright (it only ever drives 2 sides,
// one human player each - see plugins/game-launcher/ikemen-go/readme.md's "Team mode comes from
// the selection config"). run.ts's own runPlayers already left an empty gameConfig expecting this
// to resolve via engine.officialSelections to "tag" - mugen-simul.roster-lock.json's own selection
// hash resolves to "simul" instead, which fails room creation outright (confirmed: its selection's
// hash equals the "simul" entry in its own officialSelections, and assertSupportedTeamMode throws
// for that tag) - a real, currently-broken path, not a hypothetical one.
export const ROSTER_LOCK_PATH = path.join(MUGEN_DIR, "roster-locks/mugen-tag.roster-lock.json");
