import { Controller, Post, Put } from '@nestjs/common';
import { ProductProducerService } from './product-producer.service';

@Controller('products')
export class ProductProducerController {
    constructor(private readonly productProducerService: ProductProducerService) {}
    
    @Post()
    async createProduct() {
        const newProduct = {
            id: Math.floor(Math.random() * 1000),
            name: 'Sample Product',
            price: parseFloat((Math.random() * 100).toFixed(2)),
        };
        await this.productProducerService.emitProductCreatedEvent(newProduct);
        return { message: 'Product created event emitted', product: newProduct };
    }

    @Put(':id')
    async updateProduct() {
        const product = {
            id: Math.floor(Math.random() * 1000),
            name: 'Sample Product',
            price: parseFloat((Math.random() * 100).toFixed(2)),
        };
        await this.productProducerService.emitProductUpdatedEvent(product);
        return { message: 'Product update event emitted', product: product };
    }
}
