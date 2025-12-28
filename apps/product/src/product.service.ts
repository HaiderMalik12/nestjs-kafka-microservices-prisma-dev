import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
    try {
      return this.prisma.product.create({
        data: {
          name: event.name,
          price: event.price,
          description: event.description,
          stock: event.stock,
        },
      });
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
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

  async findByIds(ids: number[]) {
    if (!ids.length) return [];
    return this.prisma.product.findMany({
      where: { id: { in: ids } },
    });
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

  async decrementStock(items: { productId: number; quantity: number }[]) {
    try {
      for (const item of items) {
        await this.prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }
      return { message: 'Stock decremented successfully' };
    } catch (error) {
      console.error('Error decrementing stock:', error);
      throw error;
    }
  }

  async incrementStock(items: { productId: number; quantity: number }[]) {
    try {
      for (const item of items) {
        await this.prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }
      return { message: 'Stock incremented successfully' };
    } catch (error) {
      console.error('Error incrementing stock:', error);
      throw error;
    }
  }

  private normalizeItems(items: { productId: number; quantity: number }[]) {
    const map = new Map<number, number>();

    for (const raw of items ?? []) {
      const productId = Number(raw?.productId);
      const quantity = Number(raw?.quantity);

      if (!Number.isFinite(productId) || productId <= 0) continue;
      if (!Number.isFinite(quantity) || quantity <= 0) continue;

      map.set(productId, (map.get(productId) ?? 0) + quantity);
    }

    return [...map.entries()].map(([productId, quantity]) => ({
      productId,
      quantity,
    }));
  }
}
