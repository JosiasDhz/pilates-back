import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Payment } from './payment.entity';
import { File } from 'src/files/entities/file.entity';

@Entity('payment_evidences')
export class PaymentEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamptz' })
  uploadedAt: Date;

  @ManyToOne(() => Payment, (payment) => payment.evidences, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;

  @Column({ type: 'uuid' })
  paymentId: string;

  @ManyToOne(() => File, { nullable: false, eager: true })
  @JoinColumn({ name: 'fileId' })
  file: File;

  @Column({ type: 'uuid' })
  fileId: string;
}
