import { NestFactory } from '@nestjs/core';
import { OrderModule } from './order.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(process.cwd(), 'apps/order/.env'),
  override: true,
});

async function bootstrap() {
  console.log('[ORDER main.ts] DATABASE_URL =', process.env.DATABASE_URL);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    OrderModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          brokers: ['localhost:9092'],
        },
        consumer: {
          groupId: 'order-service-consumer',
        },
      },
    },
  );
  await app.listen();
  console.log('Order service is running at Microservices mode');
}
bootstrap();
