import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In, Between } from 'typeorm';
import { CreateScheduleChangeRequestDto } from './dto/create-schedule-change-request.dto';
import { UpdateScheduleChangeRequestDto } from './dto/update-schedule-change-request.dto';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { UpdateWaitlistDto } from './dto/update-waitlist.dto';
import {
  ScheduleChangeRequest,
  ChangeRequestType,
  ChangeRequestStatus,
} from './entities/schedule-change-request.entity';
import { Waitlist, WaitlistStatus } from './entities/waitlist.entity';
import { StudentJokers } from './entities/student-jokers.entity';
import { Student } from 'src/students/entities/student.entity';
import { Event } from 'src/calendar/entities/event.entity';
import { StudentClassRegistration, RegistrationStatus } from 'src/student-class-registrations/entities/student-class-registration.entity';
import { Studio } from 'src/studios/entities/studio.entity';
import { TravelFeeBalanceService } from 'src/travel-fee-balance/travel-fee-balance.service';

@Injectable()
export class ScheduleChangesService {


  private readonly AUTO_APPROVE_TRAVEL_FEES = true;
  constructor(
    @InjectRepository(ScheduleChangeRequest)
    private readonly changeRequestRepository: Repository<ScheduleChangeRequest>,
    @InjectRepository(Waitlist)
    private readonly waitlistRepository: Repository<Waitlist>,
    @InjectRepository(StudentJokers)
    private readonly jokersRepository: Repository<StudentJokers>,
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(StudentClassRegistration)
    private readonly registrationRepository: Repository<StudentClassRegistration>,
    @InjectRepository(Studio)
    private readonly studioRepository: Repository<Studio>,
    private readonly dataSource: DataSource,
    private readonly travelFeeBalanceService: TravelFeeBalanceService,
  ) { }

  calculateJokers(classesPerWeek: number): number {
    if (classesPerWeek <= 2) return 1;
    if (classesPerWeek === 3) return 2;
    if (classesPerWeek === 4) return 3;
    if (classesPerWeek >= 5) return 4;
    return 0;
  }

  async getOrCreateJokers(
    studentId: string,
    year: number,
    month: number,
    classesPerWeek?: number,
  ): Promise<StudentJokers> {
    let jokers = await this.jokersRepository.findOne({
      where: { studentId, year, month },
    });

    if (!jokers) {

      if (classesPerWeek === undefined) {
        classesPerWeek = await this.calculateClassesPerWeek(studentId, year, month);
      }

      const totalJokers = this.calculateJokers(classesPerWeek);

      jokers = this.jokersRepository.create({
        studentId,
        year,
        month,
        totalJokers,
        usedJokers: 0,
        classesPerWeek,
      });

      await this.jokersRepository.save(jokers);
    }

    return jokers;
  }

  private async calculateClassesPerWeek(
    studentId: string,
    year: number,
    month: number,
  ): Promise<number> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const registrations = await this.registrationRepository.find({
      where: {
        studentId,
        status: In([RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED]),
      },
      relations: ['event'],
    });


    const monthRegistrations = registrations.filter((reg) => {
      const eventDate = new Date(reg.event.date);
      return eventDate >= startDate && eventDate <= endDate;
    });

    if (monthRegistrations.length === 0) return 0;


    const weeks = new Set<number>();
    monthRegistrations.forEach((reg) => {
      const eventDate = new Date(reg.event.date);
      const week = this.getWeekOfMonth(eventDate);
      weeks.add(week);
    });


