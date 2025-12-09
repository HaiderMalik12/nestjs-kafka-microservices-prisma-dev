export interface ProductCreatedEvent {
  name: string;
  price: number;
  description?: string;
  stock?: number;
}