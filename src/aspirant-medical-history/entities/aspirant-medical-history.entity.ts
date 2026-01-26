import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Aspirante } from 'src/aspirantes/entities/aspirante.entity';

@Entity('aspirant_medical_history')
export class AspirantMedicalHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Aspirante, (aspirant) => aspirant.medicalHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'aspirantId' })
  aspirant: Aspirante;

  @Column({ type: 'boolean', default: false })
  hasInjury: boolean;

  @Column({ type: 'text', nullable: true })
  injuryLocation: string;

  @Column({ type: 'text', nullable: true })
  injuryTime: string;

  @Column({ type: 'boolean', default: false })
  hasPhysicalAilment: boolean;

  @Column({ type: 'text', nullable: true })
  ailmentDetail: string;

  @Column({ type: 'text', nullable: true })
  surgeryComments: string;

  @Column({ type: 'text', nullable: true })
  additionalInfo: string;
}
