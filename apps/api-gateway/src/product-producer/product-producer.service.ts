import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductCreatedEvent,  } from '@app/kafka/interfaces/product-create-event';
import { ProductUpdatedEvent } from '@app/kafka/interfaces/product-update-event';
import { ProductDeletedEvent } from '@app/kafka/interfaces/product-delete-event';

@Injectable()
export class ProductProducerService implements OnModuleInit {
    constructor(
        @Inject('KAFKA_PRODUCT_CLIENT') private readonly kafkaClient
    ) {}
    async onModuleInit() {
        await this.kafkaClient.connect();
    }

    async emitProductCreatedEvent(product: CreateProductDto) {
        const event = {
            name: product.name,
            price: product.price,
            createdAt: new Date().toISOString()
        } as ProductCreatedEvent;
        
        await this.kafkaClient.emit('product.created', event);
    } 
    
    async emitProductUpdatedEvent(id: number, update: Partial<CreateProductDto>) {
        const event: ProductUpdatedEvent = {
      id,
      ...update,
    };
        await this.kafkaClient.emit('product.updated', event);
    }

    async emitProductDeletedEvent(id: number) {
    const event: ProductDeletedEvent = {
        id,
    };

    await this.kafkaClient.emit('product.deleted', event);
  }

}
