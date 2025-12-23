import { Body, Controller, Param, Post } from '@nestjs/common';
import { OrderProducerService } from './order.service';
import { CreateOrderDto } from '../dto/create-order.dto';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderProducerService: OrderProducerService) {}

  @Post()
  createOrder(@Body() dto: CreateOrderDto) {
    try {
      console.log('Received order creation request:', dto);
      return this.orderProducerService.createOrder(dto);
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }
  @Post(':id/cancel')
  cancelOrder(
    @Param('id') orderId: string,
    @Body() body: { reason?: string } = {},
  ) {
    try {
      return this.orderProducerService.cancelOrder({
        orderId,
        reason: body.reason,
      });
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }
}
