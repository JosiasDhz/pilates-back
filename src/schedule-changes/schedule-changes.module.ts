import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleChangesService } from './schedule-changes.service';
import { ScheduleChangesController } from './schedule-changes.controller';
import { ScheduleChangesCron } from './schedule-changes.cron';
import { ScheduleChangeRequest } from './entities/schedule-change-request.entity';
import { Waitlist } from './entities/waitlist.entity';
import { StudentJokers } from './entities/student-jokers.entity';
import { Student } from 'src/students/entities/student.entity';
import { Event } from 'src/calendar/entities/event.entity';
import { StudentClassRegistration } from 'src/student-class-registrations/entities/student-class-registration.entity';
import { Studio } from 'src/studios/entities/studio.entity';
import { AuthModule } from 'src/auth/auth.module';
import { StudentsModule } from 'src/students/students.module';
import { TravelFeeBalanceModule } from 'src/travel-fee-balance/travel-fee-balance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScheduleChangeRequest,
      Waitlist,
      StudentJokers,
      Student,
      Event,
      StudentClassRegistration,
      Studio,
    ]),
    AuthModule,
    StudentsModule,
    TravelFeeBalanceModule,
  ],
  controllers: [ScheduleChangesController],
  providers: [ScheduleChangesService, ScheduleChangesCron],
  exports: [TypeOrmModule, ScheduleChangesService],
})
export class ScheduleChangesModule {}
