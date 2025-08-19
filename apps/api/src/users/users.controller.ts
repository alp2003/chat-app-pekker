import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtHttpGuard } from '../auth/jwt-http.guard';
import { UserId } from '../auth/user.decorator';
import { UsersService } from './users.service';

@UseGuards(JwtHttpGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@UserId() userId: string) {
    const id: string = userId;
    console.log(`id: ${id}`, `userId:${userId}`);
    return this.usersService.getMe({ userId: id });
  }

  @Get('search')
  async search(@UserId() _me: string, @Query('q') q = '') {
    const query = q.toLowerCase().trim();
    if (!query) return [];
    return this.usersService.searchUsers({ _me, query });
  }
}
