import { Controller, Get } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  KafkaContext,
  MessagePattern,
  Payload,
} from '@nestjs/microservices';
import { PaymentService } from './payment.service';
import type { OrderCreatedEventPayload } from './order-created.payload';

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

  @EventPattern('order.created')
  async handleOrderCreated(
    @Payload() data: OrderCreatedEventPayload,
    @Ctx() context: KafkaContext,
  ) {
    console.log('[Payment] Received order.created:', data);

    if (!data?.orderId || !data?.totalAmount) {
      console.error('[Payment] Invalid order.created payload');
      return;
    }

    await this.paymentService.processOrderPayment(data);
  }
}
