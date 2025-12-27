import { NestFactory } from '@nestjs/core';
import { PaymentModule } from './payment.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(process.cwd(), 'apps/payment/.env'),
  override: true,
});

async function bootstrap() {
  console.log('[Payment main.ts] DATABASE_URL =', process.env.DATABASE_URL);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    PaymentModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          brokers: ['localhost:9092'],
        },
        consumer: {
          groupId: 'payment-service-consumer',
        },
      },
    },
  );
  await app.listen();
  console.log('Payment service is running at Microservices mode');
}
bootstrap();
