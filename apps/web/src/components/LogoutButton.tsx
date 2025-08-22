'use client';
import { logoutAction } from '@/app/(auth)/logout/actions';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function LogoutBtn() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        await logoutAction();
        router.replace('/login');
      }}
    >
      Logout
    </Button>
  );
}
