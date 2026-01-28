import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { CreateStudentClassRegistrationDto } from './dto/create-student-class-registration.dto';
import { CreateBulkStudentClassRegistrationDto } from './dto/create-bulk-student-class-registration.dto';
import { UpdateStudentClassRegistrationDto } from './dto/update-student-class-registration.dto';
import {
  StudentClassRegistration,
  RegistrationStatus,
} from './entities/student-class-registration.entity';
import { Student } from 'src/students/entities/student.entity';
import { Event } from 'src/calendar/entities/event.entity';
import { Studio } from 'src/studios/entities/studio.entity';

@Injectable()
export class StudentClassRegistrationsService {
  constructor(
    @InjectRepository(StudentClassRegistration)
    private readonly registrationRepository: Repository<StudentClassRegistration>,
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Studio)
    private readonly studioRepository: Repository<Studio>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createDto: CreateStudentClassRegistrationDto) {
    // Verificar que el estudiante existe
    const student = await this.studentRepository.findOne({
      where: { id: createDto.studentId },
    });
    if (!student) {
      throw new NotFoundException('Estudiante no encontrado');
    }

    // Verificar que el evento existe
    const event = await this.eventRepository.findOne({
      where: { id: createDto.eventId },
      relations: ['studio'],
    });
    if (!event) {
      throw new NotFoundException('Evento no encontrado');
    }

    // Verificar que no sea una valoración
    if (event.type === 'valoracion') {
      throw new BadRequestException('No se pueden registrar valoraciones como clases');
    }

    // Verificar disponibilidad
    const isAvailable = await this.checkAvailability(event);
    if (!isAvailable) {
      throw new BadRequestException('No hay disponibilidad para esta clase');
    }

    // Verificar que no exista ya un registro
    const existing = await this.registrationRepository.findOne({
      where: {
        studentId: createDto.studentId,
        eventId: createDto.eventId,
      },
    });
    if (existing) {
      throw new ConflictException('El estudiante ya está registrado en esta clase');
    }

    // Crear el registro
    const registration = this.registrationRepository.create({
      ...createDto,
      currency: createDto.currency || 'MXN',
      billingPeriod: createDto.billingPeriod
        ? new Date(createDto.billingPeriod)
        : this.getBillingPeriod(new Date(event.date)),
      status: RegistrationStatus.PENDING,
      registrationDate: new Date(),
    });

    const saved = await this.registrationRepository.save(registration);

    // Actualizar el array de attendees en el evento
    await this.updateEventAttendees(event.id, student.id, 'add');

    return await this.findOne(saved.id);
  }

  async createBulk(createBulkDto: CreateBulkStudentClassRegistrationDto) {
    const { registrations } = createBulkDto;

    if (!registrations || registrations.length === 0) {
      throw new BadRequestException('No se proporcionaron registros');
    }

    // Validar que todos los registros sean del mismo estudiante
    const studentIds = [...new Set(registrations.map((r) => r.studentId))];
    if (studentIds.length > 1) {
      throw new BadRequestException(
        'Todos los registros deben ser del mismo estudiante',
      );
    }

    const studentId = studentIds[0];
    const eventIds = registrations.map((r) => r.eventId);

    // Verificar que el estudiante existe
    const student = await this.studentRepository.findOne({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException('Estudiante no encontrado');
    }

    // Verificar que todos los eventos existen y obtenerlos
    const events = await this.eventRepository.find({
      where: { id: In(eventIds) },
      relations: ['studio'],
    });

    if (events.length !== eventIds.length) {
      throw new NotFoundException('Uno o más eventos no fueron encontrados');
    }

    // Verificar que no haya valoraciones
    const valoraciones = events.filter((e) => e.type === 'valoracion');
    if (valoraciones.length > 0) {
      throw new BadRequestException(
        'No se pueden registrar valoraciones como clases',
      );
    }

    // Verificar disponibilidad para todos los eventos
    for (const event of events) {
      const isAvailable = await this.checkAvailability(event);
      if (!isAvailable) {
        throw new BadRequestException(
          `No hay disponibilidad para la clase: ${event.title}`,
        );
      }
    }

    // Verificar que no existan registros duplicados
    const existing = await this.registrationRepository.find({
      where: {
        studentId,
        eventId: In(eventIds),
      },
    });

    if (existing.length > 0) {
      const existingEventIds = existing.map((e) => e.eventId);
      throw new ConflictException(
        `El estudiante ya está registrado en: ${existingEventIds.join(', ')}`,
      );
    }

    // Crear todos los registros en una transacción
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const createdRegistrations: StudentClassRegistration[] = [];

      for (const regDto of registrations) {
        const event = events.find((e) => e.id === regDto.eventId);
        if (!event) continue;

        const registration = this.registrationRepository.create({
          ...regDto,
          currency: regDto.currency || 'MXN',
          billingPeriod: regDto.billingPeriod
            ? new Date(regDto.billingPeriod)
            : this.getBillingPeriod(new Date(event.date)),
          status: RegistrationStatus.PENDING,
          registrationDate: new Date(),
        });

        const saved = await queryRunner.manager.save(registration);
        createdRegistrations.push(saved);

        // Actualizar attendees del evento
        await this.updateEventAttendees(event.id, studentId, 'add');
      }

      await queryRunner.commitTransaction();

      // Retornar los registros creados con relaciones
      const ids = createdRegistrations.map((r) => r.id);
      return await this.registrationRepository.find({
        where: { id: In(ids) },
        relations: ['student', 'event', 'event.studio'],
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(studentId?: string, eventId?: string, status?: RegistrationStatus) {
    const query = this.registrationRepository
      .createQueryBuilder('registration')
      .leftJoinAndSelect('registration.student', 'student')
      .leftJoinAndSelect('registration.event', 'event')
      .leftJoinAndSelect('event.studio', 'studio')
      .leftJoinAndSelect('event.instructor', 'instructor');

    if (studentId) {
      query.andWhere('registration.studentId = :studentId', { studentId });
    }

    if (eventId) {
      query.andWhere('registration.eventId = :eventId', { eventId });
    }

    if (status) {
      query.andWhere('registration.status = :status', { status });
    }

    return await query.orderBy('registration.registrationDate', 'DESC').getMany();
  }

  async findOne(id: string) {
    const registration = await this.registrationRepository.findOne({
      where: { id },
      relations: ['student', 'event', 'event.studio', 'event.instructor'],
    });

    if (!registration) {
      throw new NotFoundException('Registro no encontrado');
    }

    return registration;
  }

  async findByStudent(studentId: string) {
    return await this.findAll(studentId);
  }

  async findByUserId(userId: string, status?: RegistrationStatus) {
    const student = await this.studentRepository.findOne({
      where: { userId },
    });

    if (!student) {
      return [];
    }

    return await this.findAll(student.id, undefined, status);
  }

  async findByEvent(eventId: string) {
    return await this.findAll(undefined, eventId);
  }

  async update(id: string, updateDto: UpdateStudentClassRegistrationDto) {
    const registration = await this.findOne(id);

    if (updateDto.paymentModality) {
      registration.paymentModality = updateDto.paymentModality;
    }

    if (updateDto.status) {
      registration.status = updateDto.status;
    }

    if (updateDto.billingPeriod) {
      registration.billingPeriod = new Date(updateDto.billingPeriod);
    }

    return await this.registrationRepository.save(registration);
  }

  async remove(id: string) {
    const registration = await this.findOne(id);

    // Actualizar el array de attendees en el evento
    await this.updateEventAttendees(
      registration.eventId,
      registration.studentId,
      'remove',
    );

    await this.registrationRepository.remove(registration);
    return { message: 'Registro eliminado correctamente' };
  }

  async removeBulk(ids: string[]) {
    const registrations = await this.registrationRepository.find({
      where: { id: In(ids) },
    });

    if (registrations.length === 0) {
      throw new NotFoundException('No se encontraron registros');
    }

    // Actualizar attendees de los eventos
    for (const reg of registrations) {
      await this.updateEventAttendees(reg.eventId, reg.studentId, 'remove');
    }

    await this.registrationRepository.remove(registrations);
    return { message: `${registrations.length} registro(s) eliminado(s)` };
  }

  /**
   * Verifica la disponibilidad de camas para un evento
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

    // Obtener capacidad según el tipo de clase
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

    // Contar registros confirmados o pendientes para este evento
    const confirmedRegistrations = await this.registrationRepository.count({
      where: {
        eventId: event.id,
        status: In([RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED]),
      },
    });

    // También contar los que están en el array attendees del evento
    const currentAttendees = event.attendees?.length || 0;

    // Usar el máximo entre los dos para asegurar consistencia
    const occupied = Math.max(confirmedRegistrations, currentAttendees);

    return capacity - occupied > 0;
  }

  /**
   * Actualiza el array de attendees en el evento
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

    const attendees = event.attendees || [];

    if (action === 'add') {
      if (!attendees.includes(studentId)) {
        attendees.push(studentId);
      }
    } else {
      const index = attendees.indexOf(studentId);
      if (index > -1) {
        attendees.splice(index, 1);
      }
    }

    event.attendees = attendees;
    await this.eventRepository.save(event);
  }

  /**
   * Obtiene el período de facturación (primer día del mes) para una fecha
   */
  private getBillingPeriod(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }
}
