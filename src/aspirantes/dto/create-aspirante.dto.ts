import {
  IsString,
  IsEmail,
  IsInt,
  IsOptional,
  Min,
  Max,
  MaxLength,
  IsUUID,
  IsNumber,
} from 'class-validator';
import {
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateAspirantMedicalHistoryDto } from 'src/aspirant-medical-history/dto/create-aspirant-medical-history.dto';

export class CreateAspiranteDto {
  @IsString()
  @MaxLength(120)
  firstName: string;

  @IsString()
  @MaxLength(120)
  lastNamePaternal: string;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  lastNameMaternal?: string;

  @IsString()
  @MaxLength(20)
  phone: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsInt()
  @Min(1)
  @Max(150)
  age: number;

  @IsString()
  @MaxLength(50)
  language: string;

  @IsString()
  @MaxLength(120)
  occupation: string;

  @IsString()
  @MaxLength(20)
  gender: string;

  @IsNumber()
  paymentMethodId: number;

  @IsUUID()
  @IsOptional()
  statusId?: string;

  @IsUUID()
  @IsOptional()
  valoracionEventId?: string;

  @ValidateNested()
  @Type(() => CreateAspirantMedicalHistoryDto)
  @IsOptional()
  medicalHistory?: CreateAspirantMedicalHistoryDto;
}
