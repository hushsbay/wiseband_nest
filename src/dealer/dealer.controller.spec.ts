import { Test, TestingModule } from '@nestjs/testing';
import { DealerController } from './dealer.controller';
import { DealerService } from './dealer.service';

describe('DealerController', () => {
  let controller: DealerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DealerController],
      providers: [DealerService],
    }).compile();

    controller = module.get<DealerController>(DealerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
