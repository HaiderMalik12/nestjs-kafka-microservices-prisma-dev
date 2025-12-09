import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma';
import type { ProductCreatedEvent } from '@app/kafka/interfaces/product-create-event';
import type { ProductUpdatedEvent } from '@app/kafka/interfaces/product-update-event';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}
  getHello(): string {
    return 'Hello World!';
  }

   async handleProductCreated(event: ProductCreatedEvent) {
    return this.prisma.product.create({
      data: {
        name: event.name,
        price: event.price,
        description: event.description,
        stock: event.stock,
      },
    });
  }

   async handleProductUpdated(event: ProductUpdatedEvent) {
    const { id, ...rest } = event;
    // Remove metadata fields if you don’t want them in DB
    delete (rest as any).updatedAt;

    try {
      return await this.prisma.product.update({
        where: { id },
        data: rest,
      });
    } catch {
      throw new NotFoundException(`Product ${id} not found`);
    }
  }

  async handleProductDeleted(id: number) {
    try {
      await this.prisma.product.delete({
        where: { id },
      });
    } catch {
      throw new NotFoundException(`Product ${id} not found`);
    }
  }

  // Query side
  async findAll() {
    return this.prisma.product.findMany({
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }
}
