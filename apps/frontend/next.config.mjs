/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed `output: 'export'` to allow Next.js Middleware (auth redirect) to work.
  // Static export is incompatible with middleware and server-side features.
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules', '**/src-tauri', '**/out', '**/.git'],
      };
    }
    return config;
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002',
  },
};

export default nextConfig;
