import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { PrismaService } from '../prisma.service';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [PrismaService, UsersService],
})
export class UsersModule {}
