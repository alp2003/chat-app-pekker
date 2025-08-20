import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma.service';
import { CacheService } from '../common/cache.service';
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';

@Module({
  imports: [AuthModule],
  providers: [ChatGateway, ChatService, PrismaService, CacheService],
  controllers: [ChatController],
})
export class ChatModule {}
