import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Prisma, PaymentStatus } from './generated/prisma-client';
import { OrderCreatedEventPayload } from './order-created.payload';
import { ClientKafka } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  PaymentInitiatePayload,
  PaymentInitiateResponse,
} from './types/payment-types';

@Injectable()
export class PaymentService implements OnModuleInit {
  private readonly logger = new Logger(PaymentService.name);
  private readonly stripe: Stripe;
  private readonly defaultCurrency: string = 'usd';
  private readonly defaultProvider: string = 'stripe';
  private readonly webhookSecret: string; // 👈 ADD THIS

  constructor(
    private readonly prisma: PrismaService,
    @Inject('PAYMENT_EVENTS_CLIENT')
    private readonly paymentEventsClient: ClientKafka,
    private readonly config: ConfigService,
  ) {
    const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2025-12-15.clover', // pick a stable version
    });

    this.defaultCurrency =
      this.config.get<string>('STRIPE_DEFAULT_CURRENCY') || 'usd';

    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';

    if (!this.webhookSecret) {
      this.logger.warn(
        'STRIPE_WEBHOOK_SECRET is not set – webhooks will fail verification',
      );
    }
  }

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
          currency: this.defaultCurrency,
          provider: this.defaultProvider,
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

      console.log('result: simulateCharge', result);

      // 4️⃣ Update based on success/failure
      if (result.success) {
        payment = await this.prisma.payment.update({
          where: { orderId },
          data: {
            status: PaymentStatus.SUCCEEDED,
            transactionRef: result.transactionRef,
            errorMessage: null,
          },
        });

        console.log('[PaymentService] Payment SUCCESS for order:', orderId);

        // later:
        // await this.paymentEventsClient.emit('payment.completed', {...});

        // 🔊 Emit payment.completed
        await this.paymentEventsClient.emit('payment.completed', {
          orderId,
          paymentId: payment.id,
          amount: payment.amount.toString(),
          transactionRef: payment.transactionRef,
        });

        console.log(
          '[PaymentService] Emitted payment.completed for order:',
          orderId,
        );
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
        //🔊 Emit payment.failed
        await this.paymentEventsClient.emit('payment.failed', {
          orderId,
          paymentId: payment.id,
          amount: payment.amount.toString(),
          errorMessage: payment.errorMessage,
        });

        console.log(
          '[PaymentService] Emitted payment.failed for order:',
          orderId,
        );
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

  async initiateStripePayment(
    payload: PaymentInitiatePayload,
  ): Promise<PaymentInitiateResponse> {
    const currency = payload.currency || this.defaultCurrency;

    this.logger.log(
      `Initiating Stripe payment for order ${payload.orderId} amount ${payload.amount} ${currency}`,
    );

    try {
      // 1️⃣ Create Stripe PaymentIntent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: this.toStripeAmount(payload.amount, currency),
        currency: payload.currency || this.defaultCurrency,
        metadata: {
          orderId: String(payload.orderId),
        },
      });

      console.log('PaymentIntent created:', paymentIntent.id);

      // 2️⃣ Persist Payment record
      const payment = await this.prisma.payment.create({
        data: {
          orderId: payload.orderId.toString(),
          amount: payload.amount,
          currency: payload.currency || this.defaultCurrency,
          provider: payload.provider || this.defaultProvider,
          status: PaymentStatus.PENDING,
          stripePaymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret ?? null,
        },
      });

      console.log('Payment created:', payment.id);

      if (!paymentIntent.client_secret) {
        this.logger.error(
          `Stripe PaymentIntent missing client_secret for order ${payload.orderId}`,
        );
        throw new InternalServerErrorException('Stripe client secret missing');
      }

      // 3️⃣ Return clientSecret to frontend via gateway
      return {
        paymentId: payment.id,
        clientSecret: paymentIntent.client_secret,
        amount: payment.amount.toString(),
        currency,
        status: payment.status,
      };
    } catch (error) {
      this.logger.error(
        `Error initiating Stripe payment for order ${payload.orderId}`,
        error.stack || error,
      );
      throw new InternalServerErrorException('Failed to initiate payment');
    }
  }

  /**
   * Stripe expects amount in smallest currency unit (e.g. cents).
   * If your amount is "99.99" as string, convert appropriately.
   */
  private toStripeAmount(amount: string, currency: string): number {
    // Simple generic conversion; you can customize per-currency
    const decimal = Number(amount);
    if (Number.isNaN(decimal)) {
      throw new Error(`Invalid amount: ${amount}`);
    }
    // assuming 2 decimal places
    return Math.round(decimal * 100);
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!signature) {
      this.logger.warn('Missing Stripe signature header');
      throw new InternalServerErrorException('Missing Stripe signature');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch (err) {
      this.logger.error('Stripe webhook signature verification failed', err);
      throw new InternalServerErrorException('Invalid Stripe signature');
    }

    this.logger.log(`Stripe webhook event received: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      default:
        this.logger.log(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ) {
    const stripeId = paymentIntent.id;

    // 1️⃣ Find payment by Stripe intent id
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: stripeId },
    });

    if (!payment) {
      this.logger.error(
        `Payment record not found for Stripe PaymentIntent ${stripeId}`,
      );
      return;
    }

    // 2️⃣ Idempotency: if already succeeded, skip
    if (payment.status === 'SUCCEEDED') {
      this.logger.log(
        `Payment ${payment.id} already SUCCEEDED — skipping update`,
      );
      return;
    }

    // 3️⃣ Update DB
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCEEDED',
      },
    });

    this.logger.log(
      `💰 Payment ${updated.id} marked as SUCCEEDED for order ${updated.orderId}`,
    );

    // 4️⃣ Emit Kafka event
    const eventPayload = {
      paymentId: updated.id,
      orderId: updated.orderId,
      amount: updated.amount.toString(),
      currency: updated.currency,
      provider: updated.provider,
      stripePaymentIntentId: updated.stripePaymentIntentId,
      status: updated.status,
    };

    this.paymentEventsClient.emit('payment.succeeded', eventPayload);
  }
  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    const stripeId = paymentIntent.id;

    // 1️⃣ Find payment
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: stripeId },
    });

    if (!payment) {
      this.logger.error(
        `Payment record not found for Stripe PaymentIntent ${stripeId}`,
      );
      return;
    }

    // 2️⃣ Idempotency: skip if already failed
    if (payment.status === 'FAILED') {
      this.logger.log(`Payment ${payment.id} already FAILED — skipping update`);
      return;
    }

    // 3️⃣ Update DB
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
      },
    });

    this.logger.log(
      `❌ Payment ${updated.id} marked as FAILED for order ${updated.orderId}`,
    );

    const lastPaymentError = paymentIntent.last_payment_error;

    // 4️⃣ Emit Kafka event
    const eventPayload = {
      paymentId: updated.id,
      orderId: updated.orderId,
      amount: updated.amount.toString(),
      currency: updated.currency,
      provider: updated.provider,
      stripePaymentIntentId: updated.stripePaymentIntentId,
      status: updated.status,
      failureCode: lastPaymentError?.code,
      failureMessage: lastPaymentError?.message,
    };

    this.paymentEventsClient.emit('payment.failed', eventPayload);
  }
}
