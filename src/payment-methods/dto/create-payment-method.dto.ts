import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePaymentMethodDto {
  @IsString()
  @MinLength(1, { message: 'El nombre no puede estar vacío' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsEnum(['MANUAL', 'AUTOMATED'])
  type: 'MANUAL' | 'AUTOMATED';

  @IsBoolean()
  requiresEvidence: boolean;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value && typeof value === 'string' ? value.trim() : value))
  instructions?: string;

  @IsBoolean()
  @IsOptional()
  status?: boolean;
}
