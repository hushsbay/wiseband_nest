import { Test, TestingModule } from '@nestjs/testing';
import { PhotometaService } from './photometa.service';

describe('PhotometaService', () => {
  let service: PhotometaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PhotometaService],
    }).compile();

    service = module.get<PhotometaService>(PhotometaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
