FROM node:22-slim AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_APP_ENV=production
ARG BACKEND_URL=http://localhost:5000
# Deployment identity (passed by CI): guarantees a fresh image digest per
# deploy so `docker compose up -d` always recreates the container.
ARG GIT_SHA=unknown

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV}
ENV BACKEND_URL=${BACKEND_URL}
ENV GIT_SHA=${GIT_SHA}

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN mkdir -p public

RUN npm run build


FROM node:22-alpine AS runner

RUN apk add --no-cache wget

RUN addgroup -S appgroup \
    && adduser -S appuser -G appgroup

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=appuser:appgroup /app/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup /app/.next/static ./.next/static
COPY --from=builder --chown=appuser:appgroup /app/public ./public

USER appuser

EXPOSE 3000

HEALTHCHECK \
  --interval=30s \
  --timeout=5s \
  --start-period=30s \
  --retries=3 \
  CMD wget -qO- http://localhost:3000/ >/dev/null || exit 1

CMD ["node", "server.js"]
