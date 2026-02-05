import {
  IsArray,
  IsNumber,
  IsString,
  IsBoolean,
  IsOptional,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * DTO para la selección de clases de un estudiante
 * Single Responsibility: Validar los datos de entrada para selección de clases
 */
export class ClassSelectionDto {
  // studentId es opcional porque se obtiene del parámetro de la URL, no del body
  // Si viene en el body, debe ser string, pero normalmente no viene
  @IsString()
  @ValidateIf((o) => o.studentId !== undefined && o.studentId !== null && o.studentId !== '')
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    return String(value);
  })
  @IsOptional()
  studentId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsNumber({}, { each: true })
  @Min(1, { each: true })
  @Max(5, { each: true })
  @Type(() => Number)
  selectedDays: number[]; // 1-5 (lunes-viernes)

  @IsString()
  selectedTime: string; // "8:00 AM"

  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month: number;

  @IsNumber()
  @Min(2020)
  @Max(2100)
  @Type(() => Number)
  year: number;

  @IsBoolean()
  @Type(() => Boolean)
  hasAnnualMembership: boolean;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  classesCoveredByTravelFee?: number; // Número de clases cubiertas por tarifa de viaje
}
