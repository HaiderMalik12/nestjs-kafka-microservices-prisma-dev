import { Module } from '@nestjs/common';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ProductProducerService } from './product-producer/product-producer.service';
import { ProductProducerController } from './product-producer/product-producer.controller';
import { OrderProducerService } from './order/order.service';
import { OrderController } from './order/order.controller';

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
    ])
  ],
  controllers: [ApiGatewayController, ProductProducerController, OrderController],
  providers: [ApiGatewayService, ProductProducerService, OrderProducerService],
})
export class ApiGatewayModule {}
