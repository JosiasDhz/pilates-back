import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Aspirante } from 'src/aspirantes/entities/aspirante.entity';

@Entity('aspirant_physical_record')
export class AspirantPhysicalRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Aspirante, (aspirant) => aspirant.physicalRecord, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'aspirantId' })
  aspirant: Aspirante;

  @Column({ type: 'uuid', nullable: false, unique: true })
  aspirantId: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  weight: number; // peso en kg

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  height: number; // altura en cm

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  bmi: number; // IMC calculado

  @Column({ type: 'text', nullable: true })
  flexibility: string; // flexibilidad

  @Column({ type: 'text', nullable: true })
  strength: string; // fuerza

  @Column({ type: 'text', nullable: true })
  balance: string; // equilibrio

  @Column({ type: 'text', nullable: true })
  posture: string; // postura

  @Column({ type: 'text', nullable: true })
  rangeOfMotion: string; // rango de movimiento

  @Column({ type: 'text', nullable: true })
  observations: string; // observaciones

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  calculateBMI() {
    if (this.weight && this.height && this.height > 0) {
      // Convertir altura de cm a metros
      const heightInMeters = this.height / 100;
      // Calcular IMC: peso (kg) / altura (m)²
      this.bmi = Number((this.weight / (heightInMeters * heightInMeters)).toFixed(2));
    }
  }
}
