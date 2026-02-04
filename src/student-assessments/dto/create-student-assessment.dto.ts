import { IsString, IsOptional, IsBoolean, IsDate, ValidateNested, IsArray, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStudentAssessmentMedicalHistoryDto {
  @IsBoolean()
  @IsOptional()
  hasInjury?: boolean;

  @IsString()
  @IsOptional()
  injuryLocation?: string;

  @IsString()
  @IsOptional()
  injuryTime?: string;

  @IsBoolean()
  @IsOptional()
  hasPhysicalAilment?: boolean;

  @IsString()
  @IsOptional()
  ailmentDetail?: string;

  @IsString()
  @IsOptional()
  surgeryComments?: string;

  @IsString()
  @IsOptional()
  additionalInfo?: string;
}

export class CreateStudentAssessmentPhysicalRecordDto {
  @IsOptional()
  weight?: number;

  @IsOptional()
  height?: number;

  @IsOptional()
  flexibility?: string;

  @IsOptional()
  strength?: string;

  @IsOptional()
  balance?: string;

  @IsOptional()
  posture?: string;

  @IsOptional()
  complexion?: string;

  @IsOptional()
  rangeOfMotion?: string;

  @IsOptional()
  observations?: string;
}

export class CreateStudentAssessmentDto {
  @IsUUID()
  studentId: string;

  @IsDate()
  @Type(() => Date)
  assessmentDate: Date;

  @IsString()
  @IsOptional()
  assessmentComments?: string;

  @IsString()
  @IsOptional()
  assessmentNotes?: string;

  @ValidateNested()
  @Type(() => CreateStudentAssessmentMedicalHistoryDto)
  @IsOptional()
  medicalHistory?: CreateStudentAssessmentMedicalHistoryDto;

  @ValidateNested()
  @Type(() => CreateStudentAssessmentPhysicalRecordDto)
  @IsOptional()
  physicalRecord?: CreateStudentAssessmentPhysicalRecordDto;

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  photoFileIds?: string[];
}
