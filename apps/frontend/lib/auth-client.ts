import { createAuthClient } from 'better-auth/react';
import { genericOAuthClient } from 'better-auth/client/plugins';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002';

export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`,
  plugins: [
    genericOAuthClient(),
  ],
});

export const { 
  signIn, 
  signUp, 
  signOut, 
  useSession,
  forgetPassword,
  resetPassword,
} = authClient;

// OAuth helpers
export const signInWithGitHub = () => signIn.social({ 
  provider: 'github',
  callbackURL: '/',
});
export const signInWithGoogle = () => signIn.social({ 
  provider: 'google',
  callbackURL: '/',
});
export const signInWithLinuxDo = () => (authClient.signIn as any).oauth2({ 
  providerId: 'linuxdo',
  callbackURL: '/',
});
