/**
 * Chat module type definitions
 *
 * These types represent the domain models for the chat functionality,
 * separate from Prisma-generated types to maintain clean boundaries.
 */

export interface ConversationMember {
  id: string;
  username: string;
}

export interface Conversation {
  id: string;
  name: string;
  avatar: string | null;
  isGroup: boolean;
  last: string | null;
  members: ConversationMember[];
}

export interface MessageReaction {
  emoji: string;
  by: string[];
  count: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  createdAt: string;
  clientMsgId: string | null;
  replyToId: string | null;
  reactions: MessageReaction[];
}

// DTOs for API requests/responses
export interface CreateRoomRequest {
  name?: string;
  isGroup?: boolean;
}

export interface SendMessageRequest {
  content: string;
  roomId: string;
  clientMsgId?: string;
  replyToId?: string;
}

export interface ReactToMessageRequest {
  messageId: string;
  emoji: string;
}

// Utility types
export type MessageWithUser = ChatMessage & {
  user: {
    id: string;
    username: string;
    displayName: string | null;
  };
};

export type ConversationWithLastMessage = Conversation & {
  lastMessage?: Pick<ChatMessage, 'id' | 'content' | 'createdAt' | 'userId'>;
};
