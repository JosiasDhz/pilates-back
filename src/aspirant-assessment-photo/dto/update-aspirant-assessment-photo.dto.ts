import { PartialType } from '@nestjs/mapped-types';
import { CreateAspirantAssessmentPhotoDto } from './create-aspirant-assessment-photo.dto';

export class UpdateAspirantAssessmentPhotoDto extends PartialType(CreateAspirantAssessmentPhotoDto) {}
