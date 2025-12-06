import { Body, Controller, Post, Put } from '@nestjs/common';
import { ProductProducerService } from './product-producer.service';
import { CreateProductDto } from '../dto/create-product.dto';

@Controller('products')
export class ProductProducerController {
    constructor(private readonly productProducerService: ProductProducerService) {}
    
    @Post()
    async createProduct(
        @Body() createProductDto: CreateProductDto
    ) {
        await this.productProducerService.emitProductCreatedEvent(createProductDto);
        return { message: 'Product created event emitted', product: createProductDto };
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
