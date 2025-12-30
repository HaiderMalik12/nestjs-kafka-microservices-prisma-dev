import {
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ClientKafka } from '@nestjs/microservices';

@Controller('webhooks')
export class StripeWebhookController {
  constructor(
    @Inject('KAFKA_PAYMENT_CLIENT')
    private readonly paymentClient: ClientKafka,
  ) {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(@Req() req: Request) {
    const rawBody = req.body as Buffer;
    const signature = req.headers['stripe-signature'] as string | undefined;

    // Fire-and-forget to payment microservice
    this.paymentClient.emit('stripe.webhook', {
      rawBody: rawBody.toString('utf8'),
      signature,
    });

    return { received: true };
  }
}
