import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Payment } from 'src/payments/entities/payment.entity';

@Entity('payment_methods')
export class PaymentMethod {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: ['MANUAL', 'AUTOMATED'],
    default: 'MANUAL',
  })
  type: 'MANUAL' | 'AUTOMATED';

  @Column({ type: 'boolean', default: false })
  requiresEvidence: boolean;

  @Column({ type: 'text', nullable: true })
  instructions: string;

  @Column({ type: 'boolean', default: true })
  status: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => Payment, (payment) => payment.paymentMethod)
  payments: Payment[];
}
