import { NestFactory } from '@nestjs/core';
import { ProductModule } from './product.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(ProductModule, {
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: ['localhost:9092'],
      },
      consumer: {
        groupId: 'product-service-consumer',
      }
    }
  })
  await app.listen();
  console.log('Product service is running at Microservices mode')
}
bootstrap();
