import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentClassRegistrationsService } from './student-class-registrations.service';
import { StudentClassRegistrationsController } from './student-class-registrations.controller';
import { StudentClassRegistration } from './entities/student-class-registration.entity';
import { Student } from 'src/students/entities/student.entity';
import { Event } from 'src/calendar/entities/event.entity';
import { Studio } from 'src/studios/entities/studio.entity';
import { AuthModule } from 'src/auth/auth.module';
import { TravelFeeBalanceModule } from 'src/travel-fee-balance/travel-fee-balance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentClassRegistration,
      Student,
      Event,
      Studio,
    ]),
    AuthModule,
    TravelFeeBalanceModule,
  ],
  controllers: [StudentClassRegistrationsController],
  providers: [StudentClassRegistrationsService],
  exports: [TypeOrmModule, StudentClassRegistrationsService],
})
export class StudentClassRegistrationsModule {}
