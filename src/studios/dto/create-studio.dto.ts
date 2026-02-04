import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStudioDto {
  @IsUUID()
  @IsOptional()
  image?: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  phone?: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  capacity: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  capacityPrivate: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  capacitySemiprivate: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  capacityValoracion: number;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  status?: boolean;
}
