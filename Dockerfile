# syntax=docker/dockerfile:1
# Build React, then pack backend into a binary with pkg to avoid shipping source.
FROM node:20-bullseye AS builder
WORKDIR /app

# Install deps (cache-friendly)
COPY package*.json ./
COPY scripts ./scripts
RUN npm ci

# Copy source
COPY . .

# Build frontend
RUN npm run build

# Build pkg binary (Linux x64)
RUN npx pkg server.js --targets node20-linux-x64 --output dist/parana-network

FROM debian:bullseye-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Minimal runtime deps (if any), otherwise keep image lean
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

# Copy binary and static assets
COPY --from=builder /app/dist/parana-network /app/parana-network
COPY --from=builder /app/build /app/build
COPY --from=builder /app/Login /app/Login
COPY --from=builder /app/public /app/public

EXPOSE 4000
ENTRYPOINT ["/app/parana-network"]
