# Game Server Dockerfile
# WebRTC signaling and game coordination service
#
# Build context must be the repo root: this package depends on the local
# @roster-lock/utils workspace package via "file:../../../../core/utils",
# resolved through the pnpm workspace, so the workspace metadata and
# core/utils need to be present alongside it inside the image too.

FROM node:20-alpine

RUN apk add --no-cache curl
RUN corepack enable

WORKDIR /app

# Workspace metadata + just the package.json files needed to resolve this
# service's dependency subset, so the install layer caches independently
# of unrelated source changes elsewhere in the monorepo.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY core/utils/package.json core/utils/
COPY examples/full-local/services/game-server/package.json examples/full-local/services/game-server/

RUN pnpm install --filter @match-lock/game-server-example... --frozen-lockfile --ignore-scripts

# Copy source code
COPY core/utils/ core/utils/
COPY examples/full-local/services/game-server/ examples/full-local/services/game-server/

# Build @roster-lock/utils and the service itself, in dependency order
RUN pnpm --filter @match-lock/game-server-example... run build

WORKDIR /app/examples/full-local/services/game-server

# Expose port
EXPOSE 80

# Start the server
CMD ["node", "dist/index.js"]
