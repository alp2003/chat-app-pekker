import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { z } from 'zod';
import { MessageIn as MessageInSchema } from 'shared/dto';
import { AuthService } from '../auth/auth.service';
import { ConfigService } from '@nestjs/config';

const TypingSchema = z.object({
  roomId: z.uuid(),
  isTyping: z.boolean(),
});

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: [/^http:\/\/localhost:\d+$/], credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private presence = new Map<string, { userId: string; lastSeen: number }>();

  constructor(
    private chat: ChatService,
    private auth: AuthService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth as any)?.token ||
        (client.handshake.headers['x-access-token'] as string | undefined);

      if (!token) throw new Error('missing_token');

      const payload = await this.auth.verifyAccess(String(token)); // secret from AuthModule
      (client as any).userId = payload.sub as string;

      // presence
      this.presence.set(client.id, {
        userId: payload.sub,
        lastSeen: Date.now(),
      });
      client.emit('connected', { ok: true });
    } catch {
      client.emit('error', { message: 'unauthorized' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const p = this.presence.get(client.id);
    if (p) {
      await this.chat.updateLastSeen(p.userId); // safe upsert
      this.presence.delete(client.id);
      this.server.emit('presence:update', {
        userId: p.userId,
        online: false,
        lastSeen: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('room:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string },
  ) {
    const userId = (client as any).userId as string;
    const { roomId } = body;

    // leave previous rooms (keep personal room if you add one later)
    for (const r of client.rooms) if (r !== client.id) client.leave(r);

    // ensure FK consistency & membership
    await this.chat.ensureRoom(roomId);
    if (!(await this.chat.isMember(userId, roomId))) {
      await this.chat.addMember(userId, roomId);
    }

    client.join(roomId);

    const history = await this.chat.getMessages(userId, roomId, { limit: 40 });
    client.emit('room:history', { roomId, history });
  }

  @SubscribeMessage('room:leave')
  onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string },
  ) {
    client.leave(body.roomId);
  }

  @SubscribeMessage('msg:send')
  async onMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() raw: unknown,
  ) {
    const parsed = MessageInSchema.safeParse(raw);
    if (!parsed.success) {
      return client.emit('msg:nack', {
        clientMsgId: (raw as any)?.clientMsgId,
        error: 'invalid_payload',
        details: z.treeifyError(parsed.error),
      });
    }

    const senderId = (client as any).userId as string;

    // simple flood control
    const key = `flood:${client.id}`;
    const now = Date.now();
    const last = (client as any)[key] || 0;
    if (now - last < 200) return;
    (client as any)[key] = now;

    // save (content defaults to "")
    const saved = await this.chat.saveMessage({
      roomId: parsed.data.roomId,
      senderId,
      content: parsed.data.content ?? '',
      clientMsgId: parsed.data.clientMsgId,
      replyToId: parsed.data.replyToId ?? null,
    });

    this.server.to(parsed.data.roomId).emit('msg:new', saved);
    client.emit('msg:ack', {
      clientMsgId: parsed.data.clientMsgId,
      serverId: saved.id,
    });
  }

  @SubscribeMessage('typing')
  async onTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    const parsed = TypingSchema.safeParse(body);
    if (!parsed.success) return;
    this.server
      .to(parsed.data.roomId)
      .emit('typing', { userId: (client as any).userId, ...parsed.data });
  }
}
