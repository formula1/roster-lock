# Deploying the Relay Server to Cloudflare Workers

This package deploys as a Cloudflare Worker via `wrangler deploy`. **Docker is
not part of this path** — the `Dockerfile` in this directory runs
`wrangler dev` to simulate a Worker locally (used by the full-local example's
integration tests), it does not produce anything Cloudflare runs. Actual
publishing happens straight from a checkout of this monorepo (your machine or
a CI runner), where `wrangler deploy` bundles the Worker with esbuild and
uploads a single script — no container involved.

## How `@roster-lock/utils` gets included

`@roster-lock/utils` is a `file:../utils` workspace dependency. `pnpm install`
symlinks `node_modules/@roster-lock/utils` to `core/utils` and runs its
`prepare` script (`tsc`) so `core/utils/dist/index.js` exists. When you run
`wrangler deploy`, its esbuild bundler follows that symlink and inlines the
built utils code into the uploaded Worker script, the same way it inlines
`hono` and `zod`. There's nothing extra to configure — just make sure:

- You run `pnpm install` from the **repo root** (or `pnpm install --filter @roster-lock/server...`)
  before deploying, so the workspace link and the utils build both exist.
- You deploy from a full checkout of the monorepo (not a copy of just
  `core/relay-server`) — `wrangler deploy` needs `core/utils` on disk to
  resolve the symlink.

## Prerequisites

1. A Cloudflare account with Workers, Durable Objects, and D1 enabled.
2. Auth: `npx wrangler login` locally, or a `CLOUDFLARE_API_TOKEN` env var in CI
   (Workers Scripts: Edit, D1: Edit permissions).
3. `pnpm install` from the repo root.

## One-time setup

### 1. Create the production D1 database

```sh
cd core/relay-server
npx wrangler d1 create roster-lock-db-production
```

Copy the returned `database_id` into `wrangler.toml` under
`[[env.production.d1_databases]]` (it's currently a blank placeholder).

Apply the schema to the new remote database:

```sh
npx wrangler d1 execute roster-lock-db-production --env production --remote \
  --file=./server/src/version-1/schema/tables.sql
```

### 2. Move secrets out of `wrangler.toml`

`wrangler.toml` is committed to git and currently hardcodes `JWT_SECRET`,
`GAME_COORDINATOR_ENCRYPTION_KEY`, `INITIAL_ADMIN_USERNAME`, and
`INITIAL_ADMIN_PASSWORD` (`hello`/`world`) under the top-level `[vars]`. That's
fine for local dev, but two things to fix before going to production:

- **Named environments don't inherit top-level `[vars]`.** As written,
  `[env.production]` only sets `ENVIRONMENT` — the other four vars would be
  `undefined` in the deployed production Worker.
- Secrets shouldn't live in plaintext in git regardless. Use `wrangler secret`
  instead, which stores them encrypted server-side per environment:

```sh
npx wrangler secret put JWT_SECRET --env production
npx wrangler secret put GAME_COORDINATOR_ENCRYPTION_KEY --env production
npx wrangler secret put INITIAL_ADMIN_USERNAME --env production
npx wrangler secret put INITIAL_ADMIN_PASSWORD --env production
```

Once these are set as secrets, remove them from `[env.production.vars]` in
`wrangler.toml` (leave `ENVIRONMENT = "production"` as a plain var). Rotate
the JWT secret and encryption key rather than reusing the dev values checked
into git.

## Deploying

```sh
cd core/relay-server
pnpm run deploy:production
```

This runs `build:client` (React admin client) then `wrangler deploy --env production`.

For a staging/dev deploy against the default (non-`production`) environment:

```sh
pnpm run deploy
```

Note the default environment's `[[d1_databases]]` entry currently uses a
placeholder `database_id` meant for local persistence — create a separate
real D1 database for it if you intend to use this environment as a live
staging deploy rather than just `wrangler dev`.

## Verifying

```sh
npx wrangler tail --env production   # stream logs
```

Hit the deployed URL (shown after `wrangler deploy`) and confirm the API and
static admin client both respond, then log in with the bootstrap admin
credentials and rotate the password.
