import { Body, Controller, Post } from '@nestjs/common';
import { PaymentProducerService } from './payment-producer.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';

@Controller('payments')
export class PaymentProducerController {
  constructor(private readonly paymentService: PaymentProducerService) {}

  @Post()
  async createPayment(@Body() dto: CreatePaymentDto) {
    console.log('[API Gateway] Received payment creation request:', dto);
    // In Option A flow:
    // 1. Frontend calls POST /orders → gets { orderId, totalAmount }
    // 2. Then calls POST /payments with { orderId, amount: totalAmount, provider: 'stripe' }
    return this.paymentService.initiatePayment(dto);
  }
}
