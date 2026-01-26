import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAspirantStatusDto } from './dto/create-aspirant-status.dto';
import { UpdateAspirantStatusDto } from './dto/update-aspirant-status.dto';
import { AspirantStatus } from './entities/aspirant-status.entity';

@Injectable()
export class AspirantStatusService {
  constructor(
    @InjectRepository(AspirantStatus)
    private readonly statusRepository: Repository<AspirantStatus>,
  ) {}

  async create(createDto: CreateAspirantStatusDto) {
    // Verificar si ya existe un estado con ese código
    const existingStatus = await this.statusRepository.findOne({
      where: { code: createDto.code },
    });

    if (existingStatus) {
      throw new BadRequestException(
        `Ya existe un estado con el código ${createDto.code}`,
      );
    }

    const status = this.statusRepository.create(createDto);
    return this.statusRepository.save(status);
  }

  async findAll() {
    return this.statusRepository.find({
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(id: string) {
    const status = await this.statusRepository.findOne({
      where: { id },
    });

    if (!status) {
      throw new NotFoundException(`Estado con id ${id} no encontrado`);
    }

    return status;
  }

  async findByCode(code: string) {
    const status = await this.statusRepository.findOne({
      where: { code },
    });

    if (!status) {
      throw new NotFoundException(`Estado con código ${code} no encontrado`);
    }

    return status;
  }

  async update(id: string, updateDto: UpdateAspirantStatusDto) {
    const status = await this.findOne(id);

    // Verificar código único si se está actualizando
    if (updateDto.code && updateDto.code !== status.code) {
      const existingStatus = await this.statusRepository.findOne({
        where: { code: updateDto.code },
      });

      if (existingStatus && existingStatus.id !== id) {
        throw new BadRequestException(
          `Ya existe un estado con el código ${updateDto.code}`,
        );
      }
    }

    Object.assign(status, updateDto);
    return this.statusRepository.save(status);
  }

  async remove(id: string) {
    const status = await this.findOne(id);
    await this.statusRepository.remove(status);
    return { message: 'Estado eliminado correctamente' };
  }

  async initializeDefaultStatuses() {
    const defaultStatuses = [
      { name: 'Pendiente', code: 'PENDING', description: 'Aspirante en proceso de evaluación' },
      { name: 'Convertido', code: 'CONVERTED', description: 'Aspirante convertido a estudiante' },
      { name: 'Rechazado', code: 'REJECTED', description: 'Aspirante rechazado' },
    ];

    const results = [];
    for (const statusData of defaultStatuses) {
      const existing = await this.statusRepository.findOne({
        where: { code: statusData.code },
      });

      if (!existing) {
        const status = this.statusRepository.create(statusData);
        const saved = await this.statusRepository.save(status);
        results.push(saved);
      } else {
        results.push(existing);
      }
    }

    return results;
  }
}
