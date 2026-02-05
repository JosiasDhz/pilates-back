import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TravelFeeBalance } from './entities/travel-fee-balance.entity';
import { Student } from 'src/students/entities/student.entity';
import { ScheduleChangeRequest } from 'src/schedule-changes/entities/schedule-change-request.entity';

@Injectable()
export class TravelFeeBalanceService {
  constructor(
    @InjectRepository(TravelFeeBalance)
    private readonly balanceRepository: Repository<TravelFeeBalance>,
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(ScheduleChangeRequest)
    private readonly scheduleChangeRepository: Repository<ScheduleChangeRequest>,
  ) { }

  async getOrCreateBalance(
    studentId: string,
    monthYear: string,
    scheduleChangeRequestId?: string,
  ): Promise<TravelFeeBalance> {
    let balance = await this.balanceRepository.findOne({
      where: { studentId, monthYear },
      relations: ['student', 'scheduleChangeRequest'],
    });

    if (!balance) {

      const student = await this.studentRepository.findOne({
        where: { id: studentId },
      });

      if (!student) {
        throw new NotFoundException(`Estudiante con ID ${studentId} no encontrado`);
      }


      const finalScheduleChangeRequestId = scheduleChangeRequestId || '';

      balance = this.balanceRepository.create({
        studentId,
        monthYear,
        total: 0,
        scheduleChangeRequestId: finalScheduleChangeRequestId,
      });
      balance = await this.balanceRepository.save(balance);
    }

    return balance;
  }

  async addClasses(
    studentId: string,
    scheduleChangeRequestId: string,
    classesToAdd: number,
    monthYear: string,
  ): Promise<TravelFeeBalance> {

    let balance = await this.getOrCreateBalance(studentId, monthYear, scheduleChangeRequestId);


    if (!balance.scheduleChangeRequestId && scheduleChangeRequestId) {
      balance.scheduleChangeRequestId = scheduleChangeRequestId;
    }


    balance.total = Number(balance.total) + classesToAdd;

    return await this.balanceRepository.save(balance);
  }

  async subtractClasses(
    studentId: string,
    classesToSubtract: number,
    monthYear: string,
  ): Promise<TravelFeeBalance> {
    const balance = await this.getOrCreateBalance(studentId, monthYear);


    const currentTotal = Number(balance.total) || 0;
    balance.total = Math.max(0, currentTotal - classesToSubtract);

    return await this.balanceRepository.save(balance);
  }

  async getBalance(
    studentId: string,
    monthYear: string,
  ): Promise<number> {
    const balance = await this.balanceRepository.findOne({
      where: { studentId, monthYear },
    });

    return balance ? Number(balance.total) : 0;
  }

  async getStudentBalances(studentId: string): Promise<TravelFeeBalance[]> {
    return await this.balanceRepository.find({
      where: { studentId },
      order: { monthYear: 'DESC' },
    });
  }

  async recalculateBalance(
    studentId: string,
    monthYear: string,
  ): Promise<TravelFeeBalance> {

    const [year, month] = monthYear.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const approvedTravelFees = await this.scheduleChangeRepository.find({
      where: {
        studentId,
        requestType: 'travel_fee' as any,
        status: 'approved' as any,
      },
    });


    const monthTravelFees = approvedTravelFees.filter((req) => {
      if (!req.approvedAt) return false;
      const approvedDate = new Date(req.approvedAt);
      return approvedDate >= startDate && approvedDate <= endDate;
    });


    const totalClasses = monthTravelFees.reduce((sum, req) => {
      const amount = Number(req.travelFeeAmount) || 0;
      return sum + (amount > 0 ? amount / 250 : 0);
    }, 0);


    let balance = await this.getOrCreateBalance(studentId, monthYear);
    balance.total = totalClasses;

    return await this.balanceRepository.save(balance);
  }
}
