import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Aspirante } from 'src/aspirantes/entities/aspirante.entity';
import { StudentStatusHistory } from './student-status-history.entity';
import { StudentClassRegistration } from 'src/student-class-registrations/entities/student-class-registration.entity';
import { StudentAssessment } from 'src/student-assessments/entities/student-assessment.entity';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => User, { nullable: false, onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', unique: true })
  aspirantId: string;

  @OneToOne(() => Aspirante, { nullable: false, onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'aspirantId' })
  aspirant: Aspirante;

  @Column({ type: 'date' })
  enrollmentDate: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  hasAnnualMembership: boolean;

  @Column({ type: 'integer', nullable: true })
  annualMembershipYear: number | null;

  @OneToMany(
    () => StudentStatusHistory,
    (statusHistory) => statusHistory.student,
    { cascade: true, eager: false },
  )
  statusHistory: StudentStatusHistory[];

  @OneToMany(
    () => StudentClassRegistration,
    (registration) => registration.student,
    { cascade: false, eager: false },
  )
  classRegistrations: StudentClassRegistration[];

  @OneToMany(
    () => StudentAssessment,
    (assessment) => assessment.student,
    { cascade: false, eager: false },
  )
  assessments: StudentAssessment[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
