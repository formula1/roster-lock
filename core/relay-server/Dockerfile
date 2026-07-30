# Relay Server Dockerfile
# Uses Node.js to run a local version of the Cloudflare Workers relay server
#
# Build context must be the repo root: this package depends on the local
# @roster-lock/utils workspace package via "workspace:*", resolved through
# the pnpm workspace, so the workspace metadata and core/utils need to be
# present alongside it inside the image too.
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
# scripts (@roster-lock/utils builds itself via its "prepare" script, which
# needs its actual source, not just its package.json). Keeping this separate
# from the full source COPY below means editing server/client source doesn't
# bust the install layer's cache, so `pnpm install` doesn't re-run on every
# rebuild.
COPY core/utils/package.json core/utils/tsconfig.json core/utils/
COPY core/utils/src/ core/utils/src/
COPY core/relay-server/package.json core/relay-server/
COPY core/relay-server/client/package.json core/relay-server/client/

# Installs @roster-lock/utils (builds it via its own "prepare" script),
# core/relay-server's own deps (including wrangler's postinstall fetch of
# the workerd binary it needs to run), and the admin client's deps.
RUN pnpm install --filter @roster-lock/relay-server... --filter @roster-lock/relay-client... --frozen-lockfile

# Now bring in the rest of the relay-server source (tests, client, etc).
# core/utils doesn't need a second copy: package.json/tsconfig/src are already
# in place from above and dist/ was already built by the install step's
# "prepare" script; nothing here runs its tests.
COPY core/relay-server/ core/relay-server/

WORKDIR /app/core/relay-server

# Build the admin React client so wrangler's static asset binding (which
# points at client/dist) has something real to serve.
RUN pnpm run build:client

# Expose port
EXPOSE 80

# Start the server using wrangler dev. The local D1 database starts empty,
# so apply the schema before starting (wrangler dev simulates D1 locally
# and never runs migrations on its own).
CMD ["sh", "-c", "npx wrangler d1 execute roster-lock-db --local --file=./server/src/version-1/schema/tables.sql && npx wrangler dev --ip 0.0.0.0 --port 80"]
