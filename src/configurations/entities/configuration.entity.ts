import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ConfigurationType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
}

@Entity('configurations')
@Index(['key'], { unique: true })
@Index(['group'])
export class Configuration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'enum', enum: ConfigurationType })
  type: ConfigurationType;

  @Column({ type: 'varchar', length: 64 })
  group: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
