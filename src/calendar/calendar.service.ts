import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import * as moment from 'moment-timezone';

import { Event } from './entities/event.entity';
import { Studio } from 'src/studios/entities/studio.entity';
import { Instructor } from 'src/instructors/entities/instructor.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { QueryEventsDto } from './dto/query-events.dto';

const TZ = 'America/Mexico_City';

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Studio)
    private readonly studioRepository: Repository<Studio>,
    @InjectRepository(Instructor)
    private readonly instructorRepository: Repository<Instructor>,
  ) {}

  private async resolveStudio(studioId?: string): Promise<Studio | null> {
    if (!studioId) return null;
    const studio = await this.studioRepository.findOne({
      where: { id: studioId },
    });
    if (!studio)
      throw new NotFoundException(`Estudio con id ${studioId} no encontrado`);
    return studio;
  }

  private async resolveInstructor(instructorId?: string): Promise<Instructor | null> {
    if (!instructorId) return null;
    const instructor = await this.instructorRepository.findOne({
      where: { id: instructorId },
    });
    if (!instructor)
      throw new NotFoundException(`Instructor con id ${instructorId} no encontrado`);
    return instructor;
  }

  /**
   * Parsea una fecha YYYY-MM-DD como día local en America/Mexico_City (startOf day).
   * Evita UTC para que "2026-01-15" se guarde como 15 y no como 14.
   */
  private parseDateLocal(d: string | Date): Date {
    if (typeof d === 'object' && d instanceof Date) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const mtz = moment.tz(`${y}-${m}-${day}`, 'YYYY-MM-DD', TZ).startOf('day');
      if (!mtz.isValid()) throw new BadRequestException('Fecha inválida');
      return mtz.toDate();
    }
    const mtz = moment.tz(d as string, 'YYYY-MM-DD', TZ).startOf('day');
    if (!mtz.isValid()) throw new BadRequestException('Fecha inválida');
    return mtz.toDate();
  }

  private async mapCreateDtoToEvent(dto: CreateEventDto): Promise<Partial<Event>> {
    const date = this.parseDateLocal(dto.date);
    const [studio, instructor] = await Promise.all([
      this.resolveStudio(dto.studioId),
      this.resolveInstructor(dto.instructorId),
    ]);
    return {
      date,
      time: dto.time,
      duration: dto.duration ?? '1 hour',
      type: dto.type as Event['type'],
      title: dto.title,
      description: dto.description ?? null,
      location: dto.location ?? null,
      attendees: Array.isArray(dto.attendees) ? dto.attendees : [],
      studio,
      instructor,
    };
  }

  async createOne(dto: CreateEventDto) {
    const partial = await this.mapCreateDtoToEvent(dto);
    const entity = this.eventRepository.create(partial);
    const saved = await this.eventRepository.save(entity);
    return this.findOne(saved.id);
  }

  async createMany(dtos: CreateEventDto[]) {
    if (!dtos.length) throw new BadRequestException('Envía al menos un evento');
    const entities: Event[] = [];
    for (const dto of dtos) {
      const partial = await this.mapCreateDtoToEvent(dto);
      entities.push(this.eventRepository.create(partial));
    }
    const saved = await this.eventRepository.save(entities);
    return saved;
  }

  async findAll(query: QueryEventsDto) {
    const { month, year, studioId, type } = query;
    const qb = this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.studio', 'studio')
      .leftJoinAndSelect('event.instructor', 'instructor')
      .leftJoinAndSelect('instructor.employee', 'emp')
      .leftJoinAndSelect('emp.user', 'instructorUser')
      .orderBy('event.date', 'ASC')
      .addOrderBy('event.time', 'ASC');

    if (month != null && year != null) {
      const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      qb.andWhere('event.date >= :start', { start: startStr })
        .andWhere('event.date <= :end', { end: endStr });
    }

    if (studioId) qb.andWhere('event.studioId = :studioId', { studioId });
    if (type) qb.andWhere('event.type = :type', { type });

    const list = await qb.getMany();
    return list;
  }

  async findOne(id: string) {
    if (!isUUID(id))
      throw new BadRequestException('Proporciona un UUID válido de evento');
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: {
        studio: true,
        instructor: { employee: { user: true } },
      },
    });
    if (!event) throw new NotFoundException(`Evento con id ${id} no encontrado`);
    return event;
  }

  async update(id: string, dto: UpdateEventDto) {
    const event = await this.findOne(id);
    if (dto.date != null) event.date = this.parseDateLocal(dto.date as string | Date);
    if (dto.time != null) event.time = dto.time;
    if (dto.duration != null) event.duration = dto.duration;
    if (dto.type != null) event.type = dto.type as Event['type'];
    if (dto.title != null) event.title = dto.title;
    if (dto.description !== undefined) event.description = dto.description ?? null;
    if (dto.location !== undefined) event.location = dto.location ?? null;
    if (dto.attendees !== undefined) event.attendees = Array.isArray(dto.attendees) ? dto.attendees : [];
    if (dto.studioId !== undefined) {
      event.studio = await this.resolveStudio(dto.studioId ?? undefined);
    }
    if (dto.instructorId !== undefined) {
      event.instructor = await this.resolveInstructor(dto.instructorId ?? undefined);
    }
    await this.eventRepository.save(event);
    return this.findOne(id);
  }

  async remove(id: string) {
    const event = await this.findOne(id);
    await this.eventRepository.remove(event);
    return { message: 'Evento eliminado correctamente' };
  }
}
