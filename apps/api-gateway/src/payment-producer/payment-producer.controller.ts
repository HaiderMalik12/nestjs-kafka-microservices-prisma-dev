import { Body, Controller, Post } from '@nestjs/common';
import { PaymentService } from './payment-producer.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  async createPayment(@Body() dto: CreatePaymentDto) {
    // In Option A flow:
    // 1. Frontend calls POST /orders → gets { orderId, totalAmount }
    // 2. Then calls POST /payments with { orderId, amount: totalAmount, provider: 'stripe' }
    return this.paymentService.initiatePayment(dto);
  }
}
