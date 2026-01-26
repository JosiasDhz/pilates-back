import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Studio } from 'src/studios/entities/studio.entity';
import { Instructor } from 'src/instructors/entities/instructor.entity';
import { Aspirante } from 'src/aspirantes/entities/aspirante.entity';

export type EventType =
  | 'valoracion'
  | 'clase'
  | 'clase_privada'
  | 'clase_semiprivada';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'varchar', length: 32 })
  time: string;

  @Column({ type: 'varchar', length: 32, default: '1 hour' })
  duration: string;

  @Column({ type: 'varchar', length: 64 })
  type: EventType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string | null;

  @Column({ type: 'jsonb', default: [] })
  attendees: string[];

  @Column({ type: 'uuid', nullable: true })
  studioId: string | null;

  @ManyToOne(() => Studio, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'studioId' })
  studio: Studio | null;

  @Column({ type: 'uuid', nullable: true })
  instructorId: string | null;

  @ManyToOne(() => Instructor, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'instructorId' })
  instructor: Instructor | null;

  @OneToMany(() => Aspirante, (aspirant) => aspirant.valoracionEvent)
  aspirants: Aspirante[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
