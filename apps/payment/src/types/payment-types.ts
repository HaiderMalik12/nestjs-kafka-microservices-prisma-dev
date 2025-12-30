export class PaymentInitiatePayload {
  orderId: number;
  // Option A design: Payment MS will fetch order amount from Order MS later.
  // For now, we’ll pass amount for simplicity, but you can refactor to query Order MS.
  amount: string; // decimal as string, e.g. "99.99"
  currency?: string; // default in service
  provider: 'stripe';
}

export class PaymentInitiateResponse {
  paymentId: string;
  clientSecret: string;
  amount: string;
  currency: string;
  status: string;
}
