import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './users/entities/user.entity';
import { Repository } from 'typeorm';
import { Rol } from './rols/entities/rol.entity';
import { AspirantStatus } from './aspirant-status/entities/aspirant-status.entity';
import { PaymentMethod } from './payment-methods/entities/payment-method.entity';
import { Studio } from './studios/entities/studio.entity';
import * as bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private logger = new Logger('SEED');

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,

    @InjectRepository(AspirantStatus)
    private readonly aspirantStatusRepository: Repository<AspirantStatus>,

    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,

    @InjectRepository(Studio)
    private readonly studioRepository: Repository<Studio>,
  ) {}

  async onApplicationBootstrap() {
    await this.createDefaultData();
    await this.createInstructorRole();
    await this.createDefaultAspirantStatuses();
    await this.createDefaultPaymentMethods();
    await this.createDefaultStudios();
  }

  private async createDefaultData() {
    const adminRolFound = await this.rolRepository.findOne({
      where: { name: 'Administrador' },
    });
    if (adminRolFound) {
      return this.logger.log('Seed already loaded');
    }

    const adminRol = await this.rolRepository.save({
      name: 'Administrador',
      description: 'All permision',
      permissions: ['*'],
    });

    await this.userRepository.save({
      name: 'Josias',
      lastName: 'Dominguez',
      secondLastName: 'Hernandez',
      email: 'admin@karimnot.com',
      password: bcrypt.hashSync('A1b2c3', 10),
      rol: adminRol,
    });

    this.logger.log('Seed loaded');
  }
  private async createInstructorRole() {
    const instructorRolFound = await this.rolRepository.findOne({
      where: { name: 'Instructor' },
    });
  
    if (instructorRolFound) {
      this.logger.log('Instructor role already exists');
      return instructorRolFound;
    }
  
    const instructorRol = await this.rolRepository.save({
      name: 'Instructor',
      description: 'Personal docente con acceso a gestión de cursos y alumnos',
      permissions: [
        '/dashboard/instructor/courses',
        '/dashboard/instructor/students',
        '/dashboard/instructor/reports',
      ],
    });
  
    this.logger.log('Instructor role created successfully');
    return instructorRol;
  }

  private async createDefaultAspirantStatuses() {
    const defaultStatuses = [
      { name: 'Pendiente', code: 'PENDING', description: 'Aspirante en proceso de evaluación' },
      { name: 'Convertido', code: 'CONVERTED', description: 'Aspirante convertido a estudiante' },
      { name: 'Rechazado', code: 'REJECTED', description: 'Aspirante rechazado' },
    ];

    for (const statusData of defaultStatuses) {
      const existing = await this.aspirantStatusRepository.findOne({
        where: { code: statusData.code },
      });

      if (!existing) {
        await this.aspirantStatusRepository.save(statusData);
        this.logger.log(`Aspirant status ${statusData.code} created`);
      }
    }

    this.logger.log('Default aspirant statuses initialized');
  }

  private async createDefaultPaymentMethods() {
    const defaultPaymentMethods = [
      {
        name: 'Efectivo',
        type: 'MANUAL' as const,
        requiresEvidence: false,
        instructions: 'Lleva el monto acordado a la sucursal el día de tu cita.',
        status: true,
      },
      {
        name: 'Transferencia Bancaria',
        type: 'MANUAL' as const,
        requiresEvidence: true,
        instructions: `NOMBRE: Marcela Paulina Hernández Álvarez
Banco: INBURSA
CUENTA: 50054020321
Tarjeta: 4658 2859 1519 4371
CLABE: 036610500540203218`,
        status: true,
      },
    ];

    for (const methodData of defaultPaymentMethods) {
      const existing = await this.paymentMethodRepository.findOne({
        where: { name: methodData.name },
      });

      if (!existing) {
        await this.paymentMethodRepository.save(methodData);
        this.logger.log(`Payment method ${methodData.name} created`);
      }
    }

    this.logger.log('Default payment methods initialized');
  }

  private async createDefaultStudios() {
    const defaultStudios = [
      {
        name: 'Reforma',
        address: 'Av Belizario Domínguez #1310 A, COL. REFORMA',
        phone: null,
        capacity: 19,
        capacityPrivate: 6,
        capacitySemiprivate: 3,
        status: true,
      },
      {
        name: 'Brenamiel',
        address: 'Av. Ferrocarril #100, COL. BRENAMIEL',
        phone: null,
        capacity: 0,
        capacityPrivate: 0,
        capacitySemiprivate: 0,
        status: true,
      },
    ];

    for (const studioData of defaultStudios) {
      const existing = await this.studioRepository.findOne({
        where: { name: studioData.name },
      });

      if (!existing) {
        await this.studioRepository.save(studioData);
        this.logger.log(`Studio ${studioData.name} created`);
      } else {
        this.logger.log(`Studio ${studioData.name} already exists`);
      }
    }

    this.logger.log('Default studios initialized');
  }

}
