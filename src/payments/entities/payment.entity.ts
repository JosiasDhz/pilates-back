import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { PaymentMethod } from 'src/payment-methods/entities/payment-method.entity';
import { PaymentEvidence } from './payment-evidence.entity';
import { Aspirante } from 'src/aspirantes/entities/aspirante.entity';

export enum PaymentStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint' })
  amountCents: bigint;

  @Column({ type: 'varchar', length: 3, default: 'MXN' })
  currency: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  referenceCode: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => Aspirante, { nullable: true })
  @JoinColumn({ name: 'aspirantId' })
  aspirant: Aspirante;

  @Column({ type: 'uuid', nullable: true })
  aspirantId: string | null;

  @ManyToOne(() => PaymentMethod, { nullable: false, eager: true })
  @JoinColumn({ name: 'paymentMethodId' })
  paymentMethod: PaymentMethod;

  @Column()
  paymentMethodId: number;

  @OneToMany(() => PaymentEvidence, (evidence) => evidence.payment, {
    cascade: true,
  })
  evidences: PaymentEvidence[];
}
