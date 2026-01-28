import {
  IsUUID,
  IsString,
  IsIn,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

const PAYMENT_MODALITIES = ['A', 'B', 'C'] as const;

export class CreateStudentClassRegistrationDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  eventId: string;

  @IsString()
  @IsIn(PAYMENT_MODALITIES)
  paymentModality: 'A' | 'B' | 'C';

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  calculatedCost: number;

  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @IsDateString()
  @IsOptional()
  billingPeriod?: string;
}
