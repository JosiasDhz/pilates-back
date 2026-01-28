import { IsString, IsEmail, IsOptional, IsBoolean, ValidateNested, ValidateIf, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateAspirantPhysicalRecordDto } from './create-user.dto';
import { CreateAspirantMedicalHistoryDto } from './create-user.dto';

export class RegisterStudentDto {
  @IsString()
  name: string;

  @IsString()
  lastName: string;

  @IsString()
  @IsOptional()
  secondLastName?: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  phone: string;

  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsBoolean()
  @IsOptional()
  isStudent?: boolean;

  @ValidateNested()
  @Type(() => CreateAspirantPhysicalRecordDto)
  @ValidateIf((o) => o.isStudent === true)
  @IsOptional()
  physicalRecord?: CreateAspirantPhysicalRecordDto;

  @ValidateNested()
  @Type(() => CreateAspirantMedicalHistoryDto)
  @ValidateIf((o) => o.isStudent === true)
  @IsOptional()
  medicalHistory?: CreateAspirantMedicalHistoryDto;

  @IsDate()
  @Type(() => Date)
  @ValidateIf((o) => o.isStudent === true)
  @IsOptional()
  enrollmentDate?: Date;

  @IsString()
  @IsOptional()
  assessmentComments?: string;

  @IsString()
  @IsOptional()
  assessmentNotes?: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsString()
  @IsOptional()
  occupation?: string;

  @IsString({ each: true })
  @ValidateIf((o) => o.isStudent === true)
  @IsOptional()
  assessmentPhotoFileIds?: string[];
}
