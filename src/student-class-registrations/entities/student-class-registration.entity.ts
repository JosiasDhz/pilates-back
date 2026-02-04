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
  Check,
} from 'typeorm';
import { Student } from 'src/students/entities/student.entity';
import { Event } from 'src/calendar/entities/event.entity';

export type PaymentModality = 'A' | 'B' | 'C';

export enum RegistrationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  NO_SHOW = 'no_show',
}

@Entity('student_class_registrations')
@Unique(['studentId', 'eventId'])
@Index(['studentId'])
@Index(['eventId'])
@Index(['status'])
@Index(['billingPeriod'])
@Index(['studentId', 'status'])
@Check(`"calculated_cost" >= 0`)
export class StudentClassRegistration {
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

  @Column({ type: 'varchar', length: 1, nullable: false })
  paymentModality: PaymentModality;

  @Column({
    name: 'calculated_cost',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: false,
  })
  calculatedCost: number;

  @Column({ type: 'varchar', length: 3, default: 'MXN' })
  currency: string;

  @Column({
    type: 'enum',
    enum: RegistrationStatus,
    default: RegistrationStatus.PENDING,
  })
  status: RegistrationStatus;

  @Column({ type: 'timestamptz', nullable: false, default: () => 'NOW()' })
  registrationDate: Date;

  @Column({ type: 'date', nullable: true })
  billingPeriod: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
