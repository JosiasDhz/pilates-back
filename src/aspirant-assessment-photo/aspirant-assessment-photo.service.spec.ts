import { Test, TestingModule } from '@nestjs/testing';
import { AspirantAssessmentPhotoService } from './aspirant-assessment-photo.service';

describe('AspirantAssessmentPhotoService', () => {
  let service: AspirantAssessmentPhotoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AspirantAssessmentPhotoService],
    }).compile();

    service = module.get<AspirantAssessmentPhotoService>(AspirantAssessmentPhotoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
