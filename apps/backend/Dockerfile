# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace configs
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc* ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/


# Install dependencies (Cache busted 2026-02-12-1100)
RUN pnpm install --frozen-lockfile=false

# Copy source
COPY . .

# Build backend
RUN pnpm --filter backend build

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app

# Install pnpm for running scripts
RUN npm install -g pnpm

# Copy root configs
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/backend/package.json ./apps/backend/

# Install only production dependencies for backend
RUN pnpm install --prod --filter backend --frozen-lockfile=false

# Copy built files from stage 1
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

EXPOSE 8002

CMD ["pnpm", "--filter", "backend", "start"]

