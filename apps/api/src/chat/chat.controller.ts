// apps/api/src/chat/chat.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { JwtHttpGuard } from 'src/auth/jwt-http.guard';
import { UserId } from 'src/auth/user.decorator';
import { ZodBody } from '../common/zod.pipe';
import { MessagesQueryDto } from './dto/messages-query.dto';
import { Cache, RateLimitByUser } from '../common/cache/cache.decorators';
import { StartDmDto } from './dto/start-dm.dto';
import { CreateGroupDto } from './dto/create-group.dto';

@UseGuards(JwtHttpGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {
    console.log('ChatService injected?', !!chatService);
  }

  @Post()
  async create(@Body() body: { name?: string; isGroup?: boolean }) {
    try {
      const room = await this.chatService.createRoom(body);
      return room;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.log(errorMessage);
      console.log(JSON.stringify(err, null, 2));
      throw err; // Re-throw to maintain proper error handling
    }
  }

  @Post(':id/members')
  async addMembers(
    @Param('id') id: string,
    @Body() body: { userIds: string[] },
  ) {
    return this.chatService.addMembers(id, body.userIds);
  }

  @Get('conversations')
  @Cache('conversations:user::userId', 60, 10) // 60s TTL with 10% jitter
  async conversations(@UserId() userId: string) {
    return this.chatService.listConversations(userId);
  }

  @Get('messages')
  @Cache('messages:room::roomId:user::userId', 30, 20) // 30s TTL with 20% jitter
  async messages(@UserId() userId: string, @Query() q: MessagesQueryDto) {
    return this.chatService.getMessages(userId, q.roomId, {
      limit: q.limit,
    });
  }

  @Get('rooms/:id/messages')
  async listMessages(
    @UserId() me: string,
    @Param('id') roomId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    // (optionally validate membership)
    return this.chatService.getMessages(me, roomId, {
      limit: limit ? parseInt(limit, 10) : 5000,
    });
  }

  @Post('dm/start')
  @RateLimitByUser(60, 10) // 10 DM starts per user per minute
  async startDm(@UserId() me: string, @Body() dto: StartDmDto) {
    console.log('🚀 Starting DM creation for user:', me, 'with:', dto.username);
    const result = await this.chatService.getOrCreateDmByUsername(
      me,
      dto.username,
    );
    console.log('📝 DM creation result:', {
      id: result.id,
      otherUserId: result.otherUserId,
      isNew: result.isNew,
      hasGateway: !!this.chatGateway,
      hasServer: !!this.chatGateway?.server,
    });

    // If a new conversation was created, invalidate conversations cache for both users
    if (result.isNew) {
      console.log('🔄 Invalidating conversations cache for new DM...');

      try {
        await this.chatService.invalidateConversationsCacheImmediate(me);
        console.log('✅ Cache immediately invalidated for current user:', me);
      } catch (error) {
        console.error(
          '❌ Failed to immediately invalidate cache for current user:',
          me,
          error,
        );
      }

      try {
        await this.chatService.invalidateConversationsCacheImmediate(
          result.otherUserId,
        );
        console.log(
          '✅ Cache immediately invalidated for other user:',
          result.otherUserId,
        );
      } catch (error) {
        console.error(
          '❌ Failed to immediately invalidate cache for other user:',
          result.otherUserId,
          error,
        );
      }

      console.log('✅ Immediate cache invalidation completed');
    }

    // Emit socket event to both users about the new conversation (only for new conversations)
    if (result.isNew && this.chatGateway.server) {
      const eventData = {
        conversationId: result.id,
        participants: [me, result.otherUserId],
        type: 'dm',
        initiatedBy: me,
        timestamp: new Date().toISOString(),
      };

      console.log(
        '🟢 Emitting conversation:created socket event for new DM:',
        result.id,
      );
      console.log('🟢 Event data to emit:', JSON.stringify(eventData, null, 2));

      // Safe access to socket server properties
      const clientsCount =
        this.chatGateway.server?.engine?.clientsCount || 'unknown';
      const socketsCount = this.chatGateway.server?.sockets?.sockets?.size || 0;
      console.log('🔍 Connected clients count:', clientsCount);
      console.log('🔍 Namespace sockets:', socketsCount);

      // List all connected socket IDs for debugging
      if (this.chatGateway.server?.sockets?.sockets) {
        const socketIds = Array.from(
          this.chatGateway.server.sockets.sockets.keys(),
        );
        console.log('🔍 Connected socket IDs:', socketIds);
      } else {
        console.log('🔍 No socket connection info available');
      }

      // Emit to ALL connected clients in the /chat namespace for testing
      console.log(
        '📡 Broadcasting conversation:created event to ALL clients...',
      );
      this.chatGateway.server.emit('conversation:created', eventData);
    }

    return result;
  }

  @Post('groups')
  @RateLimitByUser(300, 5) // 5 group creates per user per 5 minutes
  async createGroup(@UserId() me: string, @Body() dto: CreateGroupDto) {
    // ensure creator is in the group
    const unique = Array.from(new Set([me, ...dto.memberIds]));
    const room = await this.chatService.createGroup(me, dto.name, unique);
    return { id: room.id };
  }
}
