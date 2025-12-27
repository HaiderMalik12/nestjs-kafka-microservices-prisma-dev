import { Injectable, OnModuleInit } from '@nestjs/common';

import { PrismaService } from './prisma.service';

@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService) {}
}
