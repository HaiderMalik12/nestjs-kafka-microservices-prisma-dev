import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Prisma, PaymentStatus } from './generated/prisma-client';
import { OrderCreatedEventPayload } from './order-created.payload';

@Injectable()
export class PaymentService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    // @Inject('PAYMENT_EVENTS_CLIENT') private readonly paymentEventsClient: ClientKafka, // when you emit events
  ) {}

  async onModuleInit() {
    // await this.paymentEventsClient.connect();
  }

  async processOrderPayment(payload: OrderCreatedEventPayload) {
    const { orderId, totalAmount } = payload;

    console.log(
      '[PaymentService] Starting payment process for order:',
      orderId,
      'amount:',
      totalAmount,
    );

    // 1️⃣ Parse amount safely
    let amountDecimal: Prisma.Decimal;
    try {
      amountDecimal = new Prisma.Decimal(totalAmount);
    } catch (e) {
      console.error(
        '[PaymentService] Invalid totalAmount, cannot create payment:',
        totalAmount,
      );
      // In a real system you might emit payment.failed here too.
      return;
    }

    let payment;

    try {
      // 2️⃣ Idempotent "get or create" using unique(orderId)
      payment = await this.prisma.payment.upsert({
        where: { orderId },
        update: {}, // do not change anything here yet; we only change status after gateway response
        create: {
          orderId,
          amount: amountDecimal,
          status: PaymentStatus.PENDING,
        },
      });

      if (payment.status !== PaymentStatus.PENDING) {
        console.log(
          '[PaymentService] Payment already finalized, skipping:',
          payment.status,
        );
        return payment;
      }

      // 3️⃣ Call “gateway” (sync now, async/Stripe later)
      const result = await this.simulateCharge(amountDecimal);

      // 4️⃣ Update based on success/failure
      if (result.success) {
        payment = await this.prisma.payment.update({
          where: { orderId },
          data: {
            status: PaymentStatus.SUCCESS,
            transactionRef: result.transactionRef,
            errorMessage: null,
          },
        });

        console.log('[PaymentService] Payment SUCCESS for order:', orderId);

        // later:
        // await this.paymentEventsClient.emit('payment.completed', {...});
      } else {
        payment = await this.prisma.payment.update({
          where: { orderId },
          data: {
            status: PaymentStatus.FAILED,
            transactionRef: result.transactionRef,
            errorMessage: result.errorMessage,
          },
        });

        console.log('[PaymentService] Payment FAILED for order:', orderId);

        // later:
        // await this.paymentEventsClient.emit('payment.failed', {...});
      }

      return payment;
    } catch (err) {
      console.error('[PaymentService] Error during payment processing:', err);

      // Optional: mark as FAILED if we got far enough to have a row
      if (payment && payment.status === PaymentStatus.PENDING) {
        try {
          payment = await this.prisma.payment.update({
            where: { orderId },
            data: {
              status: PaymentStatus.FAILED,
              errorMessage: 'Internal payment error',
            },
          });
        } catch (updateErr) {
          console.error(
            '[PaymentService] Failed to set payment to FAILED after error:',
            updateErr,
          );
        }
      }

      throw err; // let Nest/Kafka error handling work
    }
  }

  // Make this async-ready now
  private async simulateCharge(amount: Prisma.Decimal): Promise<{
    success: boolean;
    transactionRef: string;
    errorMessage?: string;
  }> {
    // 🔮 Later you'll replace this with a real Stripe call
    const rand = Math.random();
    const success = rand < 0.8;

    const transactionRef = `SIM-${Date.now()}-${Math.floor(rand * 100000)}`;

    if (success) {
      return {
        success: true,
        transactionRef,
      };
    }

    return {
      success: false,
      transactionRef,
      errorMessage: 'Card declined (simulated)',
    };
  }
}
