import { Module } from '@nestjs/common';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ProductProducerService } from './product-producer/product-producer.service';
import { ProductProducerController } from './product-producer/product-producer.controller';

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
    }
    ])
  ],
  controllers: [ApiGatewayController, ProductProducerController],
  providers: [ApiGatewayService, ProductProducerService],
})
export class ApiGatewayModule {}
