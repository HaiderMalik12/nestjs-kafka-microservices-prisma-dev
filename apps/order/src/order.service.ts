import { BadRequestException, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Prisma } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from './prisma/prisma.service';

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
    @Inject('PRODUCT_SERVICE_CLIENT') private readonly productClient: ClientKafka,
  ) {}

  async onModuleInit() {
    this.productClient.subscribeToResponseOf('product.batchFetch');
    await this.productClient.connect();
  }

  getHello(): string {
    return 'Hello World!';
  }

  async createOrder(payload: CreateOrderPayload) {

    console.log('Creating order with payload:', payload);
    

    // fetch product details
    const products = await this.fetchProducts(payload.items.map(i => i.productId));
    console.log('Fetched products:', products);

    // Create order with items
    const order = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          totalAmount: products.reduce((sum, product) => {
            const item = payload.items.find(i => i.productId === product.id);
            return sum.add(new Prisma.Decimal(product.price).mul(item ? item.quantity : 0));
          }, new Prisma.Decimal(0)),
        },
      });

      const orderItemsData = products.map(product => {
        const item = payload.items.find(i => i.productId === product.id);
        return {
          orderId: order.id,
          productId: product.id.toString(),
          quantity: item ? item.quantity : 0,
          unitPriceAtOrder: new Prisma.Decimal(product.price),
          productNameAtOrder: product.name,
        };
      });

      await tx.orderItem.createMany({
        data: orderItemsData,
      });

      return order;
    });

    console.log('Order created successfully:', order);

    return order;
  
  }


  private fetchProducts(ids: number[]) {
    return firstValueFrom(
      this.productClient.send<ProductSnapshot[]>('product.batchFetch', {
        ids,
      }),
    );
  }
}
