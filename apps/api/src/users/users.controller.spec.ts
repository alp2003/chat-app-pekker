import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { RequestWithContext } from '../common/middleware/request-context.middleware';
import { loggerFactory } from '../common/logger/logger.factory';

describe('UsersController Logging', () => {
  let controller: UsersController;
  let service: UsersService;
  let loggerSpy: jest.SpyInstance;

  const mockUsersService = {
    getMe: jest.fn(),
    searchUsers: jest.fn(),
  };

  const mockAuthService = {
    validateUser: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
  };

  const mockRequest: RequestWithContext = {
    requestId: 'test-request-id',
    correlationId: 'test-correlation-id',
  } as RequestWithContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);

    // Spy on the logger factory
    loggerSpy = jest.spyOn(loggerFactory, 'createLogger').mockReturnValue({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /users/me', () => {
    it('should log user profile request and success', async () => {
      const userId = 'test-user-id';
      const expectedResult = {
        id: userId,
        username: 'testuser',
        displayName: 'Test User',
        avatar: null,
      };

      mockUsersService.getMe.mockResolvedValue(expectedResult);

      const result = await controller.me(userId, mockRequest);

      // Assert service was called correctly
      expect(service.getMe).toHaveBeenCalledWith({ userId });
      expect(result).toEqual(expectedResult);

      // Assert logger was created with correct context
      expect(loggerSpy).toHaveBeenCalledWith({
        requestId: mockRequest.requestId,
        correlationId: mockRequest.correlationId,
        userId,
      });

      // Assert logger.info was called for request and success
      const loggerInstance = loggerSpy.mock.results[0]?.value;
      expect(loggerInstance).toBeDefined();
      expect(loggerInstance.info).toHaveBeenCalledTimes(2);

      // Check request log
      expect(loggerInstance.info).toHaveBeenCalledWith(
        { userId, type: 'user_profile_request' },
        'Fetching user profile',
      );

      // Check success log
      expect(loggerInstance.info).toHaveBeenCalledWith(
        {
          userId,
          type: 'user_profile_success',
          hasDisplayName: true,
          hasAvatar: false,
        },
        'User profile retrieved successfully',
      );
    });
  });

  describe('GET /users/search', () => {
    it('should log search request and success for valid query', async () => {
      const userId = 'test-user-id';
      const query = 'john';
      const expectedResults = [
        { id: 'user1', username: 'john_doe' },
        { id: 'user2', username: 'johnny' },
      ];

      mockUsersService.searchUsers.mockResolvedValue(expectedResults);

      const result = await controller.search(userId, query, mockRequest);

      // Assert service was called correctly
      expect(service.searchUsers).toHaveBeenCalledWith({ _me: userId, query });
      expect(result).toEqual(expectedResults);

      // Assert logger was created with correct context
      expect(loggerSpy).toHaveBeenCalledWith({
        requestId: mockRequest.requestId,
        correlationId: mockRequest.correlationId,
        userId,
      });

      // Assert logger.info was called for request and success
      const loggerInstance = loggerSpy.mock.results[0]?.value;
      expect(loggerInstance).toBeDefined();
      expect(loggerInstance.info).toHaveBeenCalledTimes(2);

      // Check request log
      expect(loggerInstance.info).toHaveBeenCalledWith(
        {
          type: 'user_search_request',
          queryLength: query.length,
          hasQuery: true,
        },
        'User search requested',
      );

      // Check success log
      expect(loggerInstance.info).toHaveBeenCalledWith(
        {
          type: 'user_search_success',
          resultCount: expectedResults.length,
        },
        'User search completed',
      );
    });

    it('should log empty query case', async () => {
      const userId = 'test-user-id';
      const query = '';

      const result = await controller.search(userId, query, mockRequest);

      // Assert early return with empty array
      expect(service.searchUsers).not.toHaveBeenCalled();
      expect(result).toEqual([]);

      // Assert logger was created
      expect(loggerSpy).toHaveBeenCalledWith({
        requestId: mockRequest.requestId,
        correlationId: mockRequest.correlationId,
        userId,
      });

      // Assert correct logging for empty query
      const loggerInstance = loggerSpy.mock.results[0]?.value;
      expect(loggerInstance).toBeDefined();
      expect(loggerInstance.info).toHaveBeenCalledTimes(2);

      expect(loggerInstance.info).toHaveBeenCalledWith(
        {
          type: 'user_search_request',
          queryLength: 0,
          hasQuery: false,
        },
        'User search requested',
      );

      expect(loggerInstance.info).toHaveBeenCalledWith(
        { type: 'user_search_empty' },
        'Empty search query, returning empty results',
      );
    });
  });
});
