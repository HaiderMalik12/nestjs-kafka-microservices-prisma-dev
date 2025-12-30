import { Controller, Get, Logger } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  KafkaContext,
  MessagePattern,
  Payload,
} from '@nestjs/microservices';
import { OrderService } from './order.service';
import type {
  PaymentCompletedEventPayload,
  PaymentFailedEvent,
  PaymentFailedEventPayload,
  PaymentSucceededEvent,
} from './events/payment-events';

@Controller()
export class OrderController {
  private readonly logger = new Logger(OrderService.name);
  constructor(private readonly orderService: OrderService) {}

  @Get()
  getHello(): string {
    return this.orderService.getHello();
  }
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'order',
      timestamp: new Date().toISOString(),
    };
  }

  @MessagePattern('order.create')
  async createOrder(@Payload() payload: any) {
    console.log('Received order creation message:', payload);
    return this.orderService.createOrder(payload);
  }

  @MessagePattern('order.cancel')
  async cancelOrder(@Payload() payload: { orderId: string; reason?: string }) {
    console.log('Received order cancel message:', payload);
    return this.orderService.cancelOrder(payload.orderId, payload.reason);
  }

  @EventPattern('payment.completed')
  async handlePaymentCompleted(
    @Payload() data: PaymentCompletedEventPayload,
    @Ctx() context: KafkaContext,
  ) {
    console.log('[Order] Received payment.completed:', data);
    await this.orderService.handlePaymentCompleted(data);
  }

  @MessagePattern('payment.succeeded')
  async handlePaymentSucceeded(
    @Payload() payload: PaymentSucceededEvent,
    @Ctx() context: KafkaContext,
  ) {
    this.logger.log(
      `[OrderMS] payment.succeeded for order ${payload.orderId}, payment ${payload.paymentId}`,
    );

    await this.orderService.markOrderAsPaid(payload.orderId);
  }

  // 👇 New: payment.failed event from Payment MS
  @MessagePattern('payment.failed')
  async handlePaymentFailed(
    @Payload() payload: PaymentFailedEvent,
    @Ctx() context: KafkaContext,
  ) {
    this.logger.warn(
      `[OrderMS] payment.failed for order ${payload.orderId}, payment ${payload.paymentId}, reason: ${payload.failureMessage ?? 'N/A'}`,
    );

    await this.orderService.cancelOrderAndReleaseStock(payload.orderId);
  }
}
