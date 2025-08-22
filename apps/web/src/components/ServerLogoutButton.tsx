import { Button } from '@/components/ui/button';
import { logoutAction } from '@/app/(auth)/logout/actions';
import { redirect } from 'next/navigation';

async function handleLogout() {
  'use server';
  await logoutAction();
  redirect('/login');
}

export function ServerLogoutBtn() {
  return (
    <form action={handleLogout}>
      <Button type="submit" variant="ghost" className="w-full justify-start">
        Logout
      </Button>
    </form>
  );
}
