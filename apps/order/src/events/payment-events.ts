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
