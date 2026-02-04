import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { StudentAssessment } from './student-assessment.entity';
import { File } from 'src/files/entities/file.entity';

@Entity('student_assessment_photos')
export class StudentAssessmentPhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => StudentAssessment, (assessment) => assessment.photos, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'assessmentId' })
  assessment: StudentAssessment;

  @Column({ type: 'uuid', nullable: false })
  assessmentId: string;

  @ManyToOne(() => File, { nullable: false, eager: true })
  @JoinColumn({ name: 'fileId' })
  file: File;

  @Column({ type: 'uuid', nullable: false })
  fileId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
