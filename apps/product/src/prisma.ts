// apps/product/src/prisma.service.ts
import {  Injectable, OnModuleInit } from '@nestjs/common';
// Use the standard import now
import { PrismaClient } from '@prisma/client'; 

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}