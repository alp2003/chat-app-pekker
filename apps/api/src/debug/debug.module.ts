import { Module } from '@nestjs/common';
import { DebugService } from './debug.service';
import { DebugController } from './debug.controller';
import { ChatModule } from '../chat/chat.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [ChatModule, AuthModule],
  controllers: [DebugController],
  providers: [DebugService],
})
export class DebugModule {}
