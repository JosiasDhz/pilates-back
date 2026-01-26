import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AspirantesService } from './aspirantes.service';
import { AspirantesController } from './aspirantes.controller';
import { Aspirante } from './entities/aspirante.entity';
import { AspirantMedicalHistoryModule } from 'src/aspirant-medical-history/aspirant-medical-history.module';
import { PaymentMethodsModule } from 'src/payment-methods/payment-methods.module';
import { AspirantStatusModule } from 'src/aspirant-status/aspirant-status.module';
import { PaymentMethod } from 'src/payment-methods/entities/payment-method.entity';
import { AspirantStatus } from 'src/aspirant-status/entities/aspirant-status.entity';
import { Event } from 'src/calendar/entities/event.entity';
import { CalendarModule } from 'src/calendar/calendar.module';
import { PaymentsModule } from 'src/payments/payments.module';
import { ConfigurationsModule } from 'src/configurations/configurations.module';
import { WhatsappModule } from 'src/whatsapp/whatsapp.module';
import { AspirantAccessTokenModule } from 'src/aspirant-access-token/aspirant-access-token.module';
import { AspirantPhysicalRecord } from 'src/aspirant-physical-record/entities/aspirant-physical-record.entity';
import { AspirantAssessmentPhoto } from 'src/aspirant-assessment-photo/entities/aspirant-assessment-photo.entity';
import { User } from 'src/users/entities/user.entity';
import { Rol } from 'src/rols/entities/rol.entity';
import { File } from 'src/files/entities/file.entity';
import { Student } from 'src/students/entities/student.entity';
import { StudentStatusHistory } from 'src/students/entities/student-status-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Aspirante,
      PaymentMethod,
      AspirantStatus,
      Event,
      AspirantPhysicalRecord,
      AspirantAssessmentPhoto,
      User,
      Rol,
      File,
      Student,
      StudentStatusHistory,
    ]),
    forwardRef(() => AspirantMedicalHistoryModule),
    PaymentMethodsModule,
    AspirantStatusModule,
    CalendarModule,
    PaymentsModule,
    ConfigurationsModule,
    WhatsappModule,
    AspirantAccessTokenModule,
  ],
  controllers: [AspirantesController],
  providers: [AspirantesService],
  exports: [TypeOrmModule, AspirantesService],
})
export class AspirantesModule {}
