import { z } from 'zod';

export const UserDTO = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  avatar: z.url().optional(),
});
export type UserDTO = z.infer<typeof UserDTO>;

export const RoomDTO = z.object({
  id: z.uuid(),
  name: z.string().min(1).optional(),
  isGroup: z.boolean(),
});
export type RoomDTO = z.infer<typeof RoomDTO>;

export const MessageIn = z.object({
  roomId: z.uuid(),
  content: z.string().min(1).max(4000),
  clientMsgId: z.uuid(),
  replyToId: z.uuid().nullable().optional(),
});
export type MessageIn = z.infer<typeof MessageIn>;

export const ReactionDTO = z.object({
  emoji: z.string(),
  by: z.array(z.string()),
  count: z.number().min(0),
});
export type ReactionDTO = z.infer<typeof ReactionDTO>;

export const MessageOut = z.object({
  id: z.uuid(),
  roomId: z.uuid(),
  senderId: z.uuid(),
  content: z.string(),
  createdAt: z.string(),
  clientMsgId: z.uuid().optional(),
  replyToId: z.uuid().nullable().optional(),
  reactions: z.array(ReactionDTO).optional(),
});
export type MessageOut = z.infer<typeof MessageOut>;

export const ReactionIn = z.object({
  messageId: z.uuid(),
  emoji: z.string().min(1).max(10), // Support emoji characters
  roomId: z.uuid(),
});
export type ReactionIn = z.infer<typeof ReactionIn>;

export const TypingEvent = z.object({
  roomId: z.uuid(),
  isTyping: z.boolean(),
});
export type TypingEvent = z.infer<typeof TypingEvent>;

export const PresenceEvent = z.object({
  userId: z.uuid(),
  online: z.boolean(),
  lastSeen: z.string(),
});
export type PresenceEvent = z.infer<typeof PresenceEvent>;

export const RegisterDto = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/i, 'alphanumeric/_ only'),
  password: z.string().min(8),
  displayName: z.string().min(1).max(64).optional(),
});

export const LoginDto = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
});

export type RegisterInput = z.infer<typeof RegisterDto>;
export type LoginInput = z.infer<typeof LoginDto>;

// Auth Response Types
export const AuthUserDto = z.object({
  id: z.string().uuid(),
  username: z.string(),
  displayName: z.string().optional(),
});

export const AuthSuccessResponseDto = z.object({
  ok: z.literal(true),
  user: AuthUserDto,
});

export const RefreshSuccessResponseDto = z.object({
  ok: z.literal(true),
  user: AuthUserDto.pick({ id: true, username: true }), // Refresh only returns id and username
});

export type AuthUserDto = z.infer<typeof AuthUserDto>;
export type AuthSuccessResponseDto = z.infer<typeof AuthSuccessResponseDto>;
export type RefreshSuccessResponseDto = z.infer<typeof RefreshSuccessResponseDto>;
