import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { Student } from './entities/student.entity';
import { StudentStatusHistory } from './entities/student-status-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Student, StudentStatusHistory])],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [TypeOrmModule, StudentsService],
})
export class StudentsModule {}
