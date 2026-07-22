# ── Stage 1: Builder ──
# Uses node:20-slim (Debian/glibc) because Next.js SWC native binaries
# are compiled against glibc. Alpine (musl) cannot load the gnu variant
# and the musl variant must be explicitly present in package-lock.json.
# Using slim here avoids the SWC binary mismatch entirely.
# The runner stage stays Alpine for a small final image.
FROM node:20-slim AS builder
WORKDIR /app

# NEXT_PUBLIC_* variables must be present at BUILD TIME for Next.js
# to inline them into the client bundle. Passing as ARG here and
# converting to ENV makes them available to "next build".
ARG NEXT_PUBLIC_API_URL=/api
ARG BACKEND_URL=http://localhost:5000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV BACKEND_URL=${BACKEND_URL}

COPY package.json package-lock.json ./
RUN npm ci

# Copy full source
COPY . .

# Ensure public dir exists even if empty
RUN mkdir -p public

RUN npm run build

# ── Stage 2: Runtime ──
# Alpine is fine for the runner — it only executes the pre-compiled
# standalone server.js bundle, no native compilation needed.
FROM node:20-alpine AS runner

# wget — used by HEALTHCHECK
RUN apk add --no-cache wget

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Next.js standalone output bundles server + node_modules together.
# The standalone server.js needs the static files and public dir
# copied alongside it — they are NOT embedded in the bundle.
COPY --from=builder --chown=appuser:appgroup /app/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup /app/.next/static ./.next/static
COPY --from=builder --chown=appuser:appgroup /app/public ./public

USER appuser
EXPOSE 3000

# start-period accounts for Next.js server cold-start time.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
