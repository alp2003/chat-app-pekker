// app/(protected)/page.tsx
import { cookies } from 'next/headers';
import { getMe, listConversations } from '@/lib/api';
import Logger from '@/lib/logger';
import ProtectedPageClient from './page.client';

// Force dynamic rendering since this route requires authentication
export const dynamic = 'force-dynamic';

export default async function ProtectedPage() {
  let initialData = null;

  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access')?.value;

    if (accessToken) {
      Logger.api.log('✅', 'Access token found - client will handle data fetching');
    } else {
      Logger.api.log('⚠️', 'No access token found - client will bootstrap');
    }
    
    // Always use client-side bootstrap to avoid server-side authentication issues
    // The client-side has proper cookie handling and refresh token logic
    initialData = null;
  } catch (error) {
    Logger.api.error('❌', 'Protected page error:', error);
    // Fall back to client-side bootstrap
    initialData = null;
  }

  return <ProtectedPageClient initialData={initialData} />;
}
