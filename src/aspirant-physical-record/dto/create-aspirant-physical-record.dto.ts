import {
  IsNumber,
  IsOptional,
  IsString,
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
  weight?: number; // peso en kg

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
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
