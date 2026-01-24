import { Test, TestingModule } from '@nestjs/testing';
import { AspirantesController } from './aspirantes.controller';
import { AspirantesService } from './aspirantes.service';

describe('AspirantesController', () => {
  let controller: AspirantesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AspirantesController],
      providers: [AspirantesService],
    }).compile();

    controller = module.get<AspirantesController>(AspirantesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
