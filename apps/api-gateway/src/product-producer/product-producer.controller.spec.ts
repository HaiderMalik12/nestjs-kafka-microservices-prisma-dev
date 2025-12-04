import { Test, TestingModule } from '@nestjs/testing';
import { ProductProducerController } from './product-producer.controller';

describe('ProductProducerController', () => {
  let controller: ProductProducerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductProducerController],
    }).compile();

    controller = module.get<ProductProducerController>(ProductProducerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
