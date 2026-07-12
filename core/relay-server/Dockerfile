# Relay Server Dockerfile
# Uses Node.js to run a local version of the Cloudflare Workers relay server
#
# Build context must be the repo root: this package depends on the local
# @roster-lock/utils workspace package via "file:../utils", resolved through
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
COPY core/utils/ core/utils/
COPY core/relay-server/ core/relay-server/

# Installs @roster-lock/utils (builds it via its own "prepare" script) and
# core/relay-server's own deps, including wrangler's postinstall fetch of
# the workerd binary it needs to run.
RUN pnpm install --filter @roster-lock/server... --frozen-lockfile

WORKDIR /app/core/relay-server

# The admin React client (client/) currently fails to build due to a
# pre-existing @types/react version conflict in the workspace, unrelated
# to the relay API this integration test exercises. Skip building it for
# now and serve a placeholder so wrangler's static asset binding (which
# points at client/dist) has a directory to read from.
RUN mkdir -p client/dist && \
    echo '<!doctype html><html><body>Admin client build skipped</body></html>' > client/dist/index.html

# Expose port
EXPOSE 80

# Start the server using wrangler dev. The local D1 database starts empty,
# so apply the schema before starting (wrangler dev simulates D1 locally
# and never runs migrations on its own).
CMD ["sh", "-c", "npx wrangler d1 execute roster-lock-db --local --file=./server/src/version-1/schema/tables.sql && npx wrangler dev --ip 0.0.0.0 --port 80"]
