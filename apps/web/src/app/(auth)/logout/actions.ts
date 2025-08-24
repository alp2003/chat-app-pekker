'use server';

import { API, ACCESS_COOKIE } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function logoutAction() {
  try {
    // 1. Revoke session on server first (most important)
    const response = await fetch(`${API}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Don't fail if server logout fails (server might be down)
    if (!response.ok) {
      console.warn('Server logout failed, continuing with client cleanup');
    }
  } catch (error) {
    console.warn('Server logout error:', error);
    // Continue with client-side cleanup even if server fails
  }

  try {
    // 2. Clear all authentication cookies (critical for security)
    const cookieStore = await cookies();
    
    // Clear HTTP-only cookies
    cookieStore.delete('access');
    cookieStore.delete('refresh');
    
    // Clear client-accessible cookies
    cookieStore.delete('u_token');
    cookieStore.delete('u_name');
    
    // Clear any other auth-related cookies
    cookieStore.delete('session_id'); // if you have one
    
  } catch (error) {
    console.error('Cookie cleanup failed:', error);
  }

  return { ok: true };
}
