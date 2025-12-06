import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductCreatedEvent } from '@app/kafka/interfaces/product-create-event';

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
    
    // EXERCISE FOR STUDENTS TO IMPLEMENT UPDATE EVENT
    async emitProductUpdatedEvent(product: {id: number, name: string, price: number}) {
        await this.kafkaClient.emit('product.updated', {
            ...product,
            updatedAt: new Date().toISOString()
        });
    }

}
