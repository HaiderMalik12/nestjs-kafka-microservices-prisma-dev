import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { CreateOrderDto } from '../dto/create-order.dto';

@Injectable()
export class OrderProducerService implements OnModuleInit {
  constructor(
    @Inject('KAFKA_ORDER_CLIENT') private readonly orderClient: ClientKafka,
  ) {}

  async onModuleInit() {
    this.orderClient.subscribeToResponseOf('order.create');
    this.orderClient.subscribeToResponseOf('order.cancel'); // ✅ add
    await this.orderClient.connect();
  }

  createOrder(payload: CreateOrderDto) {
    return firstValueFrom(
      this.orderClient.send('order.create', payload).pipe(
        catchError((err) => {
          console.error('Error in createOrder response:', err);
          return throwError(
            () => new Error('Failed to create order', err.message),
          );
        }),
      ),
    );
  }

  cancelOrder(payload: { orderId: string; reason?: string }) {
    return firstValueFrom(
      this.orderClient.send('order.cancel', payload).pipe(
        catchError((err) => {
          console.error('Error in cancelOrder response:', err);
          return throwError(() => new Error('Failed to cancel order'));
        }),
      ),
    );
  }
}
