import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { StudentAssessment } from './student-assessment.entity';

@Entity('student_assessment_medical_history')
export class StudentAssessmentMedicalHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => StudentAssessment, (assessment) => assessment.medicalHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'assessmentId' })
  assessment: StudentAssessment;

  @Column({ type: 'uuid', nullable: false, unique: true })
  assessmentId: string;

  @Column({ type: 'boolean', default: false })
  hasInjury: boolean;

  @Column({ type: 'text', nullable: true })
  injuryLocation: string | null;

  @Column({ type: 'text', nullable: true })
  injuryTime: string | null;

  @Column({ type: 'boolean', default: false })
  hasPhysicalAilment: boolean;

  @Column({ type: 'text', nullable: true })
  ailmentDetail: string | null;

  @Column({ type: 'text', nullable: true })
  surgeryComments: string | null;

  @Column({ type: 'text', nullable: true })
  additionalInfo: string | null;
}
