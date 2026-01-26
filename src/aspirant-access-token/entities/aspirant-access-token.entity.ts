import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Aspirante } from 'src/aspirantes/entities/aspirante.entity';

@Entity('aspirant_access_tokens')
export class AspirantAccessToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  token: string;

  @ManyToOne(() => Aspirante, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'aspirantId' })
  aspirant: Aspirante;

  @Column({ type: 'uuid' })
  aspirantId: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
