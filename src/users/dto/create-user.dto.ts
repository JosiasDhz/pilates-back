import {
  IsString,
  IsEmail,
  IsBoolean,
  IsUUID,
  IsOptional,
  IsNumber,
  IsDate,
  ValidateNested,
  ValidateIf,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAspirantPhysicalRecordDto {
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(500)
  weight?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(300)
  height?: number;

  @IsString()
  @IsOptional()
  flexibility?: string;

  @IsString()
  @IsOptional()
  strength?: string;

  @IsString()
  @IsOptional()
  balance?: string;

  @IsString()
  @IsOptional()
  posture?: string;

  @IsString()
  @IsOptional()
  rangeOfMotion?: string;

  @IsString()
  @IsOptional()
  observations?: string;
}

export class CreateAspirantMedicalHistoryDto {
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

export class CreateUserDto {
  @IsString()
  name: string;

  @IsString()
  lastName: string;

  @IsString()
  @IsOptional()
  secondLastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  password: string;

  @IsString()
  phone: string;

  @IsBoolean()
  @IsOptional()
  status: boolean;

  @IsString()
  @IsOptional()
  avatar: string;

  @IsUUID()
  rolId: string;

  @IsString()
  @IsOptional()
  position: string;


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
