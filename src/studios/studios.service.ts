import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';

import { Studio } from './entities/studio.entity';
import { File } from 'src/files/entities/file.entity';
import { CreateStudioDto } from './dto/create-studio.dto';
import { UpdateStudioDto } from './dto/update-studio.dto';
import { PaginateStudioDto } from './dto/paginate-studio.dto';
import { FilesService } from 'src/files/files.service';

@Injectable()
export class StudiosService {
  constructor(
    @InjectRepository(Studio)
    private readonly studioRepository: Repository<Studio>,
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    private readonly filesService: FilesService,
  ) {}

  private async hydrateImageUrl(studio: Studio): Promise<void> {
    if (!studio?.image?.id) return;
    try {
      const fileWithUrl = await this.filesService.findOne(studio.image.id);
      (studio as any).image = fileWithUrl;
    } catch {
      (studio as any).image = null;
    }
  }

  async create(dto: CreateStudioDto) {
    let file: File | null = null;
    if (dto.image) {
      file = await this.fileRepository.findOne({ where: { id: dto.image } });
      if (!file)
        throw new NotFoundException(`Archivo con id ${dto.image} no encontrado`);
    }

    const studio = this.studioRepository.create({
      name: dto.name.trim(),
      address: dto.address?.trim() ?? null,
      phone: dto.phone?.trim() ?? null,
      capacity: dto.capacity,
      capacityPrivate: dto.capacityPrivate,
      capacitySemiprivate: dto.capacitySemiprivate,
      capacityValoracion: dto.capacityValoracion,
      status: dto.status ?? true,
      ...(file && { image: file }),
    });
    const saved = await this.studioRepository.save(studio);
    const found = await this.studioRepository.findOne({
      where: { id: saved.id },
      relations: { image: true },
    });
    if (found) await this.hydrateImageUrl(found);
    return found ?? saved;
  }

  async findAllPaginated(paginationDto: PaginateStudioDto) {
    const {
      limit = 10,
      offset = 0,
      sort = 'Creado',
      order = 'desc',
      search = '',
      estatus = 'Todos',
    } = paginationDto;

    const qb = this.studioRepository
      .createQueryBuilder('studio')
      .leftJoinAndSelect('studio.image', 'image')
      .take(limit)
      .skip(offset);

    if (estatus !== 'Todos') {
      if (estatus === 'Activos') qb.andWhere('studio.status = :status', { status: true });
      if (estatus === 'Inactivos') qb.andWhere('studio.status = :status', { status: false });
    }

    if (search.trim() !== '') {
      const terms = search.trim().split(/\s+/).map((t) => `%${t}%`);
      terms.forEach((term, i) => {
        qb.andWhere(
          `(studio.name ILIKE :term${i} OR studio.address ILIKE :term${i} OR studio.phone ILIKE :term${i})`,
          { [`term${i}`]: term },
        );
      });
    }

    const orderDir = order === 'asc' ? 'ASC' : 'DESC';
    const sortMap: Record<string, string> = {
      Creado: 'studio.createdAt',
      Nombre: 'studio.name',
      Direccion: 'studio.address',
      Capacidad: 'studio.capacity',
      Status: 'studio.status',
    };
    const orderBy = sortMap[sort] ?? 'studio.createdAt';
    qb.orderBy(orderBy, orderDir);

    const [records, total] = await qb.getManyAndCount();
    return { records, total };
  }

  async findOne(id: string) {
    if (!isUUID(id))
      throw new BadRequestException('Proporciona un UUID válido de estudio');
    const studio = await this.studioRepository.findOne({
      where: { id },
      relations: { image: true },
    });
    if (!studio) throw new NotFoundException(`Estudio con id ${id} no encontrado`);
    await this.hydrateImageUrl(studio);
    return studio;
  }

  async update(id: string, dto: UpdateStudioDto) {
    const studio = await this.findOne(id);
    if (dto.name != null) studio.name = dto.name.trim();
    if (dto.address !== undefined) studio.address = dto.address?.trim() ?? null;
    if (dto.phone !== undefined) studio.phone = dto.phone?.trim() ?? null;
    if (dto.capacity != null) studio.capacity = dto.capacity;
    if (dto.capacityPrivate != null) studio.capacityPrivate = dto.capacityPrivate;
    if (dto.capacitySemiprivate != null) studio.capacitySemiprivate = dto.capacitySemiprivate;
    if (dto.capacityValoracion != null) studio.capacityValoracion = dto.capacityValoracion;
    if (dto.status !== undefined) studio.status = dto.status;

    if (dto.image !== undefined) {
      if (!dto.image) {
        studio.image = null;
      } else {
        const file = await this.fileRepository.findOne({ where: { id: dto.image } });
        if (!file)
          throw new NotFoundException(`Archivo con id ${dto.image} no encontrado`);
        studio.image = file;
      }
    }

    await this.studioRepository.save(studio);
    const updated = await this.studioRepository.findOne({
      where: { id },
      relations: { image: true },
    });
    if (updated) await this.hydrateImageUrl(updated);
    return updated ?? studio;
  }

  async remove(id: string) {
    const studio = await this.findOne(id);
    await this.studioRepository.remove(studio);
    return { message: 'Estudio eliminado correctamente' };
  }

  async getStats(): Promise<{ total: number; activos: number; inactivos: number }> {
    const raw = await this.studioRepository
      .createQueryBuilder('studio')
      .select('COUNT(studio.id)', 'total')
      .addSelect('SUM(CASE WHEN studio.status = true THEN 1 ELSE 0 END)', 'activos')
      .addSelect('SUM(CASE WHEN studio.status = false THEN 1 ELSE 0 END)', 'inactivos')
      .getRawOne();
    return {
      total: parseInt(raw?.total ?? '0', 10) || 0,
      activos: parseInt(raw?.activos ?? '0', 10) || 0,
      inactivos: parseInt(raw?.inactivos ?? '0', 10) || 0,
    };
  }
}
