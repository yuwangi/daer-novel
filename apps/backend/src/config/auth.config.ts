import { betterAuth } from 'better-auth';
import { genericOAuth } from "better-auth/plugins"
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

  plugins: [
    genericOAuth({ 
      config: [ 
        { 
          providerId: "linuxdo", 
          clientId: process.env.LINUXDO_CLIENT_ID!, 
          clientSecret: process.env.LINUXDO_CLIENT_SECRET!, 
          authorizationEndpoint: "https://connect.linux.do/oauth2/authorize",
          tokenEndpoint: "https://connect.linux.do/oauth2/token",
          userEndpoint: "https://connect.linux.do/api/user",
        }, 
      ] 
    }) 
  ],
  
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
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : []),
  ],
  
  advanced: {
    generateId: () => crypto.randomUUID(), 
    useSecureCookies: process.env.NODE_ENV === 'production', 
    defaultCookieAttributes: {
      sameSite: 'lax', 
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,  
      path: '/',       
    },
  },
  
  onEvent: {
    async sessionCreated(data: any) {
      console.log(`[Auth] Session created for user: ${data.session.userId}`);
    },
    async sessionDeleted(id: string) {
      console.log(`[Auth] Session deleted: ${id}`);
    },
    async userCreated(data: any) {
      console.log(`[Auth] New user created: ${data.user.email}`);
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
