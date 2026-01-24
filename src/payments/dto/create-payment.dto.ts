import { IsString, IsNumber, IsUUID, IsOptional, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsNumber()
  @Min(1)
  amountCents: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsUUID()
  userId: string;

  @IsNumber()
  paymentMethodId: number;
}
