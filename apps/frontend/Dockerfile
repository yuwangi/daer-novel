FROM node:18-alpine AS builder

WORKDIR /app

# Copy root config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc* ./

COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

# Install dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile=false

# Copy source code
COPY . .

# Build frontend (static export to apps/frontend/out)
RUN pnpm --filter frontend build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy static files from builder
COPY --from=builder /app/apps/frontend/out /usr/share/nginx/html

# Copy custom Nginx config if needed (optional, using default for now)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
