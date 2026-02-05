import { Controller, Get, Param, Query } from '@nestjs/common';
import { TravelFeeBalanceService } from './travel-fee-balance.service';

@Controller('travel-fee-balance')
export class TravelFeeBalanceController {
  constructor(
    private readonly travelFeeBalanceService: TravelFeeBalanceService,
  ) {}

  @Get('student/:studentId')
  async getStudentBalance(
    @Param('studentId') studentId: string,
    @Query('monthYear') monthYear?: string,
  ) {
    if (monthYear) {
      const balance = await this.travelFeeBalanceService.getBalance(
        studentId,
        monthYear,
      );
      return { studentId, monthYear, total: balance };
    }

    const balances = await this.travelFeeBalanceService.getStudentBalances(
      studentId,
    );
    return balances;
  }
}
