'use client';

interface ChatHeaderActionsProps {
  currentUser?: {
    username: string;
    displayName?: string;
  };
}

export function ChatHeaderActions({ currentUser }: ChatHeaderActionsProps) {
  // Profile dropdown now handled by SidebarFooter
  return null;
}
