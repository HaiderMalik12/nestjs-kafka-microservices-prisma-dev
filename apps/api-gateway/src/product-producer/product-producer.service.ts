import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class ProductProducerService implements OnModuleInit {
    constructor(
        @Inject('KAFKA_PRODUCT_CLIENT') private readonly kafkaClient
    ) {}
    async onModuleInit() {
        await this.kafkaClient.connect();
    }

    async emitProductCreatedEvent(product: {id: number, name: string, price: number}) {
        await this.kafkaClient.emit('product.created', {
            ...product,
            createdAt: new Date().toISOString()
        });
    } 
    
    // EXERCISE FOR STUDENTS TO IMPLEMENT UPDATE EVENT
    async emitProductUpdatedEvent(product: {id: number, name: string, price: number}) {
        await this.kafkaClient.emit('product.updated', {
            ...product,
            updatedAt: new Date().toISOString()
        });
    }

}
