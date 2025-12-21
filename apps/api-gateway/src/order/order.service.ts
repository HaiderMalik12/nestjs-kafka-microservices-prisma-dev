import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CreateOrderDto } from '../dto/create-order.dto';

@Injectable()
export class OrderProducerService implements OnModuleInit {
  constructor(
    @Inject('KAFKA_ORDER_CLIENT') private readonly orderClient: ClientKafka,
  ) {}

  async onModuleInit() {
    this.orderClient.subscribeToResponseOf('order.create');
    await this.orderClient.connect();
  }

  createOrder(payload: CreateOrderDto) {
    try {
      return firstValueFrom(this.orderClient.send('order.create', payload));
    } catch (error) {
      console.error('Error sending order creation message:', error);
      throw error;
    }
  }
}
