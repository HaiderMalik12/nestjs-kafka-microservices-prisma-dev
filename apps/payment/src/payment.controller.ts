import { Controller, Get } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PaymentService } from './payment.service';

@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'order',
      timestamp: new Date().toISOString(),
    };
  }
}
