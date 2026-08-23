# Titled Room Matchmaker Dockerfile
# Runs a local version of the titled-room Cloudflare Workers matchmaker
#
# Build context must be the repo root: this package depends on the local
# @roster-lock/types and @roster-lock/utils workspace packages via
# "workspace:*", resolved through the pnpm workspace, so their metadata and
# source need to be present alongside it inside the image too.
#
# Note: this only builds/runs the Worker (src/), not client/ - that's a
# separate React app meant to run inside a host shell's <iframe> (see
# core/match-agent/client), not served as a static asset by this Worker.
#
# Uses a glibc-based (Debian) image, not Alpine: wrangler's bundled workerd
# binary is a glibc build and fails to exec against musl libc (Alpine).
# Node 22+ because wrangler 4.110 requires it.

FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy only what's needed to resolve the workspace graph and run install-time
# scripts (@roster-lock/types and @roster-lock/utils build themselves via
# their own "prepare" scripts). Keeping this separate from the full source
# COPY below means editing this service's source doesn't bust the install
# layer's cache.
COPY core/types/package.json core/types/tsconfig.json core/types/
COPY core/types/src/ core/types/src/
COPY core/utils/package.json core/utils/tsconfig.json core/utils/
COPY core/utils/src/ core/utils/src/
COPY examples/services/match-makers/titled-room/package.json examples/services/match-makers/titled-room/

RUN pnpm install --filter @roster-lock/titled-room... --frozen-lockfile

COPY examples/services/match-makers/titled-room/src/ examples/services/match-makers/titled-room/src/
COPY examples/services/match-makers/titled-room/tests/ examples/services/match-makers/titled-room/tests/
COPY examples/services/match-makers/titled-room/tsconfig.json examples/services/match-makers/titled-room/wrangler.toml examples/services/match-makers/titled-room/

WORKDIR /app/examples/services/match-makers/titled-room

EXPOSE 80

# Start the server using wrangler dev. The local D1 database starts empty,
# so apply the schema before starting (wrangler dev simulates D1 locally
# and never runs migrations on its own). Which game-launcher plugins are
# allowed (and their coordinator setup) is admin-managed at runtime via
# POST/PUT /admin/game-launchers (see src/admin/), not env-configured here.
#
# wrangler.toml ships with local-dev-only [vars] defaults for JWT_SECRET and
# INITIAL_ADMIN_USERNAME/PASSWORD (see its own comments) - a deployment's
# real RELAY_SERVER_URL/PUBLIC_RELAY_SERVER_URL, AUTH_SERVICE_URL and
# matchmaker signing keypair are still provided as regular environment
# variables (docker-compose `environment:`/`env_file:`) and written out here
# to `.dev.vars`, wrangler dev's standard local-only vars/secrets override
# file - wrangler dev never reads plain process.env itself, so any var a
# deployment needs to actually override has to be listed here explicitly.
CMD ["sh", "-c", "\
  { \
    [ -n \"$RELAY_SERVER_URL\" ] && echo \"RELAY_SERVER_URL=$RELAY_SERVER_URL\"; \
    [ -n \"$PUBLIC_RELAY_SERVER_URL\" ] && echo \"PUBLIC_RELAY_SERVER_URL=$PUBLIC_RELAY_SERVER_URL\"; \
    [ -n \"$MATCHMAKER_PUBLIC_KEY\" ] && echo \"MATCHMAKER_PUBLIC_KEY=$MATCHMAKER_PUBLIC_KEY\"; \
    [ -n \"$MATCHMAKER_SECRET_KEY\" ] && echo \"MATCHMAKER_SECRET_KEY=$MATCHMAKER_SECRET_KEY\"; \
    [ -n \"$AUTH_SERVICE_URL\" ] && echo \"AUTH_SERVICE_URL=$AUTH_SERVICE_URL\"; \
  } > .dev.vars && \
  npx wrangler d1 execute roster-lock-titled-room-db --local --file=./src/db/schema.sql && \
  npx wrangler dev --ip 0.0.0.0 --port 80 \
"]
