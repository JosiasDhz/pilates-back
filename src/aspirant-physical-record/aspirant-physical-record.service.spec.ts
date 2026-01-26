import { Test, TestingModule } from '@nestjs/testing';
import { AspirantPhysicalRecordService } from './aspirant-physical-record.service';

describe('AspirantPhysicalRecordService', () => {
  let service: AspirantPhysicalRecordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AspirantPhysicalRecordService],
    }).compile();

    service = module.get<AspirantPhysicalRecordService>(AspirantPhysicalRecordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
