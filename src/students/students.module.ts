import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { Student } from './entities/student.entity';
import { StudentStatusHistory } from './entities/student-status-history.entity';
import { AuthModule } from 'src/auth/auth.module';
import { CalendarModule } from 'src/calendar/calendar.module';
import { StudentClassRegistrationsModule } from 'src/student-class-registrations/student-class-registrations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Student, StudentStatusHistory]),
    AuthModule,
    CalendarModule,
    forwardRef(() => StudentClassRegistrationsModule),
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [TypeOrmModule, StudentsService],
})
export class StudentsModule {}
