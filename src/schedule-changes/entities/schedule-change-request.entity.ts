import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Student } from 'src/students/entities/student.entity';
import { Event } from 'src/calendar/entities/event.entity';

export enum ChangeRequestType {
  TEMPORARY_LEAVE = 'temporary_leave', // Baja temporal
  TRAVEL_FEE = 'travel_fee', // Tarifa de viaje
  RESCHEDULE = 'reschedule', // Reagendar
}

export enum ChangeRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('schedule_change_requests')
@Index(['studentId'])
@Index(['originalEventId'])
@Index(['newEventId'])
@Index(['status'])
@Index(['requestType'])
export class ScheduleChangeRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  studentId: string;

  @ManyToOne(() => Student, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studentId' })
  student: Student;

  @Column({ type: 'uuid', nullable: false })
  originalEventId: string;

  @ManyToOne(() => Event, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'originalEventId' })
  originalEvent: Event;

  @Column({ type: 'uuid', nullable: true })
  newEventId: string | null;

  @ManyToOne(() => Event, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'newEventId' })
  newEvent: Event | null;

  @Column({
    type: 'enum',
    enum: ChangeRequestType,
    nullable: false,
  })
  requestType: ChangeRequestType;

  @Column({
    type: 'enum',
    enum: ChangeRequestStatus,
    default: ChangeRequestStatus.PENDING,
  })
  status: ChangeRequestStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  travelFeeAmount: number | null; // 50% del costo normal para tarifa de viaje

  @Column({ type: 'boolean', default: false })
  usesJoker: boolean; // Si usa un comodín

  @Column({ type: 'boolean', default: false })
  requires24Hours: boolean; // Si requiere 24 horas de anticipación

  @Column({ type: 'timestamptz', nullable: true })
  requestedDate: Date | null; // Fecha solicitada para el cambio

  @Column({ type: 'date', nullable: true })
  leaveStartDate: Date | null; // Fecha de inicio de baja temporal

  @Column({ type: 'jsonb', nullable: true })
  travelFeeDates: string[] | null; // Días solicitados para tarifa de viaje (YYYY-MM-DD)

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approvedById: string | null; // Usuario que aprobó

  @Column({ type: 'text', nullable: true })
  adminNotes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
