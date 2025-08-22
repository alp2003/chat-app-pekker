import {
  INestApplication,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();

    this.$on('error' as never, (e: unknown) => {
      // You could trigger graceful shutdown here if desired
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      console.error('[Prisma error]', errorMessage);
    });
  }

  enableShutdownHooks(app: INestApplication): void {
    this.$on('beforeExit' as never, () => {
      void app.close();
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
