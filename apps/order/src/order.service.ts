import {
  BadRequestException,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Prisma } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from './prisma.service';

interface CreateOrderItemPayload {
  productId: number;
  quantity: number;
}

interface CreateOrderPayload {
  items: CreateOrderItemPayload[];
  note?: string;
}

interface ProductSnapshot {
  id: number;
  name: string;
  price: number;
  stock: number;
}

@Injectable()
export class OrderService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('PRODUCT_SERVICE_CLIENT')
    private readonly productClient: ClientKafka,
  ) {}

  async onModuleInit() {
    this.productClient.subscribeToResponseOf('product.batchFetch');
    this.productClient.subscribeToResponseOf('product.decrementStock');
    this.productClient.subscribeToResponseOf('product.incrementStock');
    await this.productClient.connect();
  }

  getHello(): string {
    return 'Hello World!';
  }

  async createOrder(payload: CreateOrderPayload) {
    console.log('Creating order with payload:', payload);

    const items = this.normalizeItems(payload?.items);
    if (items.length === 0) {
      throw new BadRequestException(
        'Order must contain at least 1 valid item.',
      );
    }

    // 1️⃣ Fetch product snapshots
    const products = await this.fetchProducts(items.map((i) => i.productId));

    console.log('Fetched product snapshots:', products);

    const byId = new Map(products.map((p) => [p.id, p]));
    const missing = items.map((i) => i.productId).filter((id) => !byId.has(id));
    if (missing.length) {
      throw new BadRequestException(
        `Products not found: ${missing.join(', ')}`,
      );
    }

    console.log('All products found, proceeding to stock decrement');

    // 2️⃣ DECREMENT stock (reserve)
    await this.decrementStock(items);

    console.log('Stock decremented successfully, proceeding to order creation');
    // 3️⃣ Create order (compensate on failure)
    try {
      const order = await this.prisma.$transaction(async (tx) => {
        // calculate total amount
        let totalAmount = new Prisma.Decimal(0);
        for (const item of items) {
          const product = byId.get(item.productId)!;
          const itemTotal = new Prisma.Decimal(product.price).mul(
            item.quantity,
          );
          totalAmount = totalAmount.add(itemTotal);
        }

        console.log('Total order amount calculated:', totalAmount.toString());
        const createdOrder = await tx.order.create({
          data: { totalAmount },
        });

        console.log('Order record created with ID:', createdOrder.id);

        await tx.orderItem.createMany({
          data: products.map((product) => {
            const item = items.find((i) => i.productId === product.id)!;
            return {
              orderId: createdOrder.id,
              productId: product.id.toString(),
              quantity: item.quantity,
              unitPriceAtOrder: new Prisma.Decimal(product.price),
              productNameAtOrder: product.name,
            };
          }),
        });

        return createdOrder;
      });

      return order;
    } catch (err) {
      // 🔁 Compensation
      try {
        await this.incrementStock(items);
      } catch (stockErr) {
        console.error(
          'CRITICAL: Order failed and stock increment failed',
          stockErr,
        );
      }
      throw err;
    }
  }
  private fetchProducts(ids: number[]) {
    return firstValueFrom(
      this.productClient.send<ProductSnapshot[]>('product.batchFetch', {
        ids,
      }),
    );
  }

  private decrementStock(items: { productId: number; quantity: number }[]) {
    return firstValueFrom(
      this.productClient.send('product.decrementStock', { items }),
    );
  }

  private incrementStock(items: { productId: number; quantity: number }[]) {
    return firstValueFrom(
      this.productClient.send('product.incrementStock', { items }),
    );
  }

  private normalizeItems(items: { productId: number; quantity: number }[]) {
    const map = new Map<number, number>();

    for (const raw of items ?? []) {
      const productId = Number(raw?.productId);
      const quantity = Number(raw?.quantity);

      if (!Number.isFinite(productId) || productId <= 0) continue;
      if (!Number.isFinite(quantity) || quantity <= 0) continue;

      // merge duplicate product rows
      map.set(productId, (map.get(productId) ?? 0) + quantity);
    }

    return [...map.entries()].map(([productId, quantity]) => ({
      productId,
      quantity,
    }));
  }
}
