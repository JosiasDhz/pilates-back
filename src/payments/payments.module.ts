import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentEvidence } from './entities/payment-evidence.entity';
import { FilesModule } from 'src/files/files.module';
import { UsersModule } from 'src/users/users.module';
import { PaymentMethodsModule } from 'src/payment-methods/payment-methods.module';
import { AuthModule } from 'src/auth/auth.module';
import { Aspirante } from 'src/aspirantes/entities/aspirante.entity';
import { Student } from 'src/students/entities/student.entity';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService],
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentEvidence, Aspirante, Student]),
    FilesModule,
    UsersModule,
    PaymentMethodsModule,
    AuthModule,
  ],
  exports: [TypeOrmModule, PaymentsService],
})
export class PaymentsModule {}
