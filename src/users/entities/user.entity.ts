import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Rol } from 'src/rols/entities/rol.entity';
import { File } from 'src/files/entities/file.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  whatsappName: string;

  @Column({ type: 'text', nullable: true })
  company: string;

  @Column({ type: 'text', nullable: true })
  lastName: string;

  @Column({ type: 'text', nullable: true })
  secondLastName: string;

  @Column({ type: 'text', nullable: false, unique: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  password: string;

  @Column({ type: 'boolean', nullable: true, default: true })
  status: boolean;

  @Column({ type: 'varchar', nullable: true })
  folio: string;

  @ManyToOne(() => Rol, (rol) => rol.user, { nullable: true, eager: true })
  rol: Rol;

  @ManyToOne(() => File, (file) => file.avatar, { nullable: true, eager: true })
  avatar: File;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updateAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  updateData() {
    if (this.email) {
      this.email = this.email.toLowerCase().trim();
    }

    this.name = this.normalizeName(this.name);
    this.lastName = this.normalizeName(this.lastName);
    this.secondLastName = this.normalizeName(this.secondLastName);
  }

  normalizeName(name: string | null | undefined): string | null {
    if (!name || typeof name !== 'string') {
      return null;
    }
    
    return name
      .trim()
      .replace(/\s+/g, ' ') // Reemplaza múltiples espacios por uno solo
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
