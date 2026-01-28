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

/**
 * Rastrea los comodines disponibles y usados por estudiante por mes
 * Los comodines no son acumulables de un mes a otro
 */
@Entity('student_jokers')
@Unique(['studentId', 'year', 'month'])
@Index(['studentId'])
@Index(['year', 'month'])
export class StudentJokers {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  studentId: string;

  @ManyToOne(() => Student, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studentId' })
  student: Student;

  @Column({ type: 'integer', nullable: false })
  year: number; // Año (ej: 2026)

  @Column({ type: 'integer', nullable: false })
  month: number; // Mes (1-12)

  @Column({ type: 'integer', default: 0 })
  totalJokers: number; // Total de comodines asignados según días por semana

  @Column({ type: 'integer', default: 0 })
  usedJokers: number; // Comodines usados este mes

  @Column({ type: 'integer', nullable: true })
  classesPerWeek: number | null; // Número de clases por semana (para referencia)

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  /**
   * Calcula los comodines disponibles
   */
  get availableJokers(): number {
    return Math.max(0, this.totalJokers - this.usedJokers);
  }
}
