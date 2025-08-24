'use client';

import { LogoutBtn } from '@/components/LogoutButton';
import { TelegramThemePicker } from '@/components/telegram-theme-picker';
import { Separator } from '@/components/ui/separator';
import { User } from 'lucide-react';

interface SidebarFooterProps {
  currentUser?: {
    username: string;
    displayName?: string;
  };
}

export function SidebarFooter({ currentUser }: SidebarFooterProps) {
  return (
    <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between p-4">
        {/* User info */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {currentUser?.displayName || currentUser?.username || 'User'}
            </span>
            {currentUser?.displayName && (
              <span className="text-xs text-muted-foreground">
                @{currentUser.username}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <TelegramThemePicker />
          <Separator orientation="vertical" className="h-6" />
          <LogoutBtn />
        </div>
      </div>
    </div>
  );
}
