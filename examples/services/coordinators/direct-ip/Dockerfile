# Direct-IP Coordinator Dockerfile
# Standalone game coordinator service for roster-lock's direct-tcp
# connection mode - not tied to any one game-launcher plugin, only to
# @roster-lock/direct-ip-coordinator's rendezvous protocol.
#
# Build context must be the repo root: this package depends on the local
# @roster-lock/types, @roster-lock/utils and @roster-lock/direct-ip-coordinator
# workspace packages via "workspace:*", resolved through the pnpm workspace,
# so their metadata and source need to be present alongside it inside the
# image too.

FROM node:20-alpine

RUN apk add --no-cache curl
RUN corepack enable

WORKDIR /app

# Workspace metadata + just the package.json files needed to resolve this
# service's dependency subset, so the install layer caches independently of
# unrelated source changes elsewhere in the monorepo.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY core/types/package.json core/types/
COPY core/utils/package.json core/utils/
COPY plugins/game-launcher/shared/direct-ip-coordinator/package.json plugins/game-launcher/shared/direct-ip-coordinator/
COPY examples/services/coordinators/direct-ip/package.json examples/services/coordinators/direct-ip/

RUN pnpm install --filter @roster-lock/direct-ip-coordinator-service... --frozen-lockfile --ignore-scripts

# Copy source code
COPY core/types/ core/types/
COPY core/utils/ core/utils/
COPY plugins/game-launcher/shared/direct-ip-coordinator/ plugins/game-launcher/shared/direct-ip-coordinator/
COPY examples/services/coordinators/direct-ip/ examples/services/coordinators/direct-ip/

# Build @roster-lock/utils, @roster-lock/direct-ip-coordinator and the
# service itself, in dependency order.
RUN pnpm --filter @roster-lock/direct-ip-coordinator-service... run build

WORKDIR /app/examples/services/coordinators/direct-ip

# HTTP (webhooks) and TCP (rendezvous) both need to be reachable from the
# host, since match-agent (running a direct-tcp game-launcher plugin) is a
# host process, not another docker-compose service.
EXPOSE 80
EXPOSE 9010

CMD ["node", "dist/index.js"]
