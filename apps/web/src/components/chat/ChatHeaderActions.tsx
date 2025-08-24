'use client';

import { LogoutBtn } from '@/components/LogoutButton';
import { TelegramThemePicker } from '@/components/telegram-theme-picker';
import { Separator } from '@/components/ui/separator';

export function ChatHeaderActions() {
  return (
    <div className="flex items-center gap-2">
      <TelegramThemePicker />
      <Separator orientation="vertical" className="h-6" />
      <LogoutBtn />
    </div>
  );
}
