import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);
   app.useGlobalPipes(new ValidationPipe({
    whitelist: true,            // strips unknown fields
    forbidNonWhitelisted: true, // throws error if unknown fields exist
    transform: true,            // transforms body to DTO class
  }));
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
