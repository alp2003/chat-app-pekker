import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { z } from 'zod';
import {
  MessageIn as MessageInSchema,
  ReactionIn as ReactionInSchema,
} from 'shared/dto';
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
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private presence = new Map<string, { userId: string; lastSeen: number }>();

  constructor(
    private chat: ChatService,
    private auth: AuthService,
    private configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    console.log('🔌 ChatGateway server initialized:', !!server);
    console.log('🔌 Server engine:', !!server.engine);
    console.log('🔌 Server ready for events');
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string;
      if (!token) throw new Error('no_token');

      const payload = await this.auth.verifyAccess(token);
      client.data.userId = payload.sub;
      client.data.username = payload.username;

      console.log(
        `🔌 WebSocket connected: ${payload.sub} (socket: ${client.id})`,
      );

      // Validate user exists - no automatic user creation
      await this.chat.validateUserExists(payload.sub);
      this.presence.set(client.id, {
        userId: payload.sub,
        lastSeen: Date.now(),
      });

      // Join all user's conversation rooms on connection
      const conversations = await this.chat.listConversations(payload.sub);
      for (const conv of conversations) {
        void client.join(conv.id);
      }

      client.emit('connected', { ok: true });
    } catch {
      console.log(`❌ WebSocket connection failed for socket: ${client.id}`);
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
  handleJoinRoom(
    @MessageBody() { id }: { id: string },
    @ConnectedSocket() client: Socket,
  ): void {
    void client.join(id);

    // Emit to the room that someone joined (optional)
    client.to(id).emit('user:joined', {
      userId: client.data.userId as string,
      username: client.data.username as string,
    });
  }

  @SubscribeMessage('room:leave')
  onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string },
  ): void {
    void client.leave(body.roomId);
  }

  @SubscribeMessage('msg:send')
  async onMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() raw: unknown,
  ) {
    const parsed = MessageInSchema.safeParse(raw);
    if (!parsed.success) {
      return client.emit('msg:nack', {
        clientMsgId: (raw as { clientMsgId?: string })?.clientMsgId,
        error: 'invalid_payload',
        details: z.treeifyError(parsed.error),
      });
    }

    const senderId = client.data.userId as string;

    // simple flood control
    const key = `flood:${client.id}`;
    const now = Date.now();
    const last = (client as unknown as { [key: string]: number })[key] || 0;
    if (now - last < 200) return;
    (client as unknown as { [key: string]: number })[key] = now;

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
  onTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): void {
    const parsed = TypingSchema.safeParse(body);
    if (!parsed.success) return;
    this.server
      .to(parsed.data.roomId)
      .emit('typing', { userId: client.data.userId as string, ...parsed.data });
  }

  @SubscribeMessage('msg:react')
  async onReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() raw: unknown,
  ) {
    const parsed = ReactionInSchema.safeParse(raw);
    if (!parsed.success) {
      return client.emit('msg:react:nack', {
        error: 'invalid_payload',
        details: z.treeifyError(parsed.error),
      });
    }

    const userId = client.data.userId as string;

    try {
      // Process the reaction
      const result = await this.chat.reactToMessage({
        messageId: parsed.data.messageId,
        userId,
        emoji: parsed.data.emoji,
      });

      // Emit the reaction update to all users in the room
      this.server.to(parsed.data.roomId).emit('msg:react', result);

      // Send acknowledgment back to sender
      client.emit('msg:react:ack', {
        messageId: parsed.data.messageId,
        success: true,
      });
    } catch (error) {
      console.error('Reaction error:', error);
      client.emit('msg:react:nack', {
        messageId: parsed.data.messageId,
        error: error instanceof Error ? error.message : 'unknown_error',
      });
    }
  }

  @SubscribeMessage('ping')
  onPing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ): void {
    // Respond with pong to confirm connection is alive
    // This helps mobile clients detect stale connections
    client.emit('pong', { 
      timestamp: data?.timestamp || Date.now(),
      serverId: client.id 
    });
  }
}
