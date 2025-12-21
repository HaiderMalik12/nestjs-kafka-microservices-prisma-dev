import { Controller, Get } from '@nestjs/common';
import { ProductService } from './product.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type {ProductCreatedEvent} from '@app/kafka/interfaces/product-create-event';
import type {ProductUpdatedEvent} from '@app/kafka/interfaces/product-update-event';
import type {ProductDeletedEvent} from '@app/kafka/interfaces/product-delete-event';

@Controller()
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  getHello(): string {
    return this.productService.getHello();
  }

   @MessagePattern('product.created')
  async handleProductCreatedMessage(
    @Payload() payload: ProductCreatedEvent,
  ) {
    console.log('Received product.created event:', payload);
    return this.productService.handleProductCreated(payload);
  }

  @MessagePattern('product.updated')
  async handleProductUpdatedMessage(
    @Payload() payload: ProductUpdatedEvent,
  ) {
    console.log('Received product.updated event:', payload);
    return this.productService.handleProductUpdated(payload);
  }

  @MessagePattern('product.deleted')
  async handleProductDeletedMessage(
    @Payload() payload: ProductDeletedEvent,
  ) {
    console.log('Received product.deleted event:', payload);
    return this.productService.handleProductDeleted(payload.id);
  }

  @MessagePattern('product.batchFetch')
  async handleProductBatchFetch(@Payload() payload: { ids: number[] }) {
    console.log('Received product.batchFetch request:', payload);
    const ids = Array.from(new Set(payload?.ids ?? []))
      .map((id) => Number(id))
      .filter((id) => !Number.isNaN(id) && id > 0);
    return this.productService.findByIds(ids);
  }
}
