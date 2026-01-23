import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, Not } from 'typeorm';
import { isUUID } from 'class-validator';
import * as bcrypt from 'bcrypt';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { User } from './entities/user.entity';
import { Rol } from 'src/rols/entities/rol.entity';
import { File } from 'src/files/entities/file.entity';
import { v4 as uuid } from 'uuid';
import { FilesService } from 'src/files/files.service';
import { PaginationUserDto } from './dto/paginate-user.dto';
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,

    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,

    private readonly fileService: FilesService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    let { rolId, avatar, ...data } = createUserDto;

    if (!data.password) data.password = uuid();

    const userEmail = await this.findOneByEmail(data.email);

    if (userEmail)
      throw new BadRequestException({
        message: `Ya existe un usuario con ese correo`,
      });

    const rol = await this.rolRepository.findOneBy({ id: rolId });

    if (!rol) throw new NotFoundException(`Rol con id ${rolId} no encontrado`);

    const file = await this.fileRepository.findOneBy({ id: avatar });
    if (!file)
      throw new NotFoundException(`Archivo con id ${avatar} no encontrado`);

    data.password = bcrypt.hashSync(data.password, 10);
    const user = this.userRepository.create({ ...data, rol, avatar: file });
    await this.userRepository.save(user);

    delete user.password;

    return user;
  }

  async findAll(paginationDto: PaginationUserDto) {
    const {
      limit = 10,
      offset = 0,
      sort = 'Creado',
      order = 'asc',
      search = '',
      rol = 'Todos',
      sucursal = 'Todas',
      estatus = 'Todos',
    } = paginationDto;

    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.avatar', 'avatar')
      .leftJoinAndSelect('user.rol', 'rol')
      .take(limit)
      .skip(offset);

    if (estatus !== 'Todos') {
      if (estatus === 'Activos') {
        query.andWhere('user.status = :status', { status: true });
      }
      if (estatus === 'Inactivos') {
        query.andWhere('user.status = :status', { status: false });
      }
    }

    if (search.trim() !== '') {
      const searchTerms = search
        .trim()
        .split(/\s+/) // Divide el input en palabras
        .map((term) => `%${term}%`);

      searchTerms.forEach((term, index) => {
        query.andWhere(
          `(user.name ILIKE :term${index} OR user.lastName ILIKE :term${index} OR user.secondLastName ILIKE :term${index} OR user.email ILIKE :term${index})`,
          { [`term${index}`]: term },
        );
      });
    }

    if (rol !== 'Todos') {
      console.log('ENRTO AL ROL');
      const roles = rol.split(',');
      query.andWhere('UPPER(rol.name) IN (:...roles)', {
        roles: roles.map((role) => role.toUpperCase()),
      });
    }

    const orderType = order === 'asc' ? 'ASC' : 'DESC';
    if (sort === 'Creado') {
      query.orderBy('user.createdAt', orderType);
    }

    if (sort === 'Nombre(s)') {
      query.orderBy('user.name', orderType);
    }

    if (sort === 'Email') {
      query.orderBy('user.email', orderType);
    }

    if (sort === 'Permisos') {
      query.orderBy('rol.name', orderType);
    }

    if (sort === 'Status') {
      query.orderBy('user.status', orderType);
    }

    const [data, total] = await query.getManyAndCount();

    // const records = await Promise.all(
    //   data.map(async (user) => {
    //     const image = await this.fileService.findOne(user.avatar.id);

    //     user.avatar = image;

    //     return { ...user, avatar: image };
    //   }),
    // );

    return {
      records: data,
      total: total,
    };
  }

  async findOne(id: string, user: User) {
    if (!isUUID(id))
      throw new BadRequestException('Proporciona un UUID valido');

    const userFound = await this.userRepository.findOne({
      where: { id },
      relations: {
        avatar: true,
        rol: true,
      },
    });

    const image = await this.fileService.findOne(userFound.avatar.id);
    userFound.avatar = image;

    if (!userFound) throw new NotFoundException('Usuario no encontrado');

    if (user.rol.name === 'Administrador') return userFound;

    if (userFound.id === user.id) return userFound;

    throw new ForbiddenException(
      `Usuario: ${user.name} no tiene los permisos necesarios`,
    );
  }

  async update(id: string, updateUserDto: UpdateUserDto, user: User) {
    let userFound: any = await this.findOne(id, user);
    const { avatar, rolId, ...data } = updateUserDto;
    userFound = { ...userFound, ...data };

    if (updateUserDto.password) {
      delete updateUserDto.password;
      userFound.password = bcrypt.hashSync(updateUserDto.password, 10);
    }

    if (rolId) {
      if (!isUUID(updateUserDto.rolId))
        throw new BadRequestException('Proporciona un UUID valido');

      const rol = await this.rolRepository.findOneBy({
        id: updateUserDto.rolId,
      });

      if (!rol)
        throw new NotFoundException(
          `Rol con id ${updateUserDto.rolId} no encontrado`,
        );

      userFound.rol = rol;
    }

    if (avatar) {
      const file = await this.fileRepository.findOneBy({
        id: updateUserDto.avatar,
      });
      if (!file)
        throw new NotFoundException(
          `Archivo con id ${updateUserDto.avatar} no encontrado`,
        );
      userFound.avatar = file;
    }

    userFound.name = this.normalizeName(userFound.name);
    userFound.lastName = this.normalizeName(userFound.lastName);
    userFound.secondLastName = this.normalizeName(userFound.secondLastName);
    userFound.email = userFound.email.toLowerCase().trim();

    const { affected } = await this.userRepository.update({ id }, userFound);

    return { message: `Usuario actualizado` };
  }

  async remove(id: string) {
    const { affected } = await this.userRepository.delete({ id });
    if (affected === 0)
      throw new BadRequestException(`Usuario con id ${id} no encontrado`);

    return { message: 'Usuario eliminado' };
  }

  async findOneByEmail(email: string) {
    const user = await this.userRepository.findOneBy({ email });

    return user;
  }

  private normalizeName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ') // Reemplaza múltiples espacios por uno solo
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  async findWithFolio() {
    const users = await this.userRepository.find({
      where: {
        folio: Not(IsNull()),
      },
    });

    return users;
  }
}
