import { Test, TestingModule } from '@nestjs/testing';
import { ChanmsgService } from './chanmsg.service';

describe('ChanmsgService', () => {
  let service: ChanmsgService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChanmsgService],
    }).compile();

    service = module.get<ChanmsgService>(ChanmsgService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
