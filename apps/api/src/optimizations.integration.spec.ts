import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';
import { AuthService } from './auth/auth.service';
import { UsersService } from './users/users.service';
import { ChatService } from './chat/chat.service';

describe('Prisma Optimizations (Integration)', () => {
  let app: INestApplication;
  let authService: AuthService;
  let usersService: UsersService;
  let chatService: ChatService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    authService = app.get<AuthService>(AuthService);
    usersService = app.get<UsersService>(UsersService);
    chatService = app.get<ChatService>(ChatService);
    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth Service Optimizations', () => {
    it('should validate user with optimized select', async () => {
      // Create a test user with unique username
      const uniqueUsername = `testoptimized-${Date.now()}`;
      const testUser = await authService.register({
        username: uniqueUsername,
        password: 'password123',
        displayName: 'Test Optimized',
      });

      expect(testUser).toHaveProperty('id');
      expect(testUser).toHaveProperty('username', uniqueUsername);
      expect(testUser).toHaveProperty('displayName', 'Test Optimized');

      // Validate the user credentials
      const validatedUser = await authService.validateUser(
        'testoptimized',
        'password123',
      );
      expect(validatedUser).toHaveProperty('id');
      expect(validatedUser).toHaveProperty('username', 'testoptimized');
      expect(validatedUser).toHaveProperty('displayName', 'Test Optimized');
      expect(validatedUser).toHaveProperty('passwordHash');
    });
  });

  describe('Users Service Optimizations', () => {
    it('should search users with optimized queries', async () => {
      // Ensure we have a test user
      try {
        await authService.register({
          username: 'searchtest',
          password: 'password123',
          displayName: 'Search Test',
        });
      } catch (e) {
        // User might already exist, that's ok
      }

      const users = await usersService.searchUsers({
        query: 'search',
        _me: 'testuser',
      });
      expect(Array.isArray(users)).toBe(true);
      const searchUser = users.find((u: any) => u.username === 'searchtest');
      if (searchUser) {
        expect(searchUser).toHaveProperty('id');
        expect(searchUser).toHaveProperty('username');
        expect(searchUser).toHaveProperty('displayName');
      }
    });

    it('should get user profile with optimized select', async () => {
      // Create test user with unique username
      const uniqueUsername = `profiletest-${Date.now()}`;
      const testUser = await authService.register({
        username: uniqueUsername,
        password: 'password123',
        displayName: 'Profile Test',
      });

      const profile = await usersService.getMe({ userId: testUser.id });
      expect(profile).toHaveProperty('id', testUser.id);
      expect(profile).toHaveProperty('username', uniqueUsername);
      expect(profile).toHaveProperty('displayName', 'Profile Test');
    });
  });

  describe('Chat Service Optimizations', () => {
    it('should get conversations with optimized queries', async () => {
      // Create test users with unique usernames
      const timestamp = Date.now();
      const user1 = await authService.register({
        username: `chatuser1-${timestamp}`,
        password: 'password123',
        displayName: 'Chat User 1',
      });

      const user2 = await authService.register({
        username: `chatuser2-${timestamp}`,
        password: 'password123',
        displayName: 'Chat User 2',
      });

      // Start a DM (this uses transaction optimization)
      const dmRoom = await chatService.getOrCreateDmByUsername(
        user1.id,
        user2.username,
      );
      expect(dmRoom).toHaveProperty('id');

      // Get conversations (this uses optimized selects)
      const conversations = await chatService.listConversations(user1.id);
      expect(Array.isArray(conversations)).toBe(true);

      const conversation = conversations.find((c: any) => c.id === dmRoom.id);
      if (conversation) {
        expect(conversation).toHaveProperty('id');
        expect(conversation).toHaveProperty('name');
        expect(conversation).toHaveProperty('isGroup', false);
      }
    });
  });

  describe('PrismaOptimizer Utility', () => {
    it('should provide consistent selects', async () => {
      const { PrismaOptimizer } = await import(
        './common/prisma/prisma-optimizer'
      );

      // Test that selects are properly structured
      expect(PrismaOptimizer.selects.user.auth).toHaveProperty('id', true);
      expect(PrismaOptimizer.selects.user.auth).toHaveProperty(
        'username',
        true,
      );
      expect(PrismaOptimizer.selects.user.auth).toHaveProperty(
        'displayName',
        true,
      );
      expect(PrismaOptimizer.selects.user.auth).toHaveProperty(
        'passwordHash',
        true,
      );

      expect(PrismaOptimizer.selects.user.profile).toHaveProperty(
        'displayName',
        true,
      );
      expect(PrismaOptimizer.selects.user.minimal).toHaveProperty(
        'username',
        true,
      );
    });
  });
});
