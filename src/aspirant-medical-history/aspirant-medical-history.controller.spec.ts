import { Test, TestingModule } from '@nestjs/testing';
import { AspirantMedicalHistoryController } from './aspirant-medical-history.controller';
import { AspirantMedicalHistoryService } from './aspirant-medical-history.service';

describe('AspirantMedicalHistoryController', () => {
  let controller: AspirantMedicalHistoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AspirantMedicalHistoryController],
      providers: [AspirantMedicalHistoryService],
    }).compile();

    controller = module.get<AspirantMedicalHistoryController>(AspirantMedicalHistoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
