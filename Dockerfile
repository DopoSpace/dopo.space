# Dockerfile for Dopo Space
# Optimized for Coolify/Docker deployment with Node.js 24

# Build stage
FROM node:24-slim AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client (use pnpm exec to use locked version)
RUN pnpm exec prisma generate

# Build the application
RUN pnpm build

# Production stage
FROM node:24-slim AS production

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package.json (needed for node to resolve modules)
COPY package.json ./
COPY prisma ./prisma/

# Copy node_modules from builder (includes generated Prisma client)
# Using full node_modules avoids pnpm symlink issues with --prod
COPY --from=builder /app/node_modules ./node_modules

# Copy built application from builder
COPY --from=builder /app/build ./build

# Copy scripts for admin management
COPY scripts ./scripts

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 sveltekit && \
    chown -R sveltekit:nodejs /app

USER sveltekit

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start the application
CMD ["node", "build"]
