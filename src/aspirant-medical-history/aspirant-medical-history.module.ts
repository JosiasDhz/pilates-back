import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AspirantMedicalHistoryService } from './aspirant-medical-history.service';
import { AspirantMedicalHistoryController } from './aspirant-medical-history.controller';
import { AspirantMedicalHistory } from './entities/aspirant-medical-history.entity';
import { Aspirante } from 'src/aspirantes/entities/aspirante.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AspirantMedicalHistory, Aspirante]),
  ],
  controllers: [AspirantMedicalHistoryController],
  providers: [AspirantMedicalHistoryService],
  exports: [AspirantMedicalHistoryService, TypeOrmModule],
})
export class AspirantMedicalHistoryModule {}
