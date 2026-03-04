import { NextRequest, NextResponse } from 'next/server';

// Public routes that don't require auth
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
];

const SESSION_COOKIE = 'better-auth.session_token';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths, Next.js internals and static files through
  const isPublic =
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.');

  if (isPublic) return NextResponse.next();

  // Check for session cookie – no API call needed, runs at the Edge
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    // Preserve the originally requested URL so we can redirect back after login
    loginUrl.searchParams.set('callbackUrl', pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Match every path except Next.js internals and static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
