// apps/web/src/lib/types/chat.ts
export type Member = {
  id: string;
  username: string;
  displayName?: string | null;
  avatar?: string | null;
  online?: boolean;
};

export type Message = {
  id: string;
  roomId: string; // include this for easy list updates
  userId: string; // senderId on the backend -> userId on the UI
  content: string;
  createdAt: string; // ISO
  fileUrl?: string | null;
  read?: boolean;
  pending?: boolean;
  clientMsgId?: string | null; // <-- add this (optional)
  replyToId?: string | null;

  replyTo?: { id?: string; content?: string; userId?: string } | null;
  error?: boolean;
  edited?: boolean;
  reactions?: Reaction[];
  
  // Add sender information for display purposes
  senderUsername?: string;
  senderDisplayName?: string | null;
};

export type Conversation = {
  id: string; // roomId
  name: string;
  avatar?: string | null;
  last?: string | null;
  lastMessageAt?: string | null; // ISO timestamp for sorting
  unread?: number;
  online?: boolean;
  members?: Member[]; // <-- make optional so optimistic items compile
};

export type Reaction = {
  emoji: string;
  count: number; // required to match backend
  by: string[]; // required to match backend
};
