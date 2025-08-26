import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { DebugService } from './debug.service';
import { UserId } from 'src/auth/user.decorator';
import { ChatGateway } from 'src/chat/chat.gateway';
import { AuthService } from 'src/auth/auth.service';
import { ConfigService } from '@nestjs/config';
import { JwtHttpGuard } from 'src/auth/jwt-http.guard';


@Controller('debug')
export class DebugController {
  constructor(
    private readonly debugService: DebugService,
    private readonly chatGateway: ChatGateway,
    private readonly auth: AuthService,
    private readonly cfg: ConfigService
  ) {}

  @Get('debug-token')
  async debugToken(
    @Query('username') username: string,
    @Query('password') password: string,
  ) {
    const {
      id,
      username: uname,
      displayName,
    } = await this.auth.register({
      username: username,
      password: password,
      displayName: username,
    });
    return { id, uname, displayName };
  }

  @Get('debug-jwt-health')
  health() {
    return {
      hasSecret: !!this.cfg.get<string>('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.cfg.get<string>('JWT_ACCESS_EXPIRES') ?? '1h',
    };
  }

  // Requires authentication for WebSocket testing
  @UseGuards(JwtHttpGuard)
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
        connectedSockets: socketsCount,
      };
    } else {
      console.log('❌ ChatGateway server not available');
      return {
        success: false,
        message: 'WebSocket server not available',
      };
    }
  }
}
