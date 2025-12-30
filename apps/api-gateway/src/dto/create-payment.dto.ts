import { IsInt, IsIn, IsOptional, IsString } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  orderId: string;

  @IsString()
  @IsIn(['stripe'])
  provider: 'stripe';

  @IsOptional()
  @IsString()
  currency?: string;

  // Option: you can decide whether to pass amount from frontend/gateway or
  // look it up inside Payment MS. For now we include it.
  @IsString()
  amount: string; // e.g. "99.99"
}
