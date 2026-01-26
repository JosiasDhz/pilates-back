import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  ManyToOne,
  BeforeInsert,
  BeforeUpdate,
  JoinColumn,
} from 'typeorm';
import { AspirantMedicalHistory } from 'src/aspirant-medical-history/entities/aspirant-medical-history.entity';
import { PaymentMethod } from 'src/payment-methods/entities/payment-method.entity';
import { AspirantStatus } from 'src/aspirant-status/entities/aspirant-status.entity';
import { Event } from 'src/calendar/entities/event.entity';

@Entity('aspirants')
export class Aspirante {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  firstName: string;

  @Column({ type: 'varchar', length: 120 })
  lastNamePaternal: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  lastNameMaternal: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'integer' })
  age: number;

  @Column({ type: 'varchar', length: 50 })
  language: string;

  @Column({ type: 'varchar', length: 120 })
  occupation: string;

  @Column({ type: 'varchar', length: 20 })
  gender: string;

  @ManyToOne(() => PaymentMethod, { nullable: false, eager: true })
  @JoinColumn({ name: 'paymentMethodId' })
  paymentMethod: PaymentMethod;

  @ManyToOne(() => AspirantStatus, { nullable: false, eager: true })
  @JoinColumn({ name: 'statusId' })
  status: AspirantStatus;

  @Column({ type: 'uuid', nullable: true })
  valoracionEventId: string | null;

  @ManyToOne(() => Event, { nullable: true, eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'valoracionEventId' })
  valoracionEvent: Event | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToOne(
    () => AspirantMedicalHistory,
    (medicalHistory) => medicalHistory.aspirant,
    { cascade: true, eager: false },
  )
  medicalHistory: AspirantMedicalHistory;

  @BeforeInsert()
  @BeforeUpdate()
  normalizeData() {
    if (this.email) {
      this.email = this.email.toLowerCase().trim();
    }
    if (this.firstName) {
      this.firstName = this.normalizeName(this.firstName);
    }
    if (this.lastNamePaternal) {
      this.lastNamePaternal = this.normalizeName(this.lastNamePaternal);
    }
    if (this.lastNameMaternal) {
      this.lastNameMaternal = this.normalizeName(this.lastNameMaternal);
    }
  }

  private normalizeName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
