import SocketProviderShell from './SocketProviderShell';
import TokenRefreshWrapper from '@/components/TokenRefreshWrapper';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TokenRefreshWrapper>
      <SocketProviderShell>{children}</SocketProviderShell>
    </TokenRefreshWrapper>
  );
}
