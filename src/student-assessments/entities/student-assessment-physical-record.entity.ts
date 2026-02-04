import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { StudentAssessment } from './student-assessment.entity';

@Entity('student_assessment_physical_record')
export class StudentAssessmentPhysicalRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => StudentAssessment, (assessment) => assessment.physicalRecord, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'assessmentId' })
  assessment: StudentAssessment;

  @Column({ type: 'uuid', nullable: false, unique: true })
  assessmentId: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  weight: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  height: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  bmi: number | null;

  @Column({ type: 'text', nullable: true })
  flexibility: string | null;

  @Column({ type: 'text', nullable: true })
  strength: string | null;

  @Column({ type: 'text', nullable: true })
  balance: string | null;

  @Column({ type: 'text', nullable: true })
  posture: string | null;

  @Column({ type: 'text', nullable: true })
  complexion: string | null;

  @Column({ type: 'text', nullable: true })
  rangeOfMotion: string | null;

  @Column({ type: 'text', nullable: true })
  observations: string | null;

  @BeforeInsert()
  @BeforeUpdate()
  calculateBMI() {
    if (this.weight && this.height && this.height > 0) {
      const heightInMeters = this.height / 100;
      this.bmi = Number((this.weight / (heightInMeters * heightInMeters)).toFixed(2));
    }
  }
}
