import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { RolsModule } from 'src/rols/rols.module';
import { AuthModule } from 'src/auth/auth.module';
import { FilesModule } from 'src/files/files.module';
import { FilesService } from 'src/files/files.service';
import { Aspirante } from 'src/aspirantes/entities/aspirante.entity';
import { AspirantStatus } from 'src/aspirant-status/entities/aspirant-status.entity';
import { AspirantPhysicalRecord } from 'src/aspirant-physical-record/entities/aspirant-physical-record.entity';
import { AspirantMedicalHistory } from 'src/aspirant-medical-history/entities/aspirant-medical-history.entity';
import { AspirantAssessmentPhoto } from 'src/aspirant-assessment-photo/entities/aspirant-assessment-photo.entity';
import { Student } from 'src/students/entities/student.entity';
import { StudentStatusHistory } from 'src/students/entities/student-status-history.entity';
import { PaymentMethod } from 'src/payment-methods/entities/payment-method.entity';

@Module({
  controllers: [UsersController],
  providers: [UsersService, FilesService],
  imports: [
    TypeOrmModule.forFeature([
      User,
      Aspirante,
      AspirantStatus,
      AspirantPhysicalRecord,
      AspirantMedicalHistory,
      AspirantAssessmentPhoto,
      Student,
      StudentStatusHistory,
      PaymentMethod,
    ]),
    RolsModule,
    FilesModule,
    forwardRef(() => AuthModule),
  ],
  exports: [TypeOrmModule],
})
export class UsersModule {}
