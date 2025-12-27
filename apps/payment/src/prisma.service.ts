import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from './generated/prisma-client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    console.log('[PAYMENT] DATABASE_URL =', process.env.DATABASE_URL);

    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
