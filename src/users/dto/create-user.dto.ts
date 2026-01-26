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
  @ValidateIf((o) => o.isStudent === true)
  @Min(0)
  @Max(500)
  weight?: number; // peso en kg

  @Type(() => Number)
  @IsNumber()
  @ValidateIf((o) => o.isStudent === true)
  @Min(0)
  @Max(300)
  height?: number; // altura en cm

  @IsString()
  @IsOptional()
  flexibility?: string; // flexibilidad

  @IsString()
  @IsOptional()
  strength?: string; // fuerza

  @IsString()
  @IsOptional()
  balance?: string; // equilibrio

  @IsString()
  @IsOptional()
  posture?: string; // postura

  @IsString()
  @IsOptional()
  rangeOfMotion?: string; // rango de movimiento

  @IsString()
  @IsOptional()
  observations?: string; // observaciones
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

  // Campos para estudiante
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
  @ValidateIf((o) => o.isStudent === true)
  @IsOptional()
  language?: string;

  @IsString()
  @ValidateIf((o) => o.isStudent === true)
  @IsOptional()
  occupation?: string;

  @IsString({ each: true })
  @ValidateIf((o) => o.isStudent === true)
  @IsOptional()
  assessmentPhotoFileIds?: string[];
}
