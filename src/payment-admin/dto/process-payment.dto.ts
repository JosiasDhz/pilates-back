import { IsEnum, IsString, IsOptional, IsUUID } from 'class-validator';
import { PaymentAuditAction } from '../entities/payment-audit-log.entity';

export class ProcessPaymentDto {
  @IsUUID()
  paymentId: string;

  @IsUUID()
  adminId: string;

  @IsEnum(PaymentAuditAction)
  action: PaymentAuditAction;

  @IsString()
  @IsOptional()
  notes?: string;
}
