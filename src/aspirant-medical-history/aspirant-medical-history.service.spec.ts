import { Test, TestingModule } from '@nestjs/testing';
import { AspirantMedicalHistoryService } from './aspirant-medical-history.service';

describe('AspirantMedicalHistoryService', () => {
  let service: AspirantMedicalHistoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AspirantMedicalHistoryService],
    }).compile();

    service = module.get<AspirantMedicalHistoryService>(AspirantMedicalHistoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
