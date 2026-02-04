import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  IsDateString,
  IsIn,
  MinLength,
  MaxLength,
} from 'class-validator';

const EVENT_TYPES = ['valoracion', 'clase', 'clase_privada', 'clase_semiprivada'] as const;

export class CreateEventDto {
  @IsDateString()
  date: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  time: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  endTime?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  duration?: string | null;

  @IsString()
  @IsIn(EVENT_TYPES)
  type: (typeof EVENT_TYPES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  location?: string;

  @IsArray()
  @IsOptional()
  attendees?: string[];

  @IsUUID()
  @IsOptional()
  studioId?: string;

  @IsUUID()
  @IsOptional()
  instructorId?: string;
}
