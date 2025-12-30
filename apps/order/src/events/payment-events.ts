export interface PaymentCompletedEventPayload {
  orderId: string;
  paymentId: string;
  amount: string;
  transactionRef?: string | null;
}

export interface PaymentFailedEventPayload {
  orderId: string;
  paymentId: string;
  amount: string;
  errorMessage?: string | null;
}

export class PaymentSucceededEvent {
  paymentId: number;
  orderId: number;
  amount: string;
  currency: string;
  provider: string;
  stripePaymentIntentId?: string;
  status: string; // "SUCCEEDED"
}

export class PaymentFailedEvent {
  paymentId: number;
  orderId: number;
  amount: string;
  currency: string;
  provider: string;
  stripePaymentIntentId?: string;
  status: string; // "FAILED"
  failureCode?: string;
  failureMessage?: string;
}
