import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Aspirante } from 'src/aspirantes/entities/aspirante.entity';
import { File } from 'src/files/entities/file.entity';

@Entity('aspirant_assessment_photo')
export class AspirantAssessmentPhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Aspirante, (aspirant) => aspirant.assessmentPhotos, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'aspirantId' })
  aspirant: Aspirante;

  @Column({ type: 'uuid', nullable: false })
  aspirantId: string;

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
