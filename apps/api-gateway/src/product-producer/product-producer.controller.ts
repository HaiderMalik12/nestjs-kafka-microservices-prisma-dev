import { Body, Controller, Delete, Param, Post, Put } from '@nestjs/common';
import { ProductProducerService } from './product-producer.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';

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
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    await this.productProducerService.emitProductUpdatedEvent(
      Number(id),
      updateProductDto,
    );
    return {
      message: 'Product updated event emitted',
      product: { id: Number(id), ...updateProductDto },
    };
  }

 @Delete(':id')
  async deleteProduct(@Param('id') id: string) {
    await this.productProducerService.emitProductDeletedEvent(
      Number(id),
    );
    return {
      message: 'Product deleted event emitted',
      id: Number(id),
    };
  }
}
