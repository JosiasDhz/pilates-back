import {
  IsString,
  IsIn,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { RegistrationStatus } from '../entities/student-class-registration.entity';

const PAYMENT_MODALITIES = ['A', 'B', 'C'] as const;

export class UpdateStudentClassRegistrationDto {
  @IsString()
  @IsIn(PAYMENT_MODALITIES)
  @IsOptional()
  paymentModality?: 'A' | 'B' | 'C';

  @IsEnum(RegistrationStatus)
  @IsOptional()
  status?: RegistrationStatus;

  @IsDateString()
  @IsOptional()
  billingPeriod?: string;
}
