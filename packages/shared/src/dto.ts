import { z } from "zod";

export const UserDTO = z.object({
    id: z.uuid(),
    name: z.string().min(1),
    avatar: z.url().optional()
});
export type UserDTO = z.infer<typeof UserDTO>;

export const RoomDTO = z.object({
    id: z.uuid(),
    name: z.string().min(1).optional(),
    isGroup: z.boolean()
});
export type RoomDTO = z.infer<typeof RoomDTO>;

export const MessageIn = z.object({
    roomId: z.uuid(),
    content: z.string().min(1).max(4000),
    clientMsgId: z.uuid(),
    replyToId: z.uuid().nullable().optional()
});
export type MessageIn = z.infer<typeof MessageIn>;

export const MessageOut = z.object({
    id: z.uuid(),
    roomId: z.uuid(),
    senderId: z.uuid(),
    content: z.string(),
    createdAt: z.string(),
    clientMsgId: z.uuid().optional(),
    replyToId: z.uuid().nullable().optional()
});
export type MessageOut = z.infer<typeof MessageOut>;

export const TypingEvent = z.object({
    roomId: z.uuid(),
    isTyping: z.boolean()
});
export type TypingEvent = z.infer<typeof TypingEvent>;

export const PresenceEvent = z.object({
    userId: z.uuid(),
    online: z.boolean(),
    lastSeen: z.string()
});
export type PresenceEvent = z.infer<typeof PresenceEvent>;

export const RegisterDto = z.object({
    username: z
        .string()
        .min(3)
        .max(32)
        .regex(/^[a-z0-9_]+$/i, "alphanumeric/_ only"),
    password: z.string().min(8),
    displayName: z.string().min(1).max(64).optional()
});

export const LoginDto = z.object({
    username: z.string().min(3),
    password: z.string().min(8)
});

export type RegisterInput = z.infer<typeof RegisterDto>;
export type LoginInput = z.infer<typeof LoginDto>;
