import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { ValidationPipe } from '@nestjs/common';
import { json, raw, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule, {
    bodyParser: false,
  });

  // ⭐ Enable CORS here
  app.enableCors({
    origin: [
      'http://localhost:3001', // your Next.js app
      // add other allowed origins here
    ],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
  });

  // 🔹 Stripe webhook: needs RAW body
  app.use('/webhooks/stripe', raw({ type: 'application/json' }));

  // 🔹 All other routes: normal JSON parsing
  app.use(json());
  app.use(urlencoded({ extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips unknown fields
      forbidNonWhitelisted: true, // throws error if unknown fields exist
      transform: true, // transforms body to DTO class
    }),
  );
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
