FROM node:18-alpine

WORKDIR /app

# Copy root config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc* ./

# Check if apps exist before copying to avoid errors if structure differs, 
# but for this specific repo we know the structure.
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

# Install dependencies for all workspaces
RUN npm install -g pnpm && pnpm install --frozen-lockfile=false

# Copy source code (respects .dockerignore)
COPY . .

# Build backend
RUN pnpm --filter backend build

EXPOSE 8002

# We stay in root WORKDIR /app, so we run commands from there
CMD ["pnpm", "--filter", "backend", "start"]
