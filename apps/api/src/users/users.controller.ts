import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtHttpGuard } from '../auth/jwt-http.guard';
import { UserId } from '../auth/user.decorator';
import { UsersService } from './users.service';
import { loggerFactory } from '../common/logger/logger.factory';
import { RequestWithContext } from '../common/middleware/request-context.middleware';

@UseGuards(JwtHttpGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(
    @UserId() userId: string,
    @Req() request: RequestWithContext,
  ): Promise<{
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
  }> {
    const logger = loggerFactory.createLogger({
      requestId: request.requestId,
      correlationId: request.correlationId,
      userId,
    });

    logger.info({ userId, type: 'user_profile_request' }, 'Fetching user profile');
    
    const result = await this.usersService.getMe({ userId });
    
    logger.info({ 
      userId, 
      type: 'user_profile_success',
      hasDisplayName: !!result.displayName,
      hasAvatar: !!result.avatar,
    }, 'User profile retrieved successfully');
    
    return result;
  }

  @Get('search')
  async search(
    @UserId() userId: string, 
    @Query('q') q = '',
    @Req() request: RequestWithContext,
  ) {
    const logger = loggerFactory.createLogger({
      requestId: request.requestId,
      correlationId: request.correlationId,
      userId,
    });
    
    const query = q.toLowerCase().trim();
    
    logger.info({ 
      type: 'user_search_request',
      queryLength: query.length,
      hasQuery: query.length > 0,
    }, 'User search requested');
    
    if (!query) {
      logger.info({ type: 'user_search_empty' }, 'Empty search query, returning empty results');
      return [];
    }
    
    const results = await this.usersService.searchUsers({ _me: userId, query });
    
    logger.info({ 
      type: 'user_search_success',
      resultCount: results.length,
    }, 'User search completed');
    
    return results;
  }
}
