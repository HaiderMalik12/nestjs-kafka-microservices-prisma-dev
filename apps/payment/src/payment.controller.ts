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
import {
  PaymentInitiatePayload,
  PaymentInitiateResponse,
} from './types/payment-types';

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

  // @EventPattern('order.created')
  // async handleOrderCreated(
  //   @Payload() data: OrderCreatedEventPayload,
  //   @Ctx() context: KafkaContext,
  // ) {
  //   console.log('[Payment] Received order.created:', data);

  //   if (!data?.orderId || !data?.totalAmount) {
  //     console.error('[Payment] Invalid order.created payload');
  //     return;
  //   }

  //   await this.paymentService.processOrderPayment(data);
  // }

  @MessagePattern('payment.initiate')
  async handlePaymentInitiate(
    @Payload() payload: PaymentInitiatePayload,
    @Ctx() context: KafkaContext,
  ): Promise<PaymentInitiateResponse> {
    console.log('[PaymentMS] Received payment.initiate:', payload);
    return this.paymentService.initiateStripePayment(payload);
  }
  @MessagePattern('stripe.webhook')
  async handleStripeWebhookMessage(
    @Payload()
    payload: {
      rawBody: string;
      signature?: string;
    },
    @Ctx() context: KafkaContext,
  ) {
    console.log('[PaymentMS] Received stripe.webhook event');

    const rawBuffer = Buffer.from(payload.rawBody, 'utf8');
    await this.paymentService.handleStripeWebhook(rawBuffer, payload.signature);
  }
}
