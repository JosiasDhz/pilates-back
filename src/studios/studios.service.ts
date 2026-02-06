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

const SORT_FIELD_MAP: Record<string, string> = {
  Creado: 'studio.createdAt',
  Nombre: 'studio.name',
  Direccion: 'studio.address',
  Capacidad: 'studio.capacity',
  Status: 'studio.status',
};

const DEFAULT_SORT = 'studio.createdAt';
const STATUS_FILTER = {
  Activos: true,
  Inactivos: false,
} as const;

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
      (studio as Studio & { image: File | null }).image = fileWithUrl;
    } catch {
      (studio as Studio & { image: File | null }).image = null;
    }
  }

  private async findWithImage(id: string): Promise<Studio | null> {
    const studio = await this.studioRepository.findOne({
      where: { id },
      relations: { image: true },
    });
    if (studio) await this.hydrateImageUrl(studio);
    return studio;
  }

  private async resolveImageFile(
    imageId: string | null | undefined,
  ): Promise<File | null> {
    if (imageId == null || imageId === '') return null;
    const file = await this.fileRepository.findOne({ where: { id: imageId } });
    if (!file)
      throw new NotFoundException(`Archivo con id ${imageId} no encontrado`);
    return file;
  }

  private applyStatusFilter(
    qb: ReturnType<Repository<Studio>['createQueryBuilder']>,
    estatus: string,
  ): void {
    const status = estatus in STATUS_FILTER ? STATUS_FILTER[estatus as keyof typeof STATUS_FILTER] : undefined;
    if (status !== undefined) {
      qb.andWhere('studio.status = :status', { status });
    }
  }

  private applySearch(
    qb: ReturnType<Repository<Studio>['createQueryBuilder']>,
    search: string,
  ): void {
    const terms = search.trim().split(/\s+/).map((t) => `%${t}%`);
    terms.forEach((term, i) => {
      qb.andWhere(
        `(studio.name ILIKE :term${i} OR studio.address ILIKE :term${i} OR studio.phone ILIKE :term${i})`,
        { [`term${i}`]: term },
      );
    });
  }

  async create(dto: CreateStudioDto) {
    const image = await this.resolveImageFile(dto.image ?? null);

    const studio = this.studioRepository.create({
      name: dto.name.trim(),
      address: dto.address?.trim() ?? null,
      phone: dto.phone?.trim() ?? null,
      capacity: dto.capacity,
      capacityPrivate: dto.capacityPrivate,
      capacitySemiprivate: dto.capacitySemiprivate,
      capacityValoracion: dto.capacityValoracion,
      status: dto.status ?? true,
      ...(image && { image }),
    });

    const saved = await this.studioRepository.save(studio);
    return this.findWithImage(saved.id) ?? saved;
  }

  async findAllPaginated(dto: PaginateStudioDto) {
    const {
      limit = 10,
      offset = 0,
      sort = 'Creado',
      order = 'desc',
      search = '',
      estatus = 'Todos',
    } = dto;

    const qb = this.studioRepository
      .createQueryBuilder('studio')
      .leftJoinAndSelect('studio.image', 'image')
      .take(limit)
      .skip(offset);

    if (estatus !== 'Todos') this.applyStatusFilter(qb, estatus);
    if (search.trim()) this.applySearch(qb, search);

    const orderDir = order === 'asc' ? 'ASC' : 'DESC';
    qb.orderBy(SORT_FIELD_MAP[sort] ?? DEFAULT_SORT, orderDir);

    const [records, total] = await qb.getManyAndCount();
    return { records, total };
  }

  async findOne(id: string) {
    if (!isUUID(id))
      throw new BadRequestException('Proporciona un UUID válido de estudio');

    const studio = await this.findWithImage(id);
    if (!studio)
      throw new NotFoundException(`Estudio con id ${id} no encontrado`);
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
      studio.image = await this.resolveImageFile(dto.image ?? null);
    }

    await this.studioRepository.save(studio);
    return this.findWithImage(id) ?? studio;
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

    const parse = (v: string | undefined) => parseInt(v ?? '0', 10) || 0;
    return {
      total: parse(raw?.total),
      activos: parse(raw?.activos),
      inactivos: parse(raw?.inactivos),
    };
  }
}
