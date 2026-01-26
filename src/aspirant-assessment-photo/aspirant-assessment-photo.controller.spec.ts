import { Test, TestingModule } from '@nestjs/testing';
import { AspirantAssessmentPhotoController } from './aspirant-assessment-photo.controller';
import { AspirantAssessmentPhotoService } from './aspirant-assessment-photo.service';

describe('AspirantAssessmentPhotoController', () => {
  let controller: AspirantAssessmentPhotoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AspirantAssessmentPhotoController],
      providers: [AspirantAssessmentPhotoService],
    }).compile();

    controller = module.get<AspirantAssessmentPhotoController>(AspirantAssessmentPhotoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
