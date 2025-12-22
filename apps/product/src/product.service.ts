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
      const normalized = this.normalizeItems(items);
      if (normalized.length === 0) {
        throw new BadRequestException('No items to decrement.');
      }

      return this.prisma.$transaction(async (tx) => {
        const ids = normalized.map((i) => i.productId);

        // 1️⃣ Ensure all products exist
        const products = await tx.product.findMany({
          where: { id: { in: ids } },
          select: { id: true, stock: true },
        });

        const found = new Set(products.map((p) => p.id));
        console.log('Products found for decrement:', products);
        const missing = ids.filter((id) => !found.has(id));
        if (missing.length) {
          throw new BadRequestException(
            `Products not found: ${missing.join(', ')}`,
          );
        }

        // 2️⃣ Atomic decrement (prevents negative stock)
        for (const it of normalized) {
          const res = await tx.product.updateMany({
            where: {
              id: it.productId,
              stock: { gte: it.quantity },
            },
            data: {
              stock: { decrement: it.quantity },
            },
          });

          console.log(
            `Decremented stock for productId=${it.productId}, quantity=${it.quantity}, affectedRows=${res.count}`,
          );

          if (res.count !== 1) {
            throw new BadRequestException(
              `Insufficient stock for productId=${it.productId}`,
            );
          }
        }

        return { ok: true };
      });
    } catch (error) {
      console.error('Error decrementing stock:', error);
      throw error;
    }
  }

  async incrementStock(items: { productId: number; quantity: number }[]) {
    const normalized = this.normalizeItems(items);
    if (normalized.length === 0) return { ok: true };

    return this.prisma.$transaction(async (tx) => {
      for (const it of normalized) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { increment: it.quantity } },
        });
      }
      return { ok: true };
    });
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
