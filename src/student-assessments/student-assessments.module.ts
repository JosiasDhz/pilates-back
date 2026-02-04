import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentAssessmentsService } from './student-assessments.service';
import { StudentAssessmentsController } from './student-assessments.controller';
import { StudentAssessment } from './entities/student-assessment.entity';
import { StudentAssessmentMedicalHistory } from './entities/student-assessment-medical-history.entity';
import { StudentAssessmentPhysicalRecord } from './entities/student-assessment-physical-record.entity';
import { StudentAssessmentPhoto } from './entities/student-assessment-photo.entity';
import { Student } from 'src/students/entities/student.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentAssessment,
      StudentAssessmentMedicalHistory,
      StudentAssessmentPhysicalRecord,
      StudentAssessmentPhoto,
      Student,
    ]),
  ],
  controllers: [StudentAssessmentsController],
  providers: [StudentAssessmentsService],
  exports: [StudentAssessmentsService],
})
export class StudentAssessmentsModule {}
