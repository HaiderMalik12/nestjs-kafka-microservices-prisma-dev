import { Controller, Get } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrderService } from './order.service';

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
}
