import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

describe('API Health Check (Integration)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    await prismaService.$disconnect();
    await app.close();
  });

  it('should be able to connect to database', async () => {
    const result = await prismaService.$queryRaw`SELECT 1 as test`;
    expect(result).toBeDefined();
  });

  it('should have all required environment variables', () => {
    expect(process.env.DATABASE_URL).toBeDefined();
    expect(process.env.REDIS_URL).toBeDefined();
  });
});
