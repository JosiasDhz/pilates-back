import { PartialType } from '@nestjs/mapped-types';
import { CreateStudentAssessmentDto } from './create-student-assessment.dto';

export class UpdateStudentAssessmentDto extends PartialType(CreateStudentAssessmentDto) {}
