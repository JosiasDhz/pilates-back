import { Module } from '@nestjs/common';
import { PaymentAdminService } from './payment-admin.service';
import { PaymentAdminController } from './payment-admin.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentAuditLog } from './entities/payment-audit-log.entity';
import { Payment } from 'src/payments/entities/payment.entity';
import { PaymentsModule } from 'src/payments/payments.module';
import { FilesModule } from 'src/files/files.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  controllers: [PaymentAdminController],
  providers: [PaymentAdminService],
  imports: [
    TypeOrmModule.forFeature([PaymentAuditLog, Payment]),
    PaymentsModule,
    FilesModule,
    UsersModule,
  ],
  exports: [PaymentAdminService],
})
export class PaymentAdminModule {}
