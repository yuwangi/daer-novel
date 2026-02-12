import dotenv from 'dotenv';
import path from 'path';

// Load .env files with priority: .env.local > .env
// Path resolution: src/init-env.ts -> apps/backend/src -> apps/backend -> apps -> root
const rootDir = path.resolve(__dirname, '../../..');
const envLocalPath = path.join(rootDir, '.env.local');
const envPath = path.join(rootDir, '.env');

// First load .env (base configuration)
const envConfig = dotenv.config({ path: envPath });
if (envConfig.error) {
  console.warn('⚠️  .env file not found at:', envPath);
} else {
  console.log('🔌 Base environment loaded from:', envPath);
}

// Then load .env.local (overrides)
const localEnvConfig = dotenv.config({ path: envLocalPath, override: true });
if (!localEnvConfig.error) {
  console.log('🔌 Local environment overrides loaded from:', envLocalPath);
}

// Validate critical variables here to fail fast
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET is not set');
  process.exit(1);
}

if (process.env.GOOGLE_CLIENT_ID) {
  console.log('✅ Google Client ID loaded');
}
