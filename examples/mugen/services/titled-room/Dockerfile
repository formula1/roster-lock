# Titled Room Matchmaker Dockerfile
# Runs a local version of the titled-room Cloudflare Workers matchmaker,
# serving its own client/ React app (see wrangler.toml's [assets] and
# index.ts's catch-all route) as titled-room's real, deployed matchmaker UI -
# mirrors core/relay-server/cloudflare's Dockerfile + client-admin pairing.
#
# Build context must be the repo root: this package depends on the local
# @roster-lock/types and @roster-lock/utils workspace packages via
# "workspace:*", resolved through the pnpm workspace, so their metadata and
# source need to be present alongside it inside the image too.
#
# Uses a glibc-based (Debian) image, not Alpine: wrangler's bundled workerd
# binary is a glibc build and fails to exec against musl libc (Alpine).
# Node 22+ because wrangler 4.110 requires it.

FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy only what's needed to resolve the workspace graph and run install-time
# scripts (@roster-lock/types, @roster-lock/utils, and
# @roster-lock/game-launcher-ikemen-go all build themselves via their own
# "prepare" scripts - game-launchers.ts imports ikemen-go's
# "./selection-validation" and "./package.json" directly, a real
# "workspace:*" dependency, not something an npm registry needs to provide).
# Keeping this separate from the full source COPY below means editing this
# service's source doesn't bust the install layer's cache.
COPY core/types/package.json core/types/tsconfig.json core/types/
COPY core/types/src/ core/types/src/
COPY core/utils/package.json core/utils/tsconfig.json core/utils/
COPY core/utils/src/ core/utils/src/
COPY plugins/game-launcher/ikemen-go/package.json plugins/game-launcher/ikemen-go/tsconfig.json plugins/game-launcher/ikemen-go/
COPY plugins/game-launcher/ikemen-go/src/ plugins/game-launcher/ikemen-go/src/
COPY examples/mugen/services/titled-room/package.json examples/mugen/services/titled-room/
COPY examples/mugen/services/titled-room/client/package.json examples/mugen/services/titled-room/client/

RUN pnpm install --filter @roster-lock/titled-room... --filter @roster-lock/titled-room-client... --frozen-lockfile

COPY examples/mugen/services/titled-room/src/ examples/mugen/services/titled-room/src/
COPY examples/mugen/services/titled-room/tests/ examples/mugen/services/titled-room/tests/
COPY examples/mugen/services/titled-room/tsconfig.json examples/mugen/services/titled-room/wrangler.toml examples/mugen/services/titled-room/
COPY examples/mugen/services/titled-room/client/ examples/mugen/services/titled-room/client/

WORKDIR /app/examples/mugen/services/titled-room

# Build the client so wrangler's static asset binding (which points at
# ./client/dist) has something real to serve. VITE_AUTH_SERVICE_URL/
# VITE_TITLED_ROOM_URL are build-time (see client/src/config.ts), not
# container env vars, since they're baked into the built JS - a deployment
# pointing the client at non-default backends passes them as Docker build
# args (docker-compose `build.args:`), which Vite then picks up from these
# ARGs' matching process.env entries automatically.
ARG VITE_AUTH_SERVICE_URL
ARG VITE_TITLED_ROOM_URL
RUN pnpm run build:client

EXPOSE 80

# Start the server using wrangler dev. The local D1 database starts empty,
# so apply the schema before starting (wrangler dev simulates D1 locally
# and never runs migrations on its own). Which game-launcher plugin is
# allowed (there's only ever one - ikemen-go) and its coordinator are
# hardcoded/env-configured (see game-launchers.ts), not admin-managed.
#
# A deployment's real RELAY_SERVER_URL/PUBLIC_RELAY_SERVER_URL,
# AUTH_SERVICE_URL, matchmaker signing keypair, and coordinator address are
# provided as regular environment variables (docker-compose
# `environment:`/`env_file:`) and written out here to `.dev.vars`, wrangler
# dev's standard local-only vars/secrets override file - wrangler dev never
# reads plain process.env itself, so any var a deployment needs to actually
# override has to be listed here explicitly.
CMD ["sh", "-c", "\
  { \
    [ -n \"$RELAY_SERVER_URL\" ] && echo \"RELAY_SERVER_URL=$RELAY_SERVER_URL\"; \
    [ -n \"$PUBLIC_RELAY_SERVER_URL\" ] && echo \"PUBLIC_RELAY_SERVER_URL=$PUBLIC_RELAY_SERVER_URL\"; \
    [ -n \"$MATCHMAKER_PUBLIC_KEY\" ] && echo \"MATCHMAKER_PUBLIC_KEY=$MATCHMAKER_PUBLIC_KEY\"; \
    [ -n \"$MATCHMAKER_SECRET_KEY\" ] && echo \"MATCHMAKER_SECRET_KEY=$MATCHMAKER_SECRET_KEY\"; \
    [ -n \"$AUTH_SERVICE_URL\" ] && echo \"AUTH_SERVICE_URL=$AUTH_SERVICE_URL\"; \
    [ -n \"$GAME_COORDINATOR_ID\" ] && echo \"GAME_COORDINATOR_ID=$GAME_COORDINATOR_ID\"; \
    [ -n \"$IKEMEN_COORDINATOR_TCP_HOST\" ] && echo \"IKEMEN_COORDINATOR_TCP_HOST=$IKEMEN_COORDINATOR_TCP_HOST\"; \
    [ -n \"$IKEMEN_COORDINATOR_TCP_PORT\" ] && echo \"IKEMEN_COORDINATOR_TCP_PORT=$IKEMEN_COORDINATOR_TCP_PORT\"; \
  } > .dev.vars && \
  npx wrangler d1 execute roster-lock-titled-room-db --local --file=./src/db/schema.sql && \
  npx wrangler dev --ip 0.0.0.0 --port 80 \
"]
