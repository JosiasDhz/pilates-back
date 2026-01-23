import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRolDto } from './dto/update-rol.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Rol } from './entities/rol.entity';
import { Not, Repository } from 'typeorm';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { isUUID } from 'class-validator';

@Injectable()
export class RolsService {
  constructor(
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
  ) {}

  async create(createRolDto: CreateRolDto) {
    const { name, ...data } = createRolDto;

    const rolName = await this.rolRepository.findOne({
      where: { name: name },
    });

    if (rolName)
      throw new BadRequestException(`Ya existe un rol con ese nombre`);

    const rol = this.rolRepository.create({ name, ...data });
    await this.rolRepository.save(rol);

    return rol;
  }

  async findAllNotPaginated() {
    const rols = await this.rolRepository.find({});

    return rols;
  }

  async findAll(paginationDto: PaginationDto) {
    const {
      limit = 10,
      offset = 0,
      sort = 'createdAt',
      order = 'asc',
      
    } = paginationDto;

    const orderType = order === 'asc' ? 'ASC' : 'DESC';

    const query = this.rolRepository
      .createQueryBuilder('rol')
      .take(limit)
      .skip(offset)
      .where('rol.name != :rolAdmin', { rolAdmin: 'Administrador' });
    const active = await this.rolRepository.count({
      where: { status: true, name: Not('Administrador') },
    });
    const inactive = await this.rolRepository.count({
      where: { status: false, name: Not('Administrador') },
    });
    const rolsCount = await this.rolRepository.count({
      where: { name: Not('Administrador') },
    });

    if (status !== 'All') {
      if (status === 'Activos') {
        query.andWhere('rol.status = :status', { status: true });
      }
      if (status === 'Inactivos') {
        query.andWhere('rol.status = :status', { status: false });
      }
    }

    // if (name !== '') {
    //   query.andWhere('(rol.name ILIKE :name)', { name: `%${name}%` });
    // }

    if (sort === 'createdAt') {
      query.orderBy('rol.createdAt', orderType);
    }

    if (sort === 'status') {
      query.orderBy('rol.status', orderType);
    }

    if (sort === 'name') {
      query.orderBy('rol.name', orderType);
    }

    if (sort === 'description') {
      query.orderBy('rol.description', orderType);
    }

    const [data, total] = await query.getManyAndCount();

    return {
      records: data,
      totalRecords: total,
      total: rolsCount,
      active,
      inactive,
    };
  }

  async findOne(id: string) {
    if (!isUUID(id))
      throw new BadRequestException('Proporciona un UUID valido');

    const rolFound = await this.rolRepository.findOneBy({ id });

    if (!rolFound) throw new NotFoundException('Rol no encontrado');

    return rolFound;
  }

  async update(id: string, updateRolDto: UpdateRolDto) {
    if (!isUUID(id))
      throw new BadRequestException('Proporciona un UUID valido');

    const { name, ...data } = updateRolDto;
    const rolFound = await this.rolRepository.findOne({
      where: { id: id, name: Not('Administrador') },
    });

    if (!rolFound) throw new NotFoundException('Rol no encontrado');

    const rolUpdate = await this.rolRepository.create({ ...data, name, id });
    await this.rolRepository.save(rolUpdate);

    return { message: 'Rol actualizado' };
  }

  async remove(id: string) {
    const { affected } = await this.rolRepository.delete({
      id: id,
      name: Not('Administrador'),
    });

    if (!affected) throw new NotFoundException('Rol no encontrado');

    return { message: 'Rol eliminado' };
  }
}
