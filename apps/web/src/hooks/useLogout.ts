'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
import { logoutAction } from '@/app/(auth)/logout/actions';

export function useLogout() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = useCallback(async (options?: { 
    redirectTo?: string;
    clearStorage?: boolean;
  }) => {
    if (isLoggingOut) return { success: false, error: 'Already logging out' };

    try {
      setIsLoggingOut(true);

      // Clear client-side storage if requested
      if (options?.clearStorage && typeof window !== 'undefined') {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (storageError) {
          console.warn('Failed to clear storage:', storageError);
        }
      }

      // Clear authentication state
      await logoutAction();

      // Navigate to login or specified route
      const redirectPath = options?.redirectTo || '/login';
      router.replace(redirectPath);

      return { success: true };
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Logout failed' 
      };
    }
  }, [router, isLoggingOut]);

  return {
    logout,
    isLoggingOut
  };
}
