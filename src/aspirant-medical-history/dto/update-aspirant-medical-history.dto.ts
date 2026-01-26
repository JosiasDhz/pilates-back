import { PartialType } from '@nestjs/mapped-types';
import { CreateAspirantMedicalHistoryDto } from './create-aspirant-medical-history.dto';

export class UpdateAspirantMedicalHistoryDto extends PartialType(
  CreateAspirantMedicalHistoryDto,
) {}
