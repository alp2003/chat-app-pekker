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
import { JwtHttpGuard } from 'src/auth/jwt-http.guard';
import { UserId } from 'src/auth/user.decorator';
import { MessagesQueryDto } from './dto/messages-query.dto';
import { StartDmDto } from './dto/start-dm.dto';
import { CreateGroupDto } from './dto/create-group.dto';

@UseGuards(JwtHttpGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {
    console.log('ChatService injected?', !!chatService);
  }

  @Post()
  async create(@Body() body: { name?: string; isGroup?: boolean }) {
    try {
      const room = await this.chatService.createRoom(body);
      return room;
    } catch (err: any) {
      console.log(err?.message);
      console.log(JSON.stringify(err, null, 2));
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
  async conversations(@UserId() userId: string) {
    return this.chatService.listConversations(userId);
  }

  @Get('messages')
  async messages(@UserId() userId: string, @Query() q: MessagesQueryDto) {
    return this.chatService.getMessages(userId, q.roomId, {
      cursor: q.cursor,
      limit: q.limit,
    });
  }

  @Get('rooms/:id/messages')
  async listMessages(
    @UserId() me: string,
    @Param('id') roomId: string,
    @Query('cursor') cursor?: string,
  ) {
    // (optionally validate membership)
    return this.chatService.getRecentMessages(roomId, { cursor });
  }

  @Post('dm/start')
  async startDm(@UserId() me: string, @Body() dto: StartDmDto) {
    return this.chatService.getOrCreateDmByUsername(me, dto.username);
  }

  @Post('groups')
  async createGroup(@UserId() me: string, @Body() dto: CreateGroupDto) {
    // ensure creator is in the group
    const unique = Array.from(new Set([me, ...dto.memberIds]));
    const room = await this.chatService.createGroup(me, dto.name, unique);
    return { id: room.id };
  }
}
