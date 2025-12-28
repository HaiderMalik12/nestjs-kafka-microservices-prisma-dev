import { Controller, Get } from '@nestjs/common';
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
  PaymentFailedEventPayload,
} from './events/payment-events';

@Controller()
export class OrderController {
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

  @EventPattern('payment.failed')
  async handlePaymentFailed(
    @Payload() data: PaymentFailedEventPayload,
    @Ctx() context: KafkaContext,
  ) {
    console.log('[Order] Received payment.failed:', data);
    await this.orderService.handlePaymentFailed(data);
  }
}
