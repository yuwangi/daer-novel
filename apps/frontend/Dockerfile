FROM node:18-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy root configurations
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc* ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

# Install dependencies (all, including devDeps for build)
RUN pnpm install --frozen-lockfile=false --ignore-scripts

# Copy entire source
COPY . .

# Build args
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NODE_ENV production

# Build the frontend (outputs to apps/frontend/out)
RUN pnpm --filter frontend build

# Final Stage: Nginx
FROM nginx:alpine

# Copy static files from builder
COPY --from=builder /app/apps/frontend/out /usr/share/nginx/html

# Copy custom Nginx config
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
