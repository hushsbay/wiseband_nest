import { Test, TestingModule } from '@nestjs/testing';
import { ChanmsgController } from './chanmsg.controller';
import { ChanmsgService } from './chanmsg.service';

describe('ChanmsgController', () => {
  let controller: ChanmsgController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChanmsgController],
      providers: [ChanmsgService],
    }).compile();

    controller = module.get<ChanmsgController>(ChanmsgController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
