// middleware.ts
import { ACCESS_COOKIE } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get('refresh')?.value;
  const isAuth =
    pathname.startsWith('/login') || pathname.startsWith('/register');
  const isProtected = pathname === '/' || pathname.startsWith('/chat');

  // Debug logging - show all cookies
  const allCookies = req.cookies
    .getAll()
    .map(cookie => `${cookie.name}=${cookie.value.slice(0, 20)}`);
  console.log(
    '🍪 Current cookies before expiration:',
    allCookies.join(', ') || 'none'
  );
  
  // Specifically check for u_name cookie
  const uNameCookie = req.cookies.get('u_name')?.value;
  console.log('👤 u_name cookie in middleware:', uNameCookie || 'NOT FOUND');

  // Debug logging
  console.log('🔒 Middleware check:', {
    pathname,
    hasAccessToken: !!token,
    hasRefreshToken: !!refreshToken,
    isAuth,
    isProtected,
  });

  if (isProtected) {
    // Allow access if we have either access token OR refresh token
    // The client-side code will handle token refresh if needed
    if (token || refreshToken) {
      console.log('✅ Middleware: Access granted');
      return NextResponse.next();
    }

    // No tokens at all, redirect to login
    console.log('❌ Middleware: Redirecting to login - no tokens found');
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname + (search || ''));
    return NextResponse.redirect(url);
  }

  if (isAuth && (token || refreshToken)) {
    console.log('🔄 Middleware: Auth page with tokens - redirecting to home');
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ['/', '/chat/:path*', '/login', '/register'] };
