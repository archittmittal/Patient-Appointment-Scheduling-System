# syntax=docker/dockerfile:1.7
# ─── Root Dockerfile (Hugging Face Spaces / generic deployment) ────────────────
# Multi-stage, non-root, reproducible. Matches the Node version pinned in
# backend/.nvmrc (20) and the `engines` field in package.json.

# ---------- Stage 1: deps ----------
FROM node:20-alpine AS deps
WORKDIR /app/backend

# Install only what's needed to resolve the lockfile (package manager + git
# for any git-based deps). libc6-compat satisfies native modules on alpine.
RUN apk add --no-cache libc6-compat

# Copy lockfile + manifest first to maximise layer caching.
COPY backend/package.json backend/package-lock.json ./

# Reproducible install from lockfile, production dependencies only.
RUN npm ci --omit=dev && npm cache clean --force

# ---------- Stage 2: runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app/backend

# curl is needed for the HEALTHCHECK below.
RUN apk add --no-cache curl tini \
    && addgroup -S node && adduser -S node -G node

# Copy installed node_modules from the deps stage.
COPY --from=deps /app/backend/node_modules ./node_modules

# Copy application source. (.dockerignore keeps secrets/logs out of the image.)
COPY backend/ ./

# Run as a non-root user.
USER node

ENV NODE_ENV=production \
    PORT=7860

EXPOSE 7860

# tini reaps zombie processes and handles signals (needed for graceful shutdown).
ENTRYPOINT ["/sbin/tini", "--"]

# Health check hits the app's own /api/health endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fs http://localhost:${PORT}/api/health || exit 1

CMD ["node", "src/server.js"]
