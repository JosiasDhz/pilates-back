import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './users/entities/user.entity';
import { Repository } from 'typeorm';
import { Rol } from './rols/entities/rol.entity';
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
  ) {}

  async onApplicationBootstrap() {
    await this.createDefaultData();
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

    const customerRol = await this.rolRepository.save({
      name: 'Customer',
      description: 'Customer role',
      permissions: ['/dashboard/my-purchases', '/dashboard/my-purchases'],
    });

    const sellerRol = await this.rolRepository.save({
      name: 'Seller',
      description: 'Seller role',
      permissions: ['/dashboard/my-sales', '/dashboard/my-commissions'],
    });

    await this.userRepository.save({
      name: 'Jairo Esteban',
      lastName: 'Martinez',
      secondLastName: 'Portillo',
      email: 'admin@karimnot.com',
      password: bcrypt.hashSync('A1b2c3', 10),
      rol: adminRol,
    });

    await this.userRepository.save({
      name: 'Pepe',
      lastName: 'Pica',
      secondLastName: 'Papas',
      email: 'pepe@gmail.com',
      password: bcrypt.hashSync('A1b2c3', 10),
      rol: customerRol,
    });

    await this.userRepository.save({
      name: 'Fulano',
      lastName: 'Perengano',
      secondLastName: 'Zutano',
      email: 'fulanito@gmail.com',
      password: bcrypt.hashSync('A1b2c3', 10),
      rol: sellerRol,
    });

    this.logger.log('Seed loaded');
  }

}
