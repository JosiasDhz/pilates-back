import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Student } from 'src/students/entities/student.entity';
import { StudentAssessmentMedicalHistory } from './student-assessment-medical-history.entity';
import { StudentAssessmentPhysicalRecord } from './student-assessment-physical-record.entity';
import { StudentAssessmentPhoto } from './student-assessment-photo.entity';

@Entity('student_assessments')
export class StudentAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, (student) => student.assessments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'studentId' })
  student: Student;

  @Column({ type: 'uuid', nullable: false })
  studentId: string;

  @Column({ type: 'date' })
  assessmentDate: Date;

  @Column({ type: 'text', nullable: true })
  assessmentComments: string | null;

  @Column({ type: 'text', nullable: true })
  assessmentNotes: string | null;

  @OneToOne(
    () => StudentAssessmentMedicalHistory,
    (medicalHistory) => medicalHistory.assessment,
    { cascade: true, eager: false },
  )
  medicalHistory: StudentAssessmentMedicalHistory;

  @OneToOne(
    () => StudentAssessmentPhysicalRecord,
    (physicalRecord) => physicalRecord.assessment,
    { cascade: true, eager: false },
  )
  physicalRecord: StudentAssessmentPhysicalRecord;

  @OneToMany(
    () => StudentAssessmentPhoto,
    (photo) => photo.assessment,
    { cascade: true, eager: false },
  )
  photos: StudentAssessmentPhoto[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
