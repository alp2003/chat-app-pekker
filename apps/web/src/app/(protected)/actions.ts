// apps/web/src/app/(protected)/actions.ts
'use server';
import { ACCESS_COOKIE, API } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function refreshAction() {
  // NOTE: This only works reliably when your API shares the same site so that
  // the browser can set the refresh cookie for the API origin.
  const res = await fetch(`${API}/auth/refresh`, {
    method: 'POST',
    credentials: 'include' as any,
    // If API is another origin, ensure CORS+cookies are configured correctly.
  });
  if (!res.ok) return false;
  const { access } = await res.json();
  if (access) {
    (await cookies()).set('u_token', access, {
      httpOnly: false, // Non-httpOnly for client-side Socket.IO access
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 300, // 5 minutes for testing to eliminate race conditions
    });
    return true;
  }
  return false;
}
