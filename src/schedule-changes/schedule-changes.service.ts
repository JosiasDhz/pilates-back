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

@Injectable()
export class ScheduleChangesService {
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
  ) {}

  /**
   * Calcula el número de comodines según las clases por semana
   */
  calculateJokers(classesPerWeek: number): number {
    if (classesPerWeek <= 2) return 1;
    if (classesPerWeek === 3) return 2;
    if (classesPerWeek === 4) return 3;
    if (classesPerWeek >= 5) return 4;
    return 0;
  }

  /**
   * Obtiene o crea el registro de comodines para un estudiante en un mes específico
   */
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
      // Si no existe, calcular según las clases registradas del mes
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

  /**
   * Calcula las clases por semana basándose en los registros del mes
   */
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

    // Filtrar registros del mes
    const monthRegistrations = registrations.filter((reg) => {
      const eventDate = new Date(reg.event.date);
      return eventDate >= startDate && eventDate <= endDate;
    });

    if (monthRegistrations.length === 0) return 0;

    // Agrupar por semana
    const weeks = new Set<number>();
    monthRegistrations.forEach((reg) => {
      const eventDate = new Date(reg.event.date);
      const week = this.getWeekOfMonth(eventDate);
      weeks.add(week);
    });

    // Promedio de clases por semana
    const totalWeeks = weeks.size || 1;
    return Math.ceil(monthRegistrations.length / totalWeeks);
  }

  /**
   * Obtiene la semana del mes (1-4 o 1-5)
   */
  private getWeekOfMonth(date: Date): number {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfWeek = start.getDay();
    const dayOfMonth = date.getDate();
    return Math.ceil((dayOfMonth + dayOfWeek) / 7);
  }

  /**
   * Verifica si puede reagendar (24 horas de anticipación o comodín disponible)
   */
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

    // Si es más de 24 horas, puede reagendar sin comodín
    if (hoursUntilEvent >= 24) {
      return { canReschedule: true, requiresJoker: false };
    }

    // Si es menos de 24 horas, necesita comodín
    // Verificar comodines disponibles
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

  /**
   * Crea una solicitud de cambio de horario
   */
  async createChangeRequest(createDto: CreateScheduleChangeRequestDto) {
    console.log('=== CREATE CHANGE REQUEST ===');
    console.log('DTO recibido:', JSON.stringify(createDto, null, 2));
    
    const student = await this.studentRepository.findOne({
      where: { id: createDto.studentId },
    });
    if (!student) {
      throw new NotFoundException('Estudiante no encontrado');
    }

    // Para baja temporal, no necesitamos validar evento original específico
    // Solo necesitamos que el estudiante exista y tenga una fecha de inicio
    if (createDto.requestType === ChangeRequestType.TEMPORARY_LEAVE) {
      if (!createDto.leaveStartDate) {
        throw new BadRequestException(
          'La fecha de inicio de la baja temporal es requerida',
        );
      }

      // Buscar cualquier registro del estudiante para usar como referencia
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

      // Usar el evento de cualquier registro como referencia
      const originalEvent = await this.eventRepository.findOne({
        where: { id: anyRegistration.eventId },
        relations: ['studio'],
      });

      if (!originalEvent) {
        throw new NotFoundException('No se pudo encontrar un evento de referencia');
      }

      // Crear la solicitud con el evento de referencia
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

    // Para otros tipos de solicitud, validar evento original
    const originalEvent = await this.eventRepository.findOne({
      where: { id: createDto.originalEventId },
      relations: ['studio'],
    });
    if (!originalEvent) {
      throw new NotFoundException('Evento original no encontrado');
    }

    // Verificar que el estudiante esté registrado en el evento original
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

    // Si es reagendar, validar disponibilidad y comodines
    console.log('RequestType recibido:', createDto.requestType, 'Tipo:', typeof createDto.requestType);
    console.log('ChangeRequestType.RESCHEDULE:', ChangeRequestType.RESCHEDULE);
    
    // Usar type assertion para evitar problemas de inferencia de tipos
    const requestTypeStr = String(createDto.requestType).toLowerCase();
    const isReschedule = createDto.requestType === ChangeRequestType.RESCHEDULE || 
                         requestTypeStr === 'reschedule';
    
    console.log('isReschedule calculado:', isReschedule);
    
    if (isReschedule) {
      console.log('=== INICIO REAGENDAMIENTO ===');
      console.log('RequestType:', createDto.requestType);
      console.log('NewEventId:', createDto.newEventId);
      
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

      console.log('Nuevo evento encontrado:', newEvent.id, 'Fecha:', newEvent.date);

      // Verificar que sea del mismo mes
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

      // TODOS los reagendamientos van a lista de espera
      // Crear entrada en lista de espera automáticamente
      console.log('Intentando crear lista de espera...');
      try {
        // Manejar la fecha correctamente (puede ser Date o string desde la BD)
        let requestedDateStr: string;
        const eventDateValue: Date | string = newEvent.date as Date | string;
        
        if (eventDateValue instanceof Date) {
          requestedDateStr = eventDateValue.toISOString().split('T')[0];
        } else if (typeof eventDateValue === 'string') {
          // Si es string, puede venir en formato ISO o YYYY-MM-DD
          requestedDateStr = eventDateValue.split('T')[0];
        } else {
          // Fallback: convertir a Date y luego a string
          const eventDate = new Date(eventDateValue as any);
          if (isNaN(eventDate.getTime())) {
            throw new Error(`Fecha inválida: ${String(eventDateValue)}`);
          }
          requestedDateStr = eventDate.toISOString().split('T')[0];
        }

        console.log('Creando lista de espera para reagendamiento:', {
          studentId: createDto.studentId,
          eventId: createDto.newEventId,
          requestedDate: requestedDateStr,
          reason: createDto.reason || `Solicitud de reagendar desde ${originalEvent.title}`,
        });

        const waitlistEntry = await this.createWaitlist({
          studentId: createDto.studentId,
          eventId: createDto.newEventId,
          requestedDate: requestedDateStr,
          notes: createDto.reason || `Solicitud de reagendar desde ${originalEvent.title}`,
        });

        console.log('✅ Lista de espera creada exitosamente:', waitlistEntry.id);
      } catch (waitlistError: any) {
        // Si ya existe en lista de espera, continuar con la creación de la solicitud
        if (waitlistError instanceof ConflictException) {
          // Ya está en lista de espera, continuar
          console.log('⚠️ Ya existe en lista de espera para este evento, continuando...');
        } else {
          // Log del error pero continuar con la creación de la solicitud
          console.error('❌ Error al crear lista de espera:', waitlistError);
          console.error('Error message:', waitlistError?.message);
          console.error('Error stack:', waitlistError?.stack);
          // No lanzar el error para que la solicitud se cree de todas formas
        }
      }

      // Verificar disponibilidad solo para información (no bloquea)
      const isAvailable = await this.checkAvailability(newEvent);
      console.log('Disponibilidad del nuevo evento:', isAvailable);
      
      // Verificar si puede reagendar (para comodines y 24 horas)
      const canReschedule = await this.canReschedule(
        createDto.studentId,
        createDto.originalEventId,
        createDto.newEventId,
      );

      console.log('CanReschedule:', canReschedule);

      // Si no puede reagendar (sin comodines y menos de 24 horas), aún así permitirlo
      // porque irá a lista de espera y el admin decidirá
      usesJoker = canReschedule.requiresJoker;
      requires24Hours = !usesJoker;
      
      console.log('=== FIN REAGENDAMIENTO ===');
    }

    // Si es tarifa de viaje, calcular el 50% del costo
    let travelFeeAmount = createDto.travelFeeAmount;
    if (createDto.requestType === ChangeRequestType.TRAVEL_FEE) {
      if (!travelFeeAmount) {
        travelFeeAmount = Number(registration.calculatedCost) * 0.5;
      }
    }

    // Convertir leaveStartDate de string a Date si existe
    let leaveStartDate: Date | null = null;
    if (createDto.leaveStartDate) {
      leaveStartDate = new Date(createDto.leaveStartDate);
      // Asegurar que sea solo la fecha (sin hora)
      leaveStartDate.setHours(0, 0, 0, 0);
    }

    const changeRequest = this.changeRequestRepository.create({
      ...createDto,
      newEventId: newEvent?.id || null,
      usesJoker,
      requires24Hours,
      travelFeeAmount,
      leaveStartDate,
      travelFeeDates: createDto.travelFeeDates ?? null,
      status: ChangeRequestStatus.PENDING,
    });

    // Si usa comodín, consumirlo
    if (usesJoker && createDto.requestType === ChangeRequestType.RESCHEDULE) {
      const eventDate = new Date(originalEvent.date);
      const year = eventDate.getFullYear();
      const month = eventDate.getMonth() + 1;
      const jokers = await this.getOrCreateJokers(createDto.studentId, year, month);
      jokers.usedJokers += 1;
      await this.jokersRepository.save(jokers);
    }

    return await this.changeRequestRepository.save(changeRequest);
  }

  /**
   * Aprobar una solicitud de cambio
   */
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
      // Actualizar el registro original
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
          // Baja temporal: cancelar el registro
          originalRegistration.status = RegistrationStatus.CANCELLED;
          await queryRunner.manager.save(originalRegistration);
          break;

        case ChangeRequestType.TRAVEL_FEE:
          // Tarifa de viaje: mantener el registro pero marcar como apartado
          // El lugar se mantiene reservado
          break;

        case ChangeRequestType.RESCHEDULE:
          // Reagendar: solo actualizar la fecha de la inscripción (mismo registro, otro evento)
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

      // Actualizar la solicitud
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

  /**
   * Reagendamiento inmediato: solo actualiza la fecha/clase de la inscripción existente.
   * No crea ni elimina registros: cambia eventId de la misma inscripción y actualiza attendees.
   * Solo mismo mes.
   */
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

  /**
   * Reagendamiento inmediato en lote (varios pares). Un solo comodín por todo el reagendamiento.
   */
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

    // Si usó comodín, devolverlo
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

  /**
   * Obtener todas las solicitudes de cambio
   */
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

  /**
   * Obtener una solicitud de cambio
   */
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

  /**
   * Crear entrada en lista de espera
   */
  async createWaitlist(createDto: CreateWaitlistDto) {
    console.log('createWaitlist llamado con:', createDto);
    
    // Verificar que no exista ya una entrada PENDING para este estudiante y evento
    const existing = await this.waitlistRepository.findOne({
      where: {
        studentId: createDto.studentId,
        eventId: createDto.eventId,
        status: WaitlistStatus.PENDING,
      },
    });

    if (existing) {
      console.log('Ya existe entrada PENDING en lista de espera:', existing.id);
      throw new ConflictException('Ya estás en la lista de espera para esta clase');
    }

    // Verificar si existe con otro status (por el constraint único)
    const existingAnyStatus = await this.waitlistRepository.findOne({
      where: {
        studentId: createDto.studentId,
        eventId: createDto.eventId,
      },
    });

    if (existingAnyStatus) {
      console.log('Ya existe entrada en lista de espera con otro status:', existingAnyStatus.id, 'Status:', existingAnyStatus.status);
      // Si existe pero no está PENDING, actualizar a PENDING
      if (existingAnyStatus.status !== WaitlistStatus.PENDING) {
        existingAnyStatus.status = WaitlistStatus.PENDING;
        existingAnyStatus.requestedDate = new Date(createDto.requestedDate);
        existingAnyStatus.notes = createDto.notes || null;
        existingAnyStatus.notifiedAt = null;
        existingAnyStatus.registeredAt = null;
        const updated = await this.waitlistRepository.save(existingAnyStatus);
        console.log('Entrada actualizada a PENDING:', updated.id);
        return updated;
      }
      throw new ConflictException('Ya estás en la lista de espera para esta clase');
    }

    const student = await this.studentRepository.findOne({
      where: { id: createDto.studentId },
    });
    if (!student) {
      console.error('Estudiante no encontrado:', createDto.studentId);
      throw new NotFoundException('Estudiante no encontrado');
    }

    const event = await this.eventRepository.findOne({
      where: { id: createDto.eventId },
    });
    if (!event) {
      console.error('Evento no encontrado:', createDto.eventId);
      throw new NotFoundException('Evento no encontrado');
    }

    console.log('Creando nueva entrada en lista de espera...');
    const waitlist = this.waitlistRepository.create({
      ...createDto,
      requestedDate: new Date(createDto.requestedDate),
      status: WaitlistStatus.PENDING,
    });

    console.log('Entidad waitlist creada:', waitlist);
    const saved = await this.waitlistRepository.save(waitlist);
    console.log('Entrada guardada exitosamente:', saved.id);
    return saved;
  }

  /**
   * Obtener lista de espera
   */
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

  /**
   * Obtener una entrada de lista de espera por ID
   */
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

  /**
   * Notificar disponibilidad en lista de espera
   */
  async notifyWaitlistAvailability(eventId: string) {
    const waitlistEntries = await this.waitlistRepository.find({
      where: {
        eventId,
        status: WaitlistStatus.PENDING,
      },
      relations: ['student', 'event'],
      order: { createdAt: 'ASC' },
    });

    // Notificar al primero en la lista
    if (waitlistEntries.length > 0) {
      const firstEntry = waitlistEntries[0];
      firstEntry.status = WaitlistStatus.NOTIFIED;
      firstEntry.notifiedAt = new Date();
      await this.waitlistRepository.save(firstEntry);

      return firstEntry;
    }

    return null;
  }

  /**
   * Obtener comodines disponibles de un estudiante
   */
  async getStudentJokers(studentId: string, year: number, month: number) {
    return await this.getOrCreateJokers(studentId, year, month);
  }

  /**
   * Obtener studentId desde userId
   */
  async getStudentIdByUserId(userId: string): Promise<string | null> {
    const student = await this.studentRepository.findOne({
      where: { userId },
    });
    return student?.id || null;
  }

  /**
   * Verificar disponibilidad de un evento
   */
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

  /**
   * Actualizar attendees en eventos (nuevo array para que jsonb persista el cambio).
   * Quitar al estudiante libera el cupo; agregarlo lo ocupa.
   */
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

  /**
   * Procesa las bajas temporales: cancela todas las registraciones futuras
   * de estudiantes que tienen una baja temporal aprobada cuya fecha de inicio ya llegó
   */
  async processTemporaryLeaves() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Buscar todas las solicitudes de baja temporal aprobadas cuya fecha de inicio ya llegó
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

      // Solo procesar si la fecha de inicio ya llegó
      if (leaveStartDate.getTime() <= today.getTime()) {
        // Buscar todas las registraciones futuras del estudiante (desde la fecha de inicio)
        const futureRegistrations = await this.registrationRepository.find({
          where: {
            studentId: leave.studentId,
            status: In([RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED]),
          },
          relations: ['event'],
        });

        // Filtrar solo las que son desde la fecha de inicio en adelante
        const registrationsToCancel = futureRegistrations.filter((reg) => {
          if (!reg.event?.date) return false;
          const eventDate = new Date(reg.event.date);
          eventDate.setHours(0, 0, 0, 0);
          return eventDate.getTime() >= leaveStartDate.getTime();
        });

        // Cancelar las registraciones y remover de attendees
        for (const registration of registrationsToCancel) {
          registration.status = RegistrationStatus.CANCELLED;
          await this.registrationRepository.save(registration);

          // Remover de attendees del evento
          if (registration.eventId) {
            await this.updateEventAttendees(
              registration.eventId,
              leave.studentId,
              'remove',
            );
          }

          cancelledRegistrationsCount++;
        }

        // Marcar la solicitud como completada
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
