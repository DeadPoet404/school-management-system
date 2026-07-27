# ── Stage 1: Builder ──
FROM node:20-alpine AS builder
WORKDIR /app

# Prisma selects its engine variant from the OpenSSL version present at
# install time. The runner stage installs openssl 3, so it detects the
# platform as linux-musl-openssl-3.0.x. Without openssl here, npm ci
# downloads plain linux-musl engines instead, leaving no matching
# schema-engine in the image - so `prisma migrate deploy` tries to fetch
# one from binaries.prisma.sh on every boot and the container crash-loops
# whenever that host is unreachable. Keep both stages on the same platform.
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY tsconfig.json tsconfig.seed.json ./
COPY src ./src/
# Compile main application — tsc-alias resolves @/* path aliases
RUN npm run build

# Compile seed separately using its own tsconfig that includes prisma/seed.ts
# tsc-alias must also run on it to resolve @/* imports in the seed
RUN npx tsc --project tsconfig.seed.json && npx tsc-alias --project tsconfig.seed.json

# Preserve Prisma CLI before prune removes it
RUN cp -r node_modules/prisma /tmp/prisma-cli

RUN npm prune --production

# ── Stage 2: Runtime ──
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl wget libc6-compat

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /tmp/prisma-cli ./node_modules/prisma
COPY --from=builder --chown=appuser:appgroup /app/package.json ./package.json
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
# Copy compiled seed script
COPY --from=builder --chown=appuser:appgroup /app/dist-seed ./dist-seed

COPY --chown=appuser:appgroup docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER appuser
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
