# Auth Naive Service Dockerfile
# Runs a local version of the username-only Cloudflare Workers auth service
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
COPY examples/services/auth-naive/package.json examples/services/auth-naive/

RUN pnpm install --filter @roster-lock/auth-naive-service... --frozen-lockfile

COPY examples/services/auth-naive/ examples/services/auth-naive/

WORKDIR /app/examples/services/auth-naive

EXPOSE 80

# Start the server using wrangler dev. The local D1 database starts empty,
# so apply the schema before starting (wrangler dev simulates D1 locally
# and never runs migrations on its own).
CMD ["sh", "-c", "npx wrangler d1 execute roster-lock-auth-naive-service-db --local --file=./src/db/schema.sql && npx wrangler dev --ip 0.0.0.0 --port 80"]
