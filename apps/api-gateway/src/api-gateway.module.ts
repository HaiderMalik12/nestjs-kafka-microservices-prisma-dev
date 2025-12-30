import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { ClientKafka, ClientsModule, Transport } from '@nestjs/microservices';
import { ProductProducerService } from './product-producer/product-producer.service';
import { ProductProducerController } from './product-producer/product-producer.controller';
import { PaymentProducerService } from './payment-producer/payment-producer.service';
import { OrderProducerService } from './order/order.service';
import { OrderController } from './order/order.controller';
import { StripeWebhookController } from './payment-producer/stripe-webhook.controller';
import { PaymentProducerController } from './payment-producer/payment-producer.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'KAFKA_PRODUCT_CLIENT',
        transport: Transport.KAFKA, // Transport.KAFKA
        options: {
          client: {
            clientId: 'api-gateway',
            brokers: ['localhost:9092'],
          },
          consumer: {
            groupId: 'product-consumer-group',
          },
        },
      },
      {
        name: 'KAFKA_ORDER_CLIENT',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'api-gateway-order',
            brokers: ['localhost:9092'],
          },
          consumer: {
            groupId: 'order-producer-group',
          },
        },
      },
      {
        name: 'KAFKA_PAYMENT_CLIENT',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'api-gateway-payment',
            brokers: ['localhost:9092'],
          },
          consumer: {
            groupId: 'payment-producer-group',
          },
        },
      },
    ]),
  ],
  controllers: [
    ApiGatewayController,
    ProductProducerController,
    OrderController,
    StripeWebhookController,
    PaymentProducerController,
  ],
  providers: [
    ApiGatewayService,
    ProductProducerService,
    OrderProducerService,
    PaymentProducerService,
  ],
})
export class ApiGatewayModule implements OnModuleInit {
  constructor(
    @Inject('KAFKA_PAYMENT_CLIENT') private readonly paymentClient: ClientKafka,
  ) {}
  async onModuleInit() {
    // Important for request-response with Kafka:
    this.paymentClient.subscribeToResponseOf('payment.initiate');
    await this.paymentClient.connect();
  }
}
