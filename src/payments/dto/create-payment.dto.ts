import { IsString, IsNumber, IsUUID, IsOptional, Min, ValidateIf, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePaymentDto {
  @IsNumber()
  @Min(1)
  amountCents: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsUUID()
  @ValidateIf((o) => o.userId !== undefined && o.userId !== null && o.userId !== '')
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    return value;
  })
  userId?: string;

  @IsUUID()
  @ValidateIf((o) => o.aspirantId !== undefined && o.aspirantId !== null && o.aspirantId !== '')
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    return value;
  })
  aspirantId?: string;

  @IsUUID()
  @ValidateIf((o) => o.studentId !== undefined && o.studentId !== null && o.studentId !== '')
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    return value;
  })
  studentId?: string;

  @IsNumber()
  paymentMethodId: number;

  @IsObject()
  @IsOptional()
  classSelectionData?: {
    selectedDayTimePairs?: Array<{ dayOfWeek: number; time: string }>;
    month?: number;
    year?: number;
    hasMembership?: boolean;
  };
}
