'use server';

import { API, ACCESS_COOKIE } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function logoutAction() {
  // ask API to revoke refresh
  await fetch(`${API}/auth/logout`, {
    method: 'POST',
    credentials: 'include' as any,
  });
  const c = await cookies();
  c.delete('access'); // Delete httpOnly access token
  c.delete('u_token'); // Delete non-httpOnly access token for Socket.IO
  c.delete('refresh'); // Delete httpOnly refresh token
  c.delete('u_name'); // Delete username cookie
  return { ok: true };
}
