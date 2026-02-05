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
import { ScheduleChangeRequest } from 'src/schedule-changes/entities/schedule-change-request.entity';

@Entity('travel_fee_balance')
@Unique(['studentId', 'monthYear'])
@Index(['studentId'])
@Index(['monthYear'])
@Index(['scheduleChangeRequestId'])
export class TravelFeeBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  studentId: string;

  @ManyToOne(() => Student, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studentId' })
  student: Student;

  @Column({ type: 'uuid', nullable: false })
  scheduleChangeRequestId: string;

  @ManyToOne(() => ScheduleChangeRequest, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheduleChangeRequestId' })
  scheduleChangeRequest: ScheduleChangeRequest;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total: number;

  @Column({ type: 'varchar' })
  monthYear: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
