import { Module } from '@nestjs/common';
import { AspirantAssessmentPhotoService } from './aspirant-assessment-photo.service';
import { AspirantAssessmentPhotoController } from './aspirant-assessment-photo.controller';

@Module({
  controllers: [AspirantAssessmentPhotoController],
  providers: [AspirantAssessmentPhotoService],
})
export class AspirantAssessmentPhotoModule {}
