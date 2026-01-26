import { Test, TestingModule } from '@nestjs/testing';
import { AspirantPhysicalRecordController } from './aspirant-physical-record.controller';
import { AspirantPhysicalRecordService } from './aspirant-physical-record.service';

describe('AspirantPhysicalRecordController', () => {
  let controller: AspirantPhysicalRecordController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AspirantPhysicalRecordController],
      providers: [AspirantPhysicalRecordService],
    }).compile();

    controller = module.get<AspirantPhysicalRecordController>(AspirantPhysicalRecordController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
