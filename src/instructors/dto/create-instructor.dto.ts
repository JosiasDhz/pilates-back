import {
  IsString,
  IsEmail,
  IsBoolean,
  IsUUID,
  IsOptional,
  MinLength,
} from 'class-validator';

/** Single DTO for atomic Instructor creation (User + Employee + Instructor) */
export class CreateInstructorDto {
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
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @IsUUID()
  @IsOptional()
  rolId?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsUUID()
  @IsOptional()
  studioId?: string;

  @IsString()
  @MinLength(1, { message: 'specialty must not be empty' })
  specialty: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsBoolean()
  @IsOptional()
  instructorStatus?: boolean;
}
