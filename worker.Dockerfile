# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS iqtree-binary
ARG IQTREE_VERSION=3.1.3
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
WORKDIR /tmp/iqtree
# Checksums independently verified against GitHub's release API `digest` field
# AND a fresh local sha256sum of the downloaded tarball during development -
# see the project plan for how. Re-verify both before bumping IQTREE_VERSION.
RUN set -eux; \
    case "$TARGETARCH" in \
      amd64) ASSET="iqtree-${IQTREE_VERSION}-Linux-intel.tar.gz"; \
             SHA256="ac87dee78d06b67a1be87fff4a325358d038b5ae947308e52b3cf23829521aa8" ;; \
      arm64) ASSET="iqtree-${IQTREE_VERSION}-Linux-arm.tar.gz"; \
             SHA256="4e3dac3e2946f70a6672a013f616a0d1f773f0db5be562ce87d64806c7537c7f" ;; \
      *) echo "Unsupported TARGETARCH: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o iqtree.tar.gz "https://github.com/iqtree/iqtree3/releases/download/v${IQTREE_VERSION}/${ASSET}"; \
    echo "${SHA256}  iqtree.tar.gz" | sha256sum -c -; \
    mkdir -p /opt/iqtree3; \
    tar xzf iqtree.tar.gz --strip-components=1 -C /opt/iqtree3; \
    chmod +x /opt/iqtree3/bin/iqtree3

FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# The generated Prisma client (src/generated/prisma) is TypeScript source
# written assuming a bundler-style consumer (extensionless relative imports,
# `import.meta.url`) - Next.js's bundler handles that natively for the app,
# but the worker has no bundler. It runs via `tsx` (esbuild-based, resolves
# the same way a bundler would) instead of a separate tsc-to-CommonJS build
# step, which cannot represent `import.meta` and can't resolve those
# extensionless imports as real Node ESM. `prisma generate` needs a full
# `npm ci` (the `prisma` CLI is a devDependency-shaped tool but is kept in
# "dependencies" here since the `migrate` compose service also needs it).
FROM node:22-bookworm-slim AS prisma-gen
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma7.config.ts ./
COPY scripts ./scripts
RUN npx prisma generate && node scripts/mark-prisma-esm.mjs

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=iqtree-binary /opt/iqtree3/bin/iqtree3 /usr/local/bin/iqtree3
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prisma-gen /app/src/generated ./src/generated
COPY package.json tsconfig.worker.json ./
COPY worker ./worker
COPY src/lib ./src/lib

CMD ["node_modules/.bin/tsx", "worker/iqtreeworker.ts"]
