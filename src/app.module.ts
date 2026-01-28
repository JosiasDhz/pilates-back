import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerMiddleware } from './utils/logger.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolsModule } from './rols/rols.module';
import { CommonModule } from './common/common.module';
import { AppService } from './app.service';
import { FilesModule } from './files/files.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { AspirantesModule } from './aspirantes/aspirantes.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
import { PaymentsModule } from './payments/payments.module';
import { PaymentAdminModule } from './payment-admin/payment-admin.module';
import { InstructorsModule } from './instructors/instructors.module';
import { EmployeeModule } from './employee/employee.module';
import { StudiosModule } from './studios/studios.module';
import { CalendarModule } from './calendar/calendar.module';
import { ConfigurationsModule } from './configurations/configurations.module';
import { AspirantMedicalHistoryModule } from './aspirant-medical-history/aspirant-medical-history.module';
import { AspirantStatusModule } from './aspirant-status/aspirant-status.module';
import { AspirantAccessTokenModule } from './aspirant-access-token/aspirant-access-token.module';
import { AspirantStatus } from './aspirant-status/entities/aspirant-status.entity';
import { PaymentMethod } from './payment-methods/entities/payment-method.entity';
import { Studio } from './studios/entities/studio.entity';
import { getTypeOrmConfig } from './typeorm.config';
import { AspirantPhysicalRecordModule } from './aspirant-physical-record/aspirant-physical-record.module';
import { AspirantAssessmentPhotoModule } from './aspirant-assessment-photo/aspirant-assessment-photo.module';
import { StudentsModule } from './students/students.module';
import { StudentClassRegistrationsModule } from './student-class-registrations/student-class-registrations.module';
import { ScheduleChangesModule } from './schedule-changes/schedule-changes.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot(getTypeOrmConfig()),
    TypeOrmModule.forFeature([AspirantStatus, PaymentMethod, Studio]),
    AuthModule,
    UsersModule,
    RolsModule,
    CommonModule,
    FilesModule,
    WhatsappModule,
    AspirantesModule,
    PaymentMethodsModule,
    PaymentsModule,
    PaymentAdminModule,
    InstructorsModule,
    EmployeeModule,
    StudiosModule,
    CalendarModule,
    ConfigurationsModule,
    AspirantMedicalHistoryModule,
    AspirantStatusModule,
    AspirantAccessTokenModule,
    AspirantPhysicalRecordModule,
    AspirantAssessmentPhotoModule,
    StudentsModule,
    StudentClassRegistrationsModule,
    ScheduleChangesModule,
  ],
  controllers: [],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
