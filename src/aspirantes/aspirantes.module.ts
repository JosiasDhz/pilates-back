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

@Module({
  imports: [
    TypeOrmModule.forFeature([Aspirante, PaymentMethod, AspirantStatus, Event]),
    forwardRef(() => AspirantMedicalHistoryModule),
    PaymentMethodsModule,
    AspirantStatusModule,
    CalendarModule,
    PaymentsModule,
    ConfigurationsModule,
    WhatsappModule,
  ],
  controllers: [AspirantesController],
  providers: [AspirantesService],
  exports: [TypeOrmModule, AspirantesService],
})
export class AspirantesModule {}
