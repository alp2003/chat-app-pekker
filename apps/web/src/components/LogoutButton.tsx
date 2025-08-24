'use client';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useLogout } from '@/hooks/useLogout';

export function LogoutBtn() {
  const { logout, isLoggingOut } = useLogout();

  const handleLogout = async () => {
    const result = await logout({ 
      clearStorage: false, // Set to true if you want to clear localStorage/sessionStorage
      redirectTo: '/login'
    });

    if (!result.success) {
      // Optionally show error toast/notification
      console.error('Logout failed:', result.error);
    }
  };

  return (
    <Button
      variant="ghost"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="gap-2"
      aria-label={isLoggingOut ? 'Logging out...' : 'Logout'}
    >
      <LogOut className="h-4 w-4" />
      {isLoggingOut ? 'Logging out...' : 'Logout'}
    </Button>
  );
}
