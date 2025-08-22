'use server';

import { API } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function registerAction(data: {
  username: string;
  password: string;
  displayName?: string;
}) {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
    // no credentials needed; register doesn't set cookies
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || 'registration_failed');
  }

  // after register, we do not sign-in automatically; redirect to login page
  return { ok: true };
}
