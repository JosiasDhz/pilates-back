import { Test, TestingModule } from '@nestjs/testing';
import { AspirantesService } from './aspirantes.service';

describe('AspirantesService', () => {
  let service: AspirantesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AspirantesService],
    }).compile();

    service = module.get<AspirantesService>(AspirantesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