    const totalWeeks = weeks.size || 1;
    return Math.ceil(monthRegistrations.length / totalWeeks);
  }

  private getWeekOfMonth(date: Date): number {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfWeek = start.getDay();
    const dayOfMonth = date.getDate();
    return Math.ceil((dayOfMonth + dayOfWeek) / 7);
  }

  async canReschedule(
    studentId: string,
    originalEventId: string,
    newEventId?: string,
  ): Promise<{ canReschedule: boolean; requiresJoker: boolean; reason?: string }> {
    const originalEvent = await this.eventRepository.findOne({
      where: { id: originalEventId },
    });

    if (!originalEvent) {
      throw new NotFoundException('Evento original no encontrado');
    }

    const eventDate = new Date(originalEvent.date);
    const eventDateTime = new Date(`${originalEvent.date}T${originalEvent.time}`);
    const now = new Date();
    const hoursUntilEvent = (eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);


    if (hoursUntilEvent >= 24) {
      return { canReschedule: true, requiresJoker: false };
    }



    const year = eventDate.getFullYear();
    const month = eventDate.getMonth() + 1;

    const jokers = await this.getOrCreateJokers(studentId, year, month);

    if (jokers.availableJokers > 0) {
      return { canReschedule: true, requiresJoker: true };
    }

    return {
      canReschedule: false,
      requiresJoker: true,
      reason: 'No hay comodines disponibles y requiere 24 horas de anticipación',
    };
  }

  async createChangeRequest(createDto: CreateScheduleChangeRequestDto) {

    const student = await this.studentRepository.findOne({
      where: { id: createDto.studentId },
    });
    if (!student) {
      throw new NotFoundException('Estudiante no encontrado');
    }



    if (createDto.requestType === ChangeRequestType.TEMPORARY_LEAVE) {
      if (!createDto.leaveStartDate) {
        throw new BadRequestException(
          'La fecha de inicio de la baja temporal es requerida',
        );
      }


      const anyRegistration = await this.registrationRepository.findOne({
        where: {
          studentId: createDto.studentId,
          status: In([RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED]),
        },
      });

      if (!anyRegistration) {
        throw new BadRequestException(
          'El estudiante no tiene clases registradas',
        );
      }


      const originalEvent = await this.eventRepository.findOne({
        where: { id: anyRegistration.eventId },
        relations: ['studio'],
      });

      if (!originalEvent) {
        throw new NotFoundException('No se pudo encontrar un evento de referencia');
      }


      const leaveStartDate = new Date(createDto.leaveStartDate);
      leaveStartDate.setHours(0, 0, 0, 0);

      const changeRequest = this.changeRequestRepository.create({
        studentId: createDto.studentId,
        originalEventId: originalEvent.id,
        requestType: ChangeRequestType.TEMPORARY_LEAVE,
        reason: createDto.reason || null,
        leaveStartDate,
        status: ChangeRequestStatus.PENDING,
        usesJoker: false,
        requires24Hours: false,
      });

      return await this.changeRequestRepository.save(changeRequest);
    }


    const originalEvent = await this.eventRepository.findOne({
      where: { id: createDto.originalEventId },
      relations: ['studio'],
    });
    if (!originalEvent) {
      throw new NotFoundException('Evento original no encontrado');
    }


    const registration = await this.registrationRepository.findOne({
      where: {
        studentId: createDto.studentId,
        eventId: createDto.originalEventId,
        status: In([RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED]),
      },
    });

    if (!registration) {
      throw new BadRequestException(
        'El estudiante no está registrado en esta clase',
      );
    }

    let newEvent: Event | null = null;
    let usesJoker = createDto.usesJoker || false;
    let requires24Hours = true;




    const requestTypeStr = String(createDto.requestType).toLowerCase();
    const isReschedule = createDto.requestType === ChangeRequestType.RESCHEDULE ||
      requestTypeStr === 'reschedule';


    if (isReschedule) {
      if (!createDto.newEventId) {
        throw new BadRequestException(
          'Se requiere un nuevo evento para reagendar',
        );
      }

      newEvent = await this.eventRepository.findOne({
        where: { id: createDto.newEventId },
        relations: ['studio'],
      });
      if (!newEvent) {
        throw new NotFoundException('Nuevo evento no encontrado');
      }



      const originalDate = new Date(originalEvent.date);
      const newDate = new Date(newEvent.date);
      if (
        originalDate.getMonth() !== newDate.getMonth() ||
        originalDate.getFullYear() !== newDate.getFullYear()
      ) {
        throw new BadRequestException(
          'Solo se pueden reagendar clases del mismo mes',
        );
      }



      try {

        let requestedDateStr: string;
        const eventDateValue: Date | string = newEvent.date as Date | string;

        if (eventDateValue instanceof Date) {
          requestedDateStr = eventDateValue.toISOString().split('T')[0];
        } else if (typeof eventDateValue === 'string') {

          requestedDateStr = eventDateValue.split('T')[0];
        } else {

          const eventDate = new Date(eventDateValue as any);
          if (isNaN(eventDate.getTime())) {
            throw new Error(`Fecha inválida: ${String(eventDateValue)}`);
          }
          requestedDateStr = eventDate.toISOString().split('T')[0];
        }


        const waitlistEntry = await this.createWaitlist({
          studentId: createDto.studentId,
          eventId: createDto.newEventId,
          requestedDate: requestedDateStr,
          notes: createDto.reason || `Solicitud de reagendar desde ${originalEvent.title}`,
        });

      } catch (waitlistError: any) {

        if (waitlistError instanceof ConflictException) {

        } else {
          console.error('Error al crear lista de espera:', waitlistError);

        }
      }


      const isAvailable = await this.checkAvailability(newEvent);


      const canReschedule = await this.canReschedule(
        createDto.studentId,
        createDto.originalEventId,
        createDto.newEventId,
      );




      usesJoker = canReschedule.requiresJoker;
      requires24Hours = !usesJoker;

    }


    let travelFeeAmount = createDto.travelFeeAmount;
    let travelFeeClasses: number | null = null;

    if (createDto.requestType === ChangeRequestType.TRAVEL_FEE) {

      let numberOfClasses = 0;

      if (createDto.travelFeeDates && createDto.travelFeeDates.length > 0) {

        const allRegistrations = await this.registrationRepository.find({
          where: {
            studentId: createDto.studentId,
            status: In([RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED]),
          },
          relations: ['event'],
        });


        for (const dateStr of createDto.travelFeeDates) {
          const targetDate = new Date(dateStr);
          targetDate.setHours(0, 0, 0, 0);

          const matchingRegistrations = allRegistrations.filter((reg) => {
            if (!reg.event?.date) return false;
            const eventDate = new Date(reg.event.date);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate.getTime() === targetDate.getTime();
          });

          numberOfClasses += matchingRegistrations.length;
        }
      } else {

        numberOfClasses = 1;
      }



      travelFeeClasses = numberOfClasses * 0.5;

      if (!travelFeeAmount) {

        const pricePerClass = Number(registration.calculatedCost) * 0.5;


        travelFeeAmount = pricePerClass * numberOfClasses;
      }


    }


    let leaveStartDate: Date | null = null;
    if (createDto.leaveStartDate) {
      leaveStartDate = new Date(createDto.leaveStartDate);

      leaveStartDate.setHours(0, 0, 0, 0);
    }


    const initialStatus =
      createDto.requestType === ChangeRequestType.TRAVEL_FEE && this.AUTO_APPROVE_TRAVEL_FEES
        ? ChangeRequestStatus.APPROVED
        : ChangeRequestStatus.PENDING;

    const changeRequest = this.changeRequestRepository.create({
      ...createDto,
      newEventId: newEvent?.id || null,
      usesJoker,
      requires24Hours,
      travelFeeAmount,
      leaveStartDate,
      travelFeeDates: createDto.travelFeeDates ?? null,
      status: initialStatus,

      approvedAt: initialStatus === ChangeRequestStatus.APPROVED ? new Date() : null,


    });


    if (usesJoker && createDto.requestType === ChangeRequestType.RESCHEDULE) {
      const eventDate = new Date(originalEvent.date);
      const year = eventDate.getFullYear();
      const month = eventDate.getMonth() + 1;
      const jokers = await this.getOrCreateJokers(createDto.studentId, year, month);
      jokers.usedJokers += 1;
      await this.jokersRepository.save(jokers);
    }

    const savedRequest = await this.changeRequestRepository.save(changeRequest);


    if (initialStatus === ChangeRequestStatus.APPROVED && createDto.requestType === ChangeRequestType.TRAVEL_FEE) {
      try {




        if (travelFeeClasses && travelFeeClasses > 0) {
          const now = new Date();
          const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          await this.travelFeeBalanceService.addClasses(
            createDto.studentId,
            savedRequest.id,
            travelFeeClasses,
            monthYear,
          );
        }
      } catch (error) {
        console.error('Error al procesar aprobación automática de tarifa de viaje:', error);

      }
    }

    return savedRequest;
  }

  async approveChangeRequest(
    id: string,
    updateDto: UpdateScheduleChangeRequestDto,
    approvedById: string,
  ) {
    const changeRequest = await this.changeRequestRepository.findOne({
      where: { id },
      relations: ['originalEvent', 'newEvent', 'student'],
    });

    if (!changeRequest) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (changeRequest.status !== ChangeRequestStatus.PENDING) {
      throw new BadRequestException('La solicitud ya fue procesada');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {

      const originalRegistration = await this.registrationRepository.findOne({
        where: {
          studentId: changeRequest.studentId,
          eventId: changeRequest.originalEventId,
        },
      });

      if (!originalRegistration) {
        throw new NotFoundException('Registro original no encontrado');
      }

      switch (changeRequest.requestType) {
        case ChangeRequestType.TEMPORARY_LEAVE:

          originalRegistration.status = RegistrationStatus.CANCELLED;
          await queryRunner.manager.save(originalRegistration);
          break;

        case ChangeRequestType.TRAVEL_FEE:



          const travelFeeClassesToAdd = changeRequest.travelFeeAmount
            ? Number(changeRequest.travelFeeAmount) / 250
            : 0;
          if (travelFeeClassesToAdd > 0) {
            const approvedDate = new Date();
            const monthYear = `${approvedDate.getFullYear()}-${String(approvedDate.getMonth() + 1).padStart(2, '0')}`;
            await this.travelFeeBalanceService.addClasses(
              changeRequest.studentId,
              changeRequest.id,
              travelFeeClassesToAdd,
              monthYear,
            );
          }
          break;

        case ChangeRequestType.RESCHEDULE:

          if (!changeRequest.newEventId) {
            throw new BadRequestException('Se requiere un nuevo evento para reagendar');
          }

          await this.updateEventAttendees(
            changeRequest.originalEventId,
            changeRequest.studentId,
            'remove',
          );
          originalRegistration.eventId = changeRequest.newEventId!;
          await queryRunner.manager.save(originalRegistration);
          await this.updateEventAttendees(
            changeRequest.newEventId,
            changeRequest.studentId,
            'add',
          );

          const waitlistEntry = await queryRunner.manager.findOne(Waitlist, {
            where: {
              studentId: changeRequest.studentId,
              eventId: changeRequest.newEventId,
              status: WaitlistStatus.PENDING,
            },
          });

          if (waitlistEntry) {
            waitlistEntry.status = WaitlistStatus.REGISTERED;
            waitlistEntry.registeredAt = new Date();
            await queryRunner.manager.save(waitlistEntry);
          }
          break;
      }


      changeRequest.status = ChangeRequestStatus.APPROVED;
      changeRequest.approvedAt = new Date();
      changeRequest.approvedById = approvedById;
      if (updateDto.adminNotes) {
        changeRequest.adminNotes = updateDto.adminNotes;
      }
      if (updateDto.newEventId) {
        changeRequest.newEventId = updateDto.newEventId;
      }

      await queryRunner.manager.save(changeRequest);
      await queryRunner.commitTransaction();

      return await this.findOneChangeRequest(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async executeRescheduleImmediate(
    studentId: string,
    originalEventId: string,
    newEventId: string,
  ) {
    const originalEvent = await this.eventRepository.findOne({
      where: { id: originalEventId },
      relations: ['studio'],
    });
    if (!originalEvent) {
      throw new NotFoundException('Evento original no encontrado');
    }

    const newEvent = await this.eventRepository.findOne({
      where: { id: newEventId },
      relations: ['studio'],
    });
    if (!newEvent) {
      throw new NotFoundException('Nuevo evento no encontrado');
    }

    const origDate = new Date(originalEvent.date);
    const newDate = new Date(newEvent.date);
    if (
      origDate.getMonth() !== newDate.getMonth() ||
      origDate.getFullYear() !== newDate.getFullYear()
    ) {
      throw new BadRequestException(
        'Solo puedes reagendar dentro del mismo mes',
      );
    }

    const registration = await this.registrationRepository.findOne({
      where: {
        studentId,
        eventId: originalEventId,
        status: In([RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED]),
      },
    });
    if (!registration) {
      throw new BadRequestException(
        'El estudiante no está registrado en la clase original',
      );
    }

    const isAvailable = await this.checkAvailability(newEvent);
    if (!isAvailable) {
      throw new BadRequestException(
        'No hay disponibilidad en la clase destino. Usa solicitud de cambio para lista de espera.',
      );
    }

    const canReschedule = await this.canReschedule(
      studentId,
      originalEventId,
      newEventId,
    );
    if (!canReschedule.canReschedule) {
      throw new BadRequestException(
        canReschedule.reason || 'No se puede reagendar en este momento',
      );
    }

    await this.updateEventAttendees(originalEventId, studentId, 'remove');
    registration.eventId = newEventId;
    await this.registrationRepository.save(registration);
    await this.updateEventAttendees(newEventId, studentId, 'add');

    if (canReschedule.requiresJoker) {
      const year = origDate.getFullYear();
      const month = origDate.getMonth() + 1;
      const jokers = await this.getOrCreateJokers(studentId, year, month);
      jokers.usedJokers += 1;
      await this.jokersRepository.save(jokers);
    }

    return {
      success: true,
      message: 'Horario actualizado correctamente',
      registrationId: registration.id,
    };
  }

  async executeRescheduleImmediateBulk(
    studentId: string,
    pairs: Array<{ originalEventId: string; newEventId: string }>,
  ) {
    if (!pairs?.length) {
      throw new BadRequestException('Se requiere al menos un par para reagendar');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let requiresJokerOnce = false;
    const newRegistrationIds: string[] = [];

    try {
      for (const { originalEventId, newEventId } of pairs) {
        const originalEvent = await this.eventRepository.findOne({
          where: { id: originalEventId },
          relations: ['studio'],
        });
        if (!originalEvent) {
          throw new NotFoundException(
            `Evento original no encontrado: ${originalEventId}`,
          );
        }

        const newEvent = await this.eventRepository.findOne({
          where: { id: newEventId },
          relations: ['studio'],
        });
        if (!newEvent) {
          throw new NotFoundException(
            `Nuevo evento no encontrado: ${newEventId}`,
          );
        }

        const origDate = new Date(originalEvent.date);
        const newDate = new Date(newEvent.date);
        if (
          origDate.getMonth() !== newDate.getMonth() ||
          origDate.getFullYear() !== newDate.getFullYear()
        ) {
          throw new BadRequestException(
            'Solo puedes reagendar dentro del mismo mes',
          );
        }

        const registration = await queryRunner.manager
          .getRepository(StudentClassRegistration)
          .findOne({
            where: {
              studentId,
              eventId: originalEventId,
              status: In([
                RegistrationStatus.PENDING,
                RegistrationStatus.CONFIRMED,
              ]),
            },
          });
        if (!registration) {
          throw new BadRequestException(
            `No estás registrado en la clase original: ${originalEventId}`,
          );
        }

        const isAvailable = await this.checkAvailability(newEvent);
        if (!isAvailable) {
          throw new BadRequestException(
            'No hay disponibilidad en la clase destino. Usa solicitud de cambio para lista de espera.',
          );
        }

        const canReschedule = await this.canReschedule(
          studentId,
          originalEventId,
          newEventId,
        );
        if (!canReschedule.canReschedule) {
          throw new BadRequestException(
            canReschedule.reason || 'No se puede reagendar en este momento',
          );
        }
        if (canReschedule.requiresJoker) {
          requiresJokerOnce = true;
        }

        await this.updateEventAttendees(originalEventId, studentId, 'remove');
        registration.eventId = newEventId;
        await queryRunner.manager.save(registration);
        newRegistrationIds.push(registration.id);
        await this.updateEventAttendees(newEventId, studentId, 'add');
      }

      if (requiresJokerOnce) {
        const firstOrig = await this.eventRepository.findOne({
          where: { id: pairs[0].originalEventId },
        });
        if (firstOrig) {
          const d = new Date(firstOrig.date);
          const jokers = await this.getOrCreateJokers(
            studentId,
            d.getFullYear(),
            d.getMonth() + 1,
          );
          jokers.usedJokers += 1;
          await this.jokersRepository.save(jokers);
        }
      }

      await queryRunner.commitTransaction();
      return {
        success: true,
        message: 'Horario actualizado correctamente',
        registrationIds: newRegistrationIds,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Rechazar una solicitud de cambio
   */
  async rejectChangeRequest(id: string, adminNotes?: string) {
    const changeRequest = await this.changeRequestRepository.findOne({
      where: { id },
    });

    if (!changeRequest) {
      throw new NotFoundException('Solicitud no encontrada');
    }


    if (changeRequest.usesJoker) {
      const originalEvent = await this.eventRepository.findOne({
        where: { id: changeRequest.originalEventId },
      });
      if (originalEvent) {
        const eventDate = new Date(originalEvent.date);
        const year = eventDate.getFullYear();
        const month = eventDate.getMonth() + 1;
        const jokers = await this.getOrCreateJokers(
          changeRequest.studentId,
          year,
          month,
        );
        jokers.usedJokers = Math.max(0, jokers.usedJokers - 1);
        await this.jokersRepository.save(jokers);
      }
    }

    changeRequest.status = ChangeRequestStatus.REJECTED;
    if (adminNotes) {
      changeRequest.adminNotes = adminNotes;
    }

    return await this.changeRequestRepository.save(changeRequest);
  }

  async findAllChangeRequests(
    studentId?: string,
    status?: ChangeRequestStatus,
    requestType?: ChangeRequestType,
  ) {
    const query = this.changeRequestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.student', 'student')
      .leftJoinAndSelect('request.originalEvent', 'originalEvent')
      .leftJoinAndSelect('request.newEvent', 'newEvent')
      .leftJoinAndSelect('originalEvent.studio', 'originalStudio')
      .leftJoinAndSelect('newEvent.studio', 'newStudio');

    if (studentId) {
      query.andWhere('request.studentId = :studentId', { studentId });
    }

    if (status) {
      query.andWhere('request.status = :status', { status });
    }

    if (requestType) {
      query.andWhere('request.requestType = :requestType', { requestType });
    }

    return await query
      .orderBy('request.createdAt', 'DESC')
      .getMany();
  }

  async findOneChangeRequest(id: string) {
    const request = await this.changeRequestRepository.findOne({
      where: { id },
      relations: [
        'student',
        'student.user',
        'originalEvent',
        'originalEvent.studio',
        'newEvent',
        'newEvent.studio',
      ],
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    return request;
  }

  async createWaitlist(createDto: CreateWaitlistDto) {


    const existing = await this.waitlistRepository.findOne({
      where: {
        studentId: createDto.studentId,
        eventId: createDto.eventId,
        status: WaitlistStatus.PENDING,
      },
    });

    if (existing) {
      throw new ConflictException('Ya estás en la lista de espera para esta clase');
    }


    const existingAnyStatus = await this.waitlistRepository.findOne({
      where: {
        studentId: createDto.studentId,
        eventId: createDto.eventId,
      },
    });

    if (existingAnyStatus) {

      if (existingAnyStatus.status !== WaitlistStatus.PENDING) {
        existingAnyStatus.status = WaitlistStatus.PENDING;
        existingAnyStatus.requestedDate = new Date(createDto.requestedDate);
        existingAnyStatus.notes = createDto.notes || null;
        existingAnyStatus.notifiedAt = null;
        existingAnyStatus.registeredAt = null;
        const updated = await this.waitlistRepository.save(existingAnyStatus);
        return updated;
      }
      throw new ConflictException('Ya estás en la lista de espera para esta clase');
    }

    const student = await this.studentRepository.findOne({
      where: { id: createDto.studentId },
    });
    if (!student) {
      throw new NotFoundException('Estudiante no encontrado');
    }

    const event = await this.eventRepository.findOne({
      where: { id: createDto.eventId },
    });
    if (!event) {
      console.error('Evento no encontrado:', createDto.eventId);
      throw new NotFoundException('Evento no encontrado');
    }

    const waitlist = this.waitlistRepository.create({
      ...createDto,
      requestedDate: new Date(createDto.requestedDate),
      status: WaitlistStatus.PENDING,
    });

    const saved = await this.waitlistRepository.save(waitlist);
    return saved;
  }

  async findAllWaitlist(studentId?: string, eventId?: string, status?: WaitlistStatus) {
    const query = this.waitlistRepository
      .createQueryBuilder('waitlist')
      .leftJoinAndSelect('waitlist.student', 'student')
      .leftJoinAndSelect('student.user', 'user')
      .leftJoinAndSelect('waitlist.event', 'event')
      .leftJoinAndSelect('event.studio', 'studio');

    if (studentId) {
      query.andWhere('waitlist.studentId = :studentId', { studentId });
    }

    if (eventId) {
      query.andWhere('waitlist.eventId = :eventId', { eventId });
    }

    if (status) {
      query.andWhere('waitlist.status = :status', { status });
    }

    return await query.orderBy('waitlist.createdAt', 'ASC').getMany();
  }

  async findOneWaitlist(id: string) {
    const waitlist = await this.waitlistRepository.findOne({
      where: { id },
      relations: [
        'student',
        'student.user',
        'event',
        'event.studio',
      ],
    });

    if (!waitlist) {
      throw new NotFoundException('Entrada de lista de espera no encontrada');
    }

    return waitlist;
  }

  async notifyWaitlistAvailability(eventId: string) {
    const waitlistEntries = await this.waitlistRepository.find({
      where: {
        eventId,
        status: WaitlistStatus.PENDING,
      },
      relations: ['student', 'event'],
      order: { createdAt: 'ASC' },
    });


    if (waitlistEntries.length > 0) {
      const firstEntry = waitlistEntries[0];
      firstEntry.status = WaitlistStatus.NOTIFIED;
      firstEntry.notifiedAt = new Date();
      await this.waitlistRepository.save(firstEntry);

      return firstEntry;
    }

    return null;
  }

  async getStudentJokers(studentId: string, year: number, month: number) {
    return await this.getOrCreateJokers(studentId, year, month);
  }

  async getStudentIdByUserId(userId: string): Promise<string | null> {
    const student = await this.studentRepository.findOne({
      where: { userId },
    });
    return student?.id || null;
  }

  private async checkAvailability(event: Event): Promise<boolean> {
    if (!event.studioId) {
      return false;
    }

    const studio = await this.studioRepository.findOne({
      where: { id: event.studioId },
    });

    if (!studio) {
      return false;
    }

    let capacity = 0;
    switch (event.type) {
      case 'clase':
        capacity = studio.capacity;
        break;
      case 'clase_semiprivada':
        capacity = studio.capacitySemiprivate;
        break;
      case 'clase_privada':
        capacity = studio.capacityPrivate;
        break;
      default:
        return false;
    }

    const confirmedRegistrations = await this.registrationRepository.count({
      where: {
        eventId: event.id,
        status: In([RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED]),
      },
    });

    const currentAttendees = event.attendees?.length || 0;
    const occupied = Math.max(confirmedRegistrations, currentAttendees);

    return capacity - occupied > 0;
  }

  private async updateEventAttendees(
    eventId: string,
    studentId: string,
    action: 'add' | 'remove',
  ) {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      return;
    }

    const current = event.attendees || [];

    if (action === 'add') {
      if (!current.includes(studentId)) {
        event.attendees = [...current, studentId];
      }
    } else {
      event.attendees = current.filter((id) => id !== studentId);
    }

    await this.eventRepository.save(event);
  }

  async processTemporaryLeaves() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);


    const approvedLeaves = await this.changeRequestRepository.find({
      where: {
        requestType: ChangeRequestType.TEMPORARY_LEAVE,
        status: ChangeRequestStatus.APPROVED,
      },
      relations: ['student'],
    });

    let processedCount = 0;
    let cancelledRegistrationsCount = 0;

    for (const leave of approvedLeaves) {
      if (!leave.leaveStartDate) {
        continue;
      }

      const leaveStartDate = new Date(leave.leaveStartDate);
      leaveStartDate.setHours(0, 0, 0, 0);


      if (leaveStartDate.getTime() <= today.getTime()) {

        const futureRegistrations = await this.registrationRepository.find({
          where: {
            studentId: leave.studentId,
            status: In([RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED]),
          },
          relations: ['event'],
        });


        const registrationsToCancel = futureRegistrations.filter((reg) => {
          if (!reg.event?.date) return false;
          const eventDate = new Date(reg.event.date);
          eventDate.setHours(0, 0, 0, 0);
          return eventDate.getTime() >= leaveStartDate.getTime();
        });


        for (const registration of registrationsToCancel) {
          registration.status = RegistrationStatus.CANCELLED;
          await this.registrationRepository.save(registration);


          if (registration.eventId) {
            await this.updateEventAttendees(
              registration.eventId,
              leave.studentId,
              'remove',
            );
          }

          cancelledRegistrationsCount++;
        }


        leave.status = ChangeRequestStatus.COMPLETED;
        await this.changeRequestRepository.save(leave);

        processedCount++;
      }
    }

    return {
      processedLeaves: processedCount,
      cancelledRegistrations: cancelledRegistrationsCount,
    };
  }
}
