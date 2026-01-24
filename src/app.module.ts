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

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      database: process.env.DB_NAME,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      autoLoadEntities: true,
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      dropSchema: process.env.DB_DROP_SCHEMA === 'true',
    }),
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
  ],
  controllers: [],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
