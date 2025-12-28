import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Prisma } from '@prisma/client';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { PrismaService } from './prisma.service';
import { OrderStatus } from './generated/prisma-client';

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
    @Inject('ORDER_EVENTS_CLIENT')
    private readonly orderEventsClient: ClientKafka,
  ) {}

  async onModuleInit() {
    this.productClient.subscribeToResponseOf('product.batchFetch');
    this.productClient.subscribeToResponseOf('product.decrementStock');
    this.productClient.subscribeToResponseOf('product.incrementStock');
    await this.productClient.connect();
    await this.orderEventsClient.connect();
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

      try {
        await this.orderEventsClient.emit('order.created', {
          orderId: order.id,
          totalAmount: order.totalAmount!.toString(), // Decimal → string
        });
        console.log('[OrderService] order.created event emitted');
      } catch (err) {
        console.error('[OrderService] Failed to emit order.created', err);
      }

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

  async cancelOrder(orderId: string, reason?: string) {
    try {
      if (!orderId?.trim())
        throw new BadRequestException('orderId is required');

      // 1) Load order + items
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) throw new NotFoundException('Order not found');

      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Order already cancelled');
      }

      // Optional business rule: cancel only before shipping
      const cancellable = new Set<OrderStatus>([
        OrderStatus.PENDING,
        OrderStatus.CREATED,
      ]);
      if (!cancellable.has(order.status)) {
        throw new BadRequestException(
          `Order cannot be cancelled from status: ${order.status}`,
        );
      }

      // 2) Prepare stock increment items
      const stockItems = order.items
        .map((i) => ({
          productId: Number(i.productId),
          quantity: i.quantity,
        }))
        .filter(
          (i) =>
            Number.isFinite(i.productId) && i.productId > 0 && i.quantity > 0,
        );

      // 3) Strong consistency:
      //    increment stock FIRST, then mark order cancelled in a DB transaction.
      //    If increment fails => do not cancel order.
      await this.incrementStock(stockItems);

      // 4) Mark order cancelled
      // If you want to store reason, add fields in schema (cancelReason, cancelledAt)
      const updated = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
        },
        include: { items: true },
      });

      return updated;
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }
  private decrementStock(items: { productId: number; quantity: number }[]) {
    return firstValueFrom(
      this.productClient.send('product.decrementStock', { items }).pipe(
        catchError((err) => {
          console.error('Error decrementing stock:', err);
          return throwError(() => new Error('Failed to decrement stock'));
        }),
      ),
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
