import { createAuthClient } from 'better-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002';

export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`, 
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
