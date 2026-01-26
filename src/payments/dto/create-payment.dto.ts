import { IsString, IsNumber, IsUUID, IsOptional, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsNumber()
  @Min(1)
  amountCents: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsUUID()
  @IsOptional()
  userId?: string;

  @IsUUID()
  @IsOptional()
  aspirantId?: string;

  @IsNumber()
  paymentMethodId: number;
}
