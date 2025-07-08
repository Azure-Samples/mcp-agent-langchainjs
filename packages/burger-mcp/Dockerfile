# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY ./packages/burger-mcp ./packages/burger-mcp
RUN npm ci --workspace=burger-mcp --cache /tmp/empty-cache
RUN npm run build --workspace=burger-mcp

# Production stage
FROM node:22-alpine AS production
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/burger-mcp/package.json ./packages/burger-mcp/
COPY --from=builder /app/packages/burger-mcp/lib ./packages/burger-mcp/lib
RUN npm ci --omit=dev --workspace=burger-mcp --cache /tmp/empty-cache
# Use a non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser
ENV NODE_ENV=production

CMD ["node", "./packages/burger-mcp/lib/server.js"]
