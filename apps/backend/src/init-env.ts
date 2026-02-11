import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
// Path resolution: src/init-env.ts -> apps/backend/src -> apps/backend -> apps -> root
const envPath = path.resolve(__dirname, '../../../.env');

dotenv.config({ path: envPath });

console.log('🔌 Environment variables initialized from:', envPath);

// Validate critical variables here to fail fast
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET is not set');
  process.exit(1);
}

if (process.env.GOOGLE_CLIENT_ID) {
  console.log('✅ Google Client ID loaded');
}
