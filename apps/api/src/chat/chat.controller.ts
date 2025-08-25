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
    console.log('ChatGateway injected?', !!chatGateway);
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
    console.log('� Starting DM with:', dto.username);
    const result = await this.chatService.getOrCreateDmByUsername(
      me,
      dto.username,
    );

    // If a new conversation was created, invalidate conversations cache for both users
    if (result.isNew) {
      console.log('🔄 New DM created, invalidating cache for both users');

      try {
        await this.chatService.invalidateConversationsCacheImmediate(me);
        await this.chatService.invalidateConversationsCacheImmediate(
          result.otherUserId,
        );
        console.log('✅ Cache invalidation completed');
      } catch (error) {
        console.error('❌ Cache invalidation failed:', error);
      }
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

      const socketsCount = this.chatGateway.server?.sockets?.sockets?.size || 0;
      console.log('� Broadcasting DM creation event to', socketsCount, 'clients');
      
      this.chatGateway.server.emit('conversation:created', eventData);
      console.log('✅ DM created:', result.id);
    }

    return result;
  }

  @Post('groups')
  @RateLimitByUser(300, 5) // 5 group creates per user per 5 minutes
  async createGroup(@UserId() me: string, @Body() dto: CreateGroupDto) {
    console.log('🚀 Creating group:', dto.name, 'with', dto.memberIds.length + 1, 'members');
    
    // ensure creator is in the group
    const unique = Array.from(new Set([me, ...dto.memberIds]));
    const room = await this.chatService.createGroup(me, dto.name, unique);

    // Add a small delay to ensure cache invalidation completes
    await new Promise(resolve => setTimeout(resolve, 100));

    // Emit WebSocket event for real-time group creation
    if (this.chatGateway?.server) {
      const eventData = {
        conversationId: room.id,
        participants: unique,
        type: 'group',
        name: dto.name,
        initiatedBy: me,
        timestamp: new Date().toISOString(),
      };

      const socketsCount = this.chatGateway.server?.sockets?.sockets?.size || 0;
      console.log('� Broadcasting group creation event to', socketsCount, 'clients');
      
      if (socketsCount === 0) {
        console.log('⚠️ No WebSocket clients connected');
      }

      this.chatGateway.server.emit('conversation:created', eventData);
      console.log('✅ Group created:', room.id);
    } else {
      console.log('❌ WebSocket not available for group:', room.id);
    }

    return { id: room.id };
  }

  // Test endpoint to verify WebSocket is working
  @Post('test-websocket')
  async testWebSocket(@UserId() me: string) {
    console.log('🧪 Testing WebSocket connection for user:', me);
    
    if (this.chatGateway?.server) {
      const testData = {
        message: 'Test WebSocket event',
        userId: me,
        timestamp: new Date().toISOString(),
      };

      console.log('📡 Emitting test WebSocket event:', testData);
      this.chatGateway.server.emit('test:event', testData);
      
      const socketsCount = this.chatGateway.server?.sockets?.sockets?.size || 0;
      console.log('🔍 Connected sockets count:', socketsCount);
      
      return { 
        success: true, 
        message: 'Test event emitted',
        connectedSockets: socketsCount
      };
    } else {
      console.log('❌ ChatGateway server not available');
      return { 
        success: false, 
        message: 'WebSocket server not available' 
      };
    }
  }
}
