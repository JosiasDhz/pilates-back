import { Module } from '@nestjs/common';
import { AspirantPhysicalRecordService } from './aspirant-physical-record.service';
import { AspirantPhysicalRecordController } from './aspirant-physical-record.controller';

@Module({
  controllers: [AspirantPhysicalRecordController],
  providers: [AspirantPhysicalRecordService],
})
export class AspirantPhysicalRecordModule {}
