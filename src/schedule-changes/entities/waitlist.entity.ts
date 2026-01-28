import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { Student } from 'src/students/entities/student.entity';
import { Event } from 'src/calendar/entities/event.entity';

export enum WaitlistStatus {
  PENDING = 'pending',
  NOTIFIED = 'notified', // Se le notificó que hay disponibilidad
  REGISTERED = 'registered', // Ya se registró en la clase
  CANCELLED = 'cancelled',
  EXPIRED = 'expired', // Expiró porque ya pasó la fecha
}

@Entity('waitlist')
@Unique(['studentId', 'eventId'])
@Index(['studentId'])
@Index(['eventId'])
@Index(['status'])
@Index(['requestedDate'])
export class Waitlist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  studentId: string;

  @ManyToOne(() => Student, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studentId' })
  student: Student;

  @Column({ type: 'uuid', nullable: false })
  eventId: string;

  @ManyToOne(() => Event, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column({
    type: 'enum',
    enum: WaitlistStatus,
    default: WaitlistStatus.PENDING,
  })
  status: WaitlistStatus;

  @Column({ type: 'date', nullable: false })
  requestedDate: Date; // Fecha de la clase deseada

  @Column({ type: 'text', nullable: true })
  notes: string | null; // Notas del estudiante

  @Column({ type: 'timestamptz', nullable: true })
  notifiedAt: Date | null; // Cuando se le notificó disponibilidad

  @Column({ type: 'timestamptz', nullable: true })
  registeredAt: Date | null; // Cuando se registró en la clase

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
