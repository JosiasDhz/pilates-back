import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TravelFeeBalance } from './entities/travel-fee-balance.entity';
import { TravelFeeBalanceService } from './travel-fee-balance.service';
import { TravelFeeBalanceController } from './travel-fee-balance.controller';
import { Student } from 'src/students/entities/student.entity';
import { ScheduleChangeRequest } from 'src/schedule-changes/entities/schedule-change-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TravelFeeBalance,
      Student,
      ScheduleChangeRequest,
    ]),
  ],
  controllers: [TravelFeeBalanceController],
  providers: [TravelFeeBalanceService],
  exports: [TravelFeeBalanceService],
})
export class TravelFeeBalanceModule {}
