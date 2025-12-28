export interface OrderCreatedEventPayload {
  orderId: string;
  totalAmount: string; // Decimal as string
}
