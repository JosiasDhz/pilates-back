import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as moment from 'moment-timezone';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { PaginateStudentDto } from './dto/paginate-student.dto';
import { ClassSelectionDto } from './dto/class-selection.dto';
import { Student } from './entities/student.entity';
import { StudentStatusHistory, StudentStatus } from './entities/student-status-history.entity';
import { CalendarService } from 'src/calendar/calendar.service';
import { StudentClassRegistrationsService } from 'src/student-class-registrations/student-class-registrations.service';
import { CreateBulkStudentClassRegistrationDto } from 'src/student-class-registrations/dto/create-bulk-student-class-registration.dto';
import { CreateStudentClassRegistrationDto } from 'src/student-class-registrations/dto/create-student-class-registration.dto';
import { TravelFeeBalanceService } from 'src/travel-fee-balance/travel-fee-balance.service';

const CLASS_PRICE = 250;
const MONTHLY_MEMBERSHIP_RATE = 100;
const TZ = 'America/Mexico_City';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(StudentStatusHistory)
    private readonly statusHistoryRepository: Repository<StudentStatusHistory>,
    private readonly dataSource: DataSource,
    private readonly calendarService: CalendarService,
    @Inject(forwardRef(() => StudentClassRegistrationsService))
    private readonly classRegistrationsService: StudentClassRegistrationsService,
    private readonly travelFeeBalanceService: TravelFeeBalanceService,
  ) { }

  async create(createStudentDto: CreateStudentDto) {
    const student = this.studentRepository.create({
      ...createStudentDto,
      enrollmentDate: createStudentDto.enrollmentDate || new Date(),
      isActive: createStudentDto.isActive !== undefined ? createStudentDto.isActive : true,
    });
    return await this.studentRepository.save(student);
  }

  async findAll() {
    return await this.studentRepository
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.user', 'user')
      .leftJoinAndSelect('user.rol', 'rol')
      .leftJoinAndSelect('student.aspirant', 'aspirant')
      .where('rol.name = :rolName', { rolName: 'Estudiante' })
      .orderBy('student.createdAt', 'DESC')
      .getMany();
  }

  async findAllPaginated(paginationDto: PaginateStudentDto) {
    const {
      limit = 10,
      offset = 0,
      sort = 'createdAt',
      order = 'desc',
      search = '',
    } = paginationDto;

    const query = this.studentRepository
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.user', 'user')
      .leftJoinAndSelect('user.avatar', 'avatar')
      .leftJoinAndSelect('user.rol', 'rol')
      .leftJoinAndSelect('student.aspirant', 'aspirant')
      .where('rol.name = :rolName', { rolName: 'Estudiante' })
      .take(limit)
      .skip(offset);

    if (search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      query.andWhere(
        `(user.name ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search OR user.phone ILIKE :search OR aspirant.firstName ILIKE :search OR aspirant.lastNamePaternal ILIKE :search OR aspirant.email ILIKE :search)`,
        { search: searchTerm },
      );
    }


    const sortMapping: Record<string, string> = {
      nombre: 'user.name',
      name: 'user.name',
      email: 'user.email',
      fechaIngreso: 'student.enrollmentDate',
      enrollmentDate: 'student.enrollmentDate',
      estatus: 'student.isActive',
      status: 'student.isActive',
      createdAt: 'student.createdAt',
      creado: 'student.createdAt',
    };

    const sortField = sortMapping[sort] || 'student.createdAt';
    const orderType = order === 'asc' ? 'ASC' : 'DESC';
    query.orderBy(sortField, orderType);

    const [records, total] = await query.getManyAndCount();

    return {
      records,
      total,
    };
  }

  async findOne(id: string) {
    const student = await this.studentRepository
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.user', 'user')
      .leftJoinAndSelect('user.avatar', 'avatar')
      .leftJoinAndSelect('student.aspirant', 'aspirant')
      .leftJoinAndSelect('aspirant.physicalRecord', 'physicalRecord')
      .leftJoinAndSelect('aspirant.medicalHistory', 'medicalHistory')
      .leftJoinAndSelect('aspirant.assessmentPhotos', 'assessmentPhotos')
      .leftJoinAndSelect('assessmentPhotos.file', 'file')
      .leftJoinAndSelect('student.statusHistory', 'statusHistory')
      .where('student.id = :id', { id })
      .getOne();

    if (!student) {
      throw new NotFoundException(`Estudiante con id ${id} no encontrado`);
    }


    if (student.statusHistory) {
      student.statusHistory.sort((a, b) => {
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      });
    }

    return student;
  }

  async findByUserId(userId: string) {
    const student = await this.studentRepository
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.user', 'user')
      .leftJoinAndSelect('user.avatar', 'avatar')
      .leftJoinAndSelect('student.aspirant', 'aspirant')
      .leftJoinAndSelect('aspirant.physicalRecord', 'physicalRecord')
      .leftJoinAndSelect('aspirant.medicalHistory', 'medicalHistory')
      .leftJoinAndSelect('aspirant.assessmentPhotos', 'assessmentPhotos')
      .leftJoinAndSelect('assessmentPhotos.file', 'file')
      .leftJoinAndSelect('student.statusHistory', 'statusHistory')
      .where('student.userId = :userId', { userId })
      .getOne();

    if (!student) {
      throw new NotFoundException(`Estudiante con userId ${userId} no encontrado`);
    }


    if (student.statusHistory) {
      student.statusHistory.sort((a, b) => {
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      });
    }

    return student;
  }

  async update(id: string, updateStudentDto: UpdateStudentDto) {
    const student = await this.findOne(id);
    Object.assign(student, updateStudentDto);
    return await this.studentRepository.save(student);
  }

  async remove(id: string) {
    const student = await this.findOne(id);
    await this.studentRepository.remove(student);
    return { message: 'Estudiante eliminado correctamente' };
  }

  async getStats() {

    const total = await this.studentRepository
      .createQueryBuilder('student')
      .leftJoin('student.user', 'user')
      .leftJoin('user.rol', 'rol')
      .where('rol.name = :rolName', { rolName: 'Estudiante' })
      .getCount();

    const active = await this.studentRepository
      .createQueryBuilder('student')
      .leftJoin('student.user', 'user')
      .leftJoin('user.rol', 'rol')
      .where('rol.name = :rolName', { rolName: 'Estudiante' })
      .andWhere('student.isActive = :isActive', { isActive: true })
      .getCount();

    const inactive = await this.studentRepository
      .createQueryBuilder('student')
      .leftJoin('student.user', 'user')
      .leftJoin('user.rol', 'rol')
      .where('rol.name = :rolName', { rolName: 'Estudiante' })
      .andWhere('student.isActive = :isActive', { isActive: false })
      .getCount();

    return {
      total,
      active,
      inactive,
    };
  }

  async changeStatus(studentId: string, changeStatusDto: ChangeStatusDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {

      const student = await queryRunner.manager.findOne(Student, {
        where: { id: studentId },
      });

      if (!student) {
        throw new NotFoundException(`Estudiante con id ${studentId} no encontrado`);
      }


      const currentStatusHistory = await queryRunner.manager.findOne(
        StudentStatusHistory,
        {
          where: {
            studentId: student.id,
            endDate: null,
          },
          order: { startDate: 'DESC' },
        },
      );

      const newStartDate = changeStatusDto.startDate || new Date();


      if (currentStatusHistory) {

        if (currentStatusHistory.status === changeStatusDto.status) {
          throw new BadRequestException(
            `El estudiante ya tiene el estado ${changeStatusDto.status}`,
          );
        }

        currentStatusHistory.endDate = newStartDate;
        await queryRunner.manager.save(StudentStatusHistory, currentStatusHistory);
      }


      const newStatusHistory = queryRunner.manager.create(StudentStatusHistory, {
        studentId: student.id,
        status: changeStatusDto.status,
        startDate: newStartDate,
        endDate: null,
        reason: changeStatusDto.reason || null,
      });
      await queryRunner.manager.save(StudentStatusHistory, newStatusHistory);


      student.isActive = changeStatusDto.status === StudentStatus.ACTIVE;
      await queryRunner.manager.save(Student, student);


      await queryRunner.commitTransaction();

      return {
        student: await this.findOne(studentId),
        statusHistory: newStatusHistory,
      };
    } catch (error) {

      await queryRunner.rollbackTransaction();
      throw error;
    } finally {

      await queryRunner.release();
    }
  }

  async selectClasses(classSelectionDto: ClassSelectionDto) {
    const { studentId, selectedDays, selectedTime, month, year, hasAnnualMembership, classesCoveredByTravelFee } = classSelectionDto;


    const student = await this.findOne(studentId);
    if (!student) {
      throw new NotFoundException(`Estudiante con id ${studentId} no encontrado`);
    }


    const events = await this.calendarService.findAll({
      month,
      year,
      type: 'clase',
    });


    const normalClasses = events.filter(
      (event) => event.type === 'clase'
    );


    const targetEvents: typeof events = [];
    const unavailableDates: string[] = [];
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);




    const parseDateLocal = (dateStr: string | Date): Date => {
      if (typeof dateStr === 'string') {

        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
      }

      const y = dateStr.getFullYear();
      const m = dateStr.getMonth();
      const d = dateStr.getDate();
      return new Date(y, m, d);
    };

    console.log('Normal classes (first 20):', normalClasses.slice(0, 20).map(ev => {
      const evDate = parseDateLocal(ev.date);
      return {
        id: ev.id,
        date: ev.date,
        time: ev.time,
        dayOfWeek: evDate.getDay(),
        parsedDate: `${evDate.getFullYear()}-${String(evDate.getMonth() + 1).padStart(2, '0')}-${String(evDate.getDate()).padStart(2, '0')}`
      };
    }));


    const normalizeTime = (timeStr: string) => {
      return timeStr.trim().replace(/\s+/g, ' ').toUpperCase();
    };
    const normalizedSelectedTime = normalizeTime(selectedTime);

    for (let day = 1; day <= monthEnd.getDate(); day++) {

      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();

      console.log(`\nDay ${day}: date=${year}-${month}-${day}, dayOfWeek=${dayOfWeek}, selectedDays includes ${dayOfWeek}? ${selectedDays.includes(dayOfWeek)}`);



      if (dayOfWeek >= 1 && dayOfWeek <= 5 && selectedDays.includes(dayOfWeek)) {
        console.log(`  ✓ Processing day ${day} (dayOfWeek: ${dayOfWeek})`);


        const eventsOnThisDay = normalClasses.filter((ev) => {
          const evDate = parseDateLocal(ev.date);
          const evDay = evDate.getDate();
          const evMonth = evDate.getMonth() + 1;
          const evYear = evDate.getFullYear();


          const matches = evDay === day && evMonth === month && evYear === year;
          return matches;
        });

        if (eventsOnThisDay.length > 0) {
          console.log(`  Events found on day ${day} (expected dayOfWeek: ${dayOfWeek}):`, eventsOnThisDay.map(ev => {
            const evDate = parseDateLocal(ev.date);
            const evDayOfWeek = evDate.getDay();
            return {
              id: ev.id,
              date: ev.date,
              time: ev.time,
              dayOfWeek: evDayOfWeek,
              parsedDate: `${evDate.getFullYear()}-${String(evDate.getMonth() + 1).padStart(2, '0')}-${String(evDate.getDate()).padStart(2, '0')}`,
              expectedDayOfWeek: dayOfWeek,
              match: evDayOfWeek === dayOfWeek
            };
          }));
        } else {
          console.log(`  ✗ No events found on day ${day} at all`);
        }


        const eventOnDay = normalClasses.find((ev) => {
          const evDate = parseDateLocal(ev.date);
          const evDay = evDate.getDate();
          const evMonth = evDate.getMonth() + 1;
          const evYear = evDate.getFullYear();


          const sameDay = evDay === day && evMonth === month && evYear === year;
          const normalizedEvTime = normalizeTime(ev.time || '');
          const sameTime = normalizedEvTime === normalizedSelectedTime;

          if (sameDay && !sameTime) {
            console.log(`  Time mismatch: event time="${ev.time}" (normalized: "${normalizedEvTime}") vs selected="${selectedTime}" (normalized: "${normalizedSelectedTime}")`);
          }

          return sameDay && sameTime;
        });

        if (eventOnDay) {

          const capacity = eventOnDay.studio?.capacity || 0;
          const occupied = eventOnDay.attendees?.length || 0;
          const available = capacity - occupied > 0;

          console.log(`  Event found! capacity=${capacity}, occupied=${occupied}, available=${available}`);

          if (available) {
            targetEvents.push(eventOnDay);
            console.log(`  ✓ Added event to targetEvents (total: ${targetEvents.length})`);
          } else {
            unavailableDates.push(`${day}/${month}/${year}`);
            console.log(`  ✗ Event unavailable (capacity full)`);
          }
        } else {
          unavailableDates.push(`${day}/${month}/${year}`);
          console.log(`  ✗ No event found for day ${day} at time ${selectedTime}`);
        }
      }
    }



    if (targetEvents.length === 0) {
      throw new BadRequestException('No se encontraron clases disponibles para los días seleccionados');
    }


    const eventIds = targetEvents.map((e) => e.id);
    const existingRegistrations = await this.classRegistrationsService.findAll(
      studentId,
      undefined,
      undefined,
    );
    const existingEventIds = new Set(
      existingRegistrations.map((r) => r.eventId),
    );


    const newEvents = targetEvents.filter(
      (event) => !existingEventIds.has(event.id),
    );

    if (newEvents.length === 0) {
      throw new BadRequestException(
        'Todas las clases seleccionadas ya están registradas',
      );
    }


    const registrations: CreateStudentClassRegistrationDto[] = newEvents.map((event) => ({
      studentId,
      eventId: event.id,
      paymentModality: 'A',
      calculatedCost: CLASS_PRICE,
      currency: 'MXN',
    }));

    const bulkDto: CreateBulkStudentClassRegistrationDto = {
      registrations,
    };

    const createdRegistrations = await this.classRegistrationsService.createBulk(bulkDto);


    if (classesCoveredByTravelFee && classesCoveredByTravelFee > 0) {
      const monthYear = `${year}-${String(month).padStart(2, '0')}`;
      try {
        await this.travelFeeBalanceService.subtractClasses(
          studentId,
          classesCoveredByTravelFee,
          monthYear,
        );
        console.log(`Balance actualizado: -${classesCoveredByTravelFee} clases para ${monthYear}`);
      } catch (error) {
        console.error('Error al restar clases del balance:', error);

      }
    }


    const classesPrice = newEvents.length * CLASS_PRICE;
    const membershipPrice = hasAnnualMembership
      ? this.calculateAnnualMembershipPrice(month)
      : 0;
    const totalAmount = classesPrice + membershipPrice;


    if (hasAnnualMembership) {
      const student = await this.studentRepository.findOne({
        where: { id: studentId },
      });

      if (student) {

        student.hasAnnualMembership = true;
        student.annualMembershipYear = year;
        await this.studentRepository.save(student);
      }
    }

    return {
      success: true,
      totalClasses: newEvents.length,
      totalAmount,
      classesCreated: createdRegistrations.length,
      classesPrice,
      membershipPrice,
    };
  }

  private calculateAnnualMembershipPrice(month: number): number {
    const monthsRemaining = 13 - month;
    return monthsRemaining * MONTHLY_MEMBERSHIP_RATE;
  }
}
