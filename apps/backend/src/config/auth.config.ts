import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../database';
import * as schema from '../database/schema';
import { emailService } from '../services/email.service';

export const auth: any = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, 
    minPasswordLength: 6,
    maxPasswordLength: 32,
    sendResetPassword: async (user, url) => {
      await emailService.sendPasswordResetEmail(user.email, url);
    },

  },

  emailVerification: {
    async sendVerificationEmail(user, url) {
      await emailService.sendVerificationEmail(user.email, url);
    },
    sendOnSignUp: false,
  },

  plugins: [],
  
  baseURL: process.env.AUTH_BASE_URL || process.env.BASE_URL || 'http://localhost:8002/api/auth',
  
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },
  
  secret: process.env.BETTER_AUTH_SECRET!,
  
  trustedOrigins: [
    'http://localhost:8001',
    'tauri://localhost',
    'http://tauri.localhost',
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : []),
  ],
  
  advanced: {
    generateId: () => crypto.randomUUID(), 
    useSecureCookies: false, // Force disable secure cookies for localhost dev
    defaultCookieAttributes: {
      sameSite: 'lax', // Allow cookies to be sent on top-level navigation (redirects)
      secure: false,   // Ensure this matches useSecureCookies
      httpOnly: true,  // Security best practice
      path: '/',       // Available everywhere
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
