'use client';
import { API } from '@/lib/auth';
import SocketProvider from '@/providers/SocketProvider';

export default function SocketProviderShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SocketProvider
      cookieName="u_token" // Use non-httpOnly token for client-side Socket.IO
      onAuthExpired={async () => {
        // runs on the client; ok to call your refresh endpoint here
        await fetch(`${API}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
      }}
    >
      {children}
    </SocketProvider>
  );
}
