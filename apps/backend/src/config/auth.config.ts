import { betterAuth } from 'better-auth';
import { genericOAuth } from "better-auth/plugins"
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../database';
import * as schema from '../database/schema';
import { emailService } from '../services/email.service';

// Validate LinuxDo OAuth environment variables
const LINUXDO_CLIENT_ID = process.env.LINUXDO_CLIENT_ID;
const LINUXDO_CLIENT_SECRET = process.env.LINUXDO_CLIENT_SECRET;

if (!LINUXDO_CLIENT_ID || !LINUXDO_CLIENT_SECRET) {
  console.warn('[Auth Config] ⚠️  LinuxDo OAuth is not fully configured. Missing CLIENT_ID or CLIENT_SECRET.');
  console.warn('[Auth Config] LinuxDo authentication will not be available until these are set.');
}

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
    ...(LINUXDO_CLIENT_ID && LINUXDO_CLIENT_SECRET ? [
      genericOAuth({
        config: [
          {
            providerId: "linuxdo",
            clientId: LINUXDO_CLIENT_ID,
            clientSecret: LINUXDO_CLIENT_SECRET,
            authorizationUrl: "https://connect.linux.do/oauth2/authorize",
            tokenUrl: "https://connect.linux.do/oauth2/token",
            userInfoUrl: "https://connect.linux.do/api/user",
            scopes: ["openid", "profile", "email"],
            getUserInfo: async (tokens) => {
              const response = await fetch("https://connect.linux.do/api/user", {
                headers: {
                  Authorization: `Bearer ${tokens.accessToken}`
                }
              });
              const user: any = await response.json();
              console.log('-------- LinuxDo User Info:', user);
              const now = new Date();
              return {
                id: String(user.id || user.sub),
                name: user.name || user.username || user.login || 'LinuxDo User',
                email: user.email,
                emailVerified: true,
                image: user.avatar_url || user.picture,
                createdAt: now,
                updatedAt: now,
              };
            }
          },
        ]
      })
    ] : []),
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
    useSecureCookies: false, // process.env.NODE_ENV === 'production', // DEBUG: Temporarily disable secure cookies
    defaultCookieAttributes: {
      sameSite: 'lax', 
      secure: false, // process.env.NODE_ENV === 'production', // DEBUG
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
    onError(context: any) {
      console.error("[Auth] Error:", context.error);
    },
  },
  
  // Important for proxies: Trust the host header
  trustHost: true,
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;

// Log the available OAuth providers for debugging
console.log('[Auth Config] Better Auth initialized');
console.log('[Auth Config] Configured OAuth providers:', {
  hasLinuxDo: !!(LINUXDO_CLIENT_ID && LINUXDO_CLIENT_SECRET),
  linuxDoClientId: LINUXDO_CLIENT_ID ? `${LINUXDO_CLIENT_ID.substring(0, 8)}...` : 'NOT SET'
});
