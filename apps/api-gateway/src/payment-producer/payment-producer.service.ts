import { Inject, Injectable } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CreatePaymentDto } from '../dto/create-payment.dto';

@Injectable()
export class PaymentProducerService {
  constructor(
    @Inject('KAFKA_PAYMENT_CLIENT') private readonly paymentClient: ClientKafka,
  ) {}

  async initiatePayment(dto: CreatePaymentDto) {
    // You could validate provider and currency here, enforce defaults, etc.
    const payload = {
      orderId: dto.orderId,
      amount: dto.amount,
      currency: dto.currency,
      provider: dto.provider,
    };

    return firstValueFrom(this.paymentClient.send('payment.initiate', payload));
  }
}
