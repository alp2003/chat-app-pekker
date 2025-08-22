import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheHelper } from './cache-helper';
import { CacheInterceptor } from './cache.interceptor';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [CacheHelper, CacheInterceptor],
  exports: [CacheHelper, CacheInterceptor],
})
export class CacheModule {}
