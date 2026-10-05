import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CacheLecturasInterceptor, CacheLecturasService } from './cache-lecturas.js';

@Global()
@Module({
  providers: [CacheLecturasService, { provide: APP_INTERCEPTOR, useClass: CacheLecturasInterceptor }],
  exports: [CacheLecturasService],
})
export class CacheLecturasModule {}
