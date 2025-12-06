import { Controller, Get } from '@nestjs/common';
import { ProductService } from './product.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import * as PayloadType from '@app/kafka/interfaces/product-create-event';

@Controller()
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  getHello(): string {
    return this.productService.getHello();
  }

  @MessagePattern('product.created')
  handleProductCreatedMessage(@Payload() payload: PayloadType.ProductCreatedEvent) {
    console.log('Received product.created event:', payload);
    // Here you can add logic to handle the created product event
  }

  @MessagePattern('product.updated')
  handleProductUpdatedMessage(@Payload() payload: any) {
    console.log('Received product.updated event:', payload);
    // Here you can add logic to handle the updated product event
  }
}
