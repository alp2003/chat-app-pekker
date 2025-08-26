'use server';

import { API, ACCESS_COOKIE } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function loginAction(data: {
  username: string;
  password: string;
}) {
  console.log('🔑 Server action - calling backend directly for cookies...');

  // Call backend directly to get proper Set-Cookie response
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include' as any,
  });

  console.log('🔑 Backend login response:', res.status, res.statusText);

  if (!res.ok) {
    const msg = await res.text();
    console.log('❌ Login failed:', msg);
    throw new Error(msg || 'login_failed');
  }

  const json = await res.json(); // { user } (access token now comes via Set-Cookie)
  console.log('✅ Login successful:', json);

  // Get the cookies from backend response and set them manually
  const setCookieHeaders = res.headers.getSetCookie();
  console.log('🍪 Backend Set-Cookie headers:', setCookieHeaders);

  const c = await cookies();

  // Parse and set each cookie manually
  for (const cookieHeader of setCookieHeaders) {
    const [nameValue, ...attributes] = cookieHeader
      .split(';')
      .map(s => s.trim());
    if (!nameValue) continue;

    const [name, value] = nameValue.split('=');
    if (!name || !value) continue;

    console.log(`🍪 Setting cookie: ${name}`);

    if (name === 'access' || name === 'refresh') {
      // Parse cookie attributes
      const options: any = {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
      };

      for (const attr of attributes) {
        if (attr.startsWith('Max-Age=')) {
          const maxAgeValue = attr.split('=')[1];
          if (maxAgeValue) {
            options.maxAge = parseInt(maxAgeValue);
          }
        } else if (attr.startsWith('Expires=')) {
          // Convert to maxAge for better browser compatibility
          const expiresValue = attr.split('=')[1];
          if (expiresValue) {
            const expireDate = new Date(expiresValue);
            options.maxAge = Math.floor(
              (expireDate.getTime() - Date.now()) / 1000
            );
          }
        }
      }

      c.set(name, value, options);
    }
  }

  // Also set the non-httpOnly token for Socket.io
  const accessCookie = setCookieHeaders.find(cookie =>
    cookie.startsWith('access=')
  );

  if (accessCookie) {
    const tokenMatch = accessCookie.match(/access=([^;]+)/);
    const accessToken = tokenMatch?.[1];

    if (accessToken) {
      c.set('u_token', accessToken, {
        httpOnly: false, // readable by client (SocketProvider)
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60, // 1 hour for testing to eliminate race conditions
      });
    }
  }

  // Store lightweight user context (non-sensitive)
  const username = json.user?.username || json.username || '';
  console.log('👤 Setting u_name cookie:', { 
    fullJson: json, 
    userObject: json.user, 
    username: username,
    willSetCookie: username !== ''
  });
  
  if (username) {
    c.set('u_name', username, { 
      path: '/', 
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 // 1 hour - align with access token expiration
    });
    console.log('✅ u_name cookie set with value:', username);
    
    // Verify the cookie was set
    const cookieCheck = (await cookies()).get('u_name');
    console.log('🔍 Cookie verification after setting:', cookieCheck?.value || 'NOT FOUND');
  } else {
    console.warn('⚠️ No username found in response - u_name cookie not set');
  }

  console.log('🍪 All cookies set in server action');

  // Return success instead of redirecting - let client handle redirect
  return { ok: true };
}
