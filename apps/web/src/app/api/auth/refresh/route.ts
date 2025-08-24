import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function POST(req: NextRequest) {
  const start = performance.now();
  console.log('🔄 Refresh API route called');

  const cookieHeader = req.headers.get('cookie') || '';
  console.log('🍪 Incoming cookie header:', cookieHeader ? 'EXISTS' : 'EMPTY');
  console.log('🍪 Cookie length:', cookieHeader.length);
  if (cookieHeader) {
    console.log('🍪 Cookie preview:', cookieHeader.substring(0, 200) + (cookieHeader.length > 200 ? '...' : ''));
  }

  // Forward the refresh request to the backend
  const response = await fetch(`${API}/auth/refresh`, {
    method: 'POST',
    headers: {
      cookie: cookieHeader,
      'user-agent': req.headers.get('user-agent') || '',
    },
    // Don't use credentials: 'include' with manual cookie forwarding
  });

  const backendTime = Math.round(performance.now() - start);
  console.log(
    '🔄 Backend refresh response:',
    response.status,
    response.statusText,
    `(${backendTime}ms)`
  );

  // Get the response data
  const responseData = await response.text();

  // Create the response to send back
  const nextResponse = new NextResponse(responseData, {
    status: response.status,
    statusText: response.statusText,
  });

  // Forward all headers from the backend response
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') {
      nextResponse.headers.set(key, value);
    }
  });

  // Handle cookies manually to also set the non-httpOnly cookie for Socket.io
  if (response.ok) {
    const setCookieHeaders = response.headers.getSetCookie();
    console.log('🍪 Setting', setCookieHeaders.length, 'cookies...');

    // Parse and set each cookie - optimized version
    setCookieHeaders.forEach(cookieHeader => {
      const [nameValue, ...attributes] = cookieHeader.split(';');
      if (!nameValue) return;

      const [name, value] = nameValue.split('=');
      if (!name || !value) return;

      // Simplified cookie options
      const cookieOptions: {
        httpOnly: boolean;
        sameSite: 'lax';
        secure: boolean;
        path: string;
        maxAge?: number;
        expires?: Date;
      } = {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      };

      // Only parse essential attributes
      attributes.forEach(attr => {
        const [attrName, attrValue] = attr.trim().split('=');
        if (attrName?.toLowerCase() === 'max-age' && attrValue) {
          cookieOptions.maxAge = parseInt(attrValue);
        } else if (attrName?.toLowerCase() === 'expires' && attrValue) {
          cookieOptions.expires = new Date(attrValue);
        }
      });

      nextResponse.cookies.set(name.trim(), value.trim(), cookieOptions);
    });

    // Set the non-httpOnly access token for Socket.io
    const accessCookie = setCookieHeaders.find(cookie =>
      cookie.startsWith('access=')
    );
    if (accessCookie) {
      const tokenMatch = accessCookie.match(/access=([^;]+)/);
      const accessToken = tokenMatch?.[1];

      if (accessToken) {
        nextResponse.cookies.set('u_token', accessToken, {
          httpOnly: false,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 300,
        });
      }
    }

    const totalTime = Math.round(performance.now() - start);
    console.log('✅ Refresh complete', `(${totalTime}ms total)`);
  }

  return nextResponse;
}
