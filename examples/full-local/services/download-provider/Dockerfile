# Download Provider Dockerfile
# Serves piece file listings and tarballs
#
# Build context must be the repo root: this package is a pnpm workspace
# member, so its dependencies are pinned via the workspace's pnpm-lock.yaml.

FROM node:20-alpine

# Install curl for healthcheck + tar for creating archives
RUN apk add --no-cache curl tar
RUN corepack enable

WORKDIR /app

# Workspace metadata + just the package.json needed to resolve this
# service's dependencies, so the install layer caches independently of
# unrelated source changes elsewhere in the monorepo.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY examples/full-local/services/download-provider/package.json examples/full-local/services/download-provider/

RUN pnpm install --filter @roster-lock/download-provider --frozen-lockfile --ignore-scripts

# Copy source code
COPY examples/full-local/services/download-provider/ examples/full-local/services/download-provider/

# Build TypeScript
RUN pnpm --filter @roster-lock/download-provider run build

WORKDIR /app/examples/full-local/services/download-provider

# Expose port
EXPOSE 80

# Start the server
CMD ["node", "dist/index.js"]
