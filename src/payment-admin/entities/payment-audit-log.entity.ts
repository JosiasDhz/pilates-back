import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Payment } from 'src/payments/entities/payment.entity';
import { User } from 'src/users/entities/user.entity';

export enum PaymentAuditAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

@Entity('payment_audit_logs')
export class PaymentAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Payment, { nullable: false })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;

  @Column({ type: 'uuid' })
  paymentId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'adminId' })
  admin: User;

  @Column({ type: 'uuid' })
  adminId: string;

  @Column({
    type: 'enum',
    enum: PaymentAuditAction,
  })
  action: PaymentAuditAction;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
