import '../init-env';
import { db, schema } from './index';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';

async function seed() {
  try {
    logger.info('Seeding database...');

    // Create demo user
    const hashedPassword = await bcrypt.hash('demo123', 10);
    const [user] = await db
      .insert(schema.user)
      .values({
        id: crypto.randomUUID(),
        email: 'demo@daer-novel.com',
        password: hashedPassword,
        name: 'Demo User',
      })
      .returning();

    logger.info(`Created demo user: ${user.email}`);

    // Create demo AI config
    await db.insert(schema.aiConfigs).values({
      userId: user.id,
      provider: 'openai',
      model: 'gpt-4',
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
      baseUrl: 'https://api.openai.com/v1',
      parameters: {
        temperature: 0.7,
        maxTokens: 4000,
      },
      isDefault: 1,
    });

    logger.info('Seed completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
