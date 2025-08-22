import { NextRequest } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function GET(req: NextRequest) {
  // Forward the request to the existing users/me endpoint
  return fetch(`${API}/users/me`, {
    method: 'GET',
    credentials: 'include' as RequestCredentials,
    headers: {
      // Forward cookies as well
      cookie: req.headers.get('cookie') || '',
    },
  });
}
