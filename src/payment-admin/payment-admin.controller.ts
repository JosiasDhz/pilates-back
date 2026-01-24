import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { PaymentAdminService } from './payment-admin.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';

@Controller('payment-admin')
export class PaymentAdminController {
  constructor(private readonly paymentAdminService: PaymentAdminService) {}

  @Post('process')
  processPayment(@Body() processPaymentDto: ProcessPaymentDto) {
    return this.paymentAdminService.processPayment(
      processPaymentDto.paymentId,
      processPaymentDto.adminId,
      processPaymentDto.action,
      processPaymentDto.notes,
    );
  }

  @Get('audit-logs')
  findAllAuditLogs() {
    return this.paymentAdminService.findAllAuditLogs();
  }

  @Get('audit-logs/:paymentId')
  findAuditLogsByPaymentId(@Param('paymentId') paymentId: string) {
    return this.paymentAdminService.findAuditLogsByPaymentId(paymentId);
  }
}
