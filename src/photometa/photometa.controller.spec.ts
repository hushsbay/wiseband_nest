import { Test, TestingModule } from '@nestjs/testing';
import { PhotometaController } from './photometa.controller';
import { PhotometaService } from './photometa.service';

describe('PhotometaController', () => {
  let controller: PhotometaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PhotometaController],
      providers: [PhotometaService],
    }).compile();

    controller = module.get<PhotometaController>(PhotometaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
