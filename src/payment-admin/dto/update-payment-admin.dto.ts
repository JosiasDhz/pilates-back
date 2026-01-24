import { PartialType } from '@nestjs/mapped-types';
import { CreatePaymentAdminDto } from './create-payment-admin.dto';

export class UpdatePaymentAdminDto extends PartialType(CreatePaymentAdminDto) {}
