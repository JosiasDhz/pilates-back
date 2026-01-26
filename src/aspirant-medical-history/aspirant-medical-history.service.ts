import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAspirantMedicalHistoryDto } from './dto/create-aspirant-medical-history.dto';
import { UpdateAspirantMedicalHistoryDto } from './dto/update-aspirant-medical-history.dto';
import { AspirantMedicalHistory } from './entities/aspirant-medical-history.entity';
import { Aspirante } from 'src/aspirantes/entities/aspirante.entity';

@Injectable()
export class AspirantMedicalHistoryService {
  constructor(
    @InjectRepository(AspirantMedicalHistory)
    private readonly medicalHistoryRepository: Repository<AspirantMedicalHistory>,
    @InjectRepository(Aspirante)
    private readonly aspiranteRepository: Repository<Aspirante>,
  ) {}

  async createForAspirant(
    aspirantId: string,
    createDto: CreateAspirantMedicalHistoryDto,
  ): Promise<AspirantMedicalHistory> {
    const aspirant = await this.aspiranteRepository.findOne({
      where: { id: aspirantId },
    });

    if (!aspirant) {
      throw new NotFoundException(
        `Aspirante con id ${aspirantId} no encontrado`,
      );
    }

    const medicalHistory = this.medicalHistoryRepository.create({
      ...createDto,
      aspirant,
    });

    return this.medicalHistoryRepository.save(medicalHistory);
  }

  async create(createDto: CreateAspirantMedicalHistoryDto) {
    const medicalHistory =
      this.medicalHistoryRepository.create(createDto);
    return this.medicalHistoryRepository.save(medicalHistory);
  }

  async findAll() {
    return this.medicalHistoryRepository.find({
      relations: ['aspirant'],
    });
  }

  async findOne(id: string) {
    const medicalHistory = await this.medicalHistoryRepository.findOne({
      where: { id },
      relations: ['aspirant'],
    });

    if (!medicalHistory) {
      throw new NotFoundException(
        `Historial médico con id ${id} no encontrado`,
      );
    }

    return medicalHistory;
  }

  async update(
    id: string,
    updateDto: UpdateAspirantMedicalHistoryDto,
  ) {
    const medicalHistory = await this.findOne(id);
    Object.assign(medicalHistory, updateDto);
    return this.medicalHistoryRepository.save(medicalHistory);
  }

  async remove(id: string) {
    const medicalHistory = await this.findOne(id);
    await this.medicalHistoryRepository.remove(medicalHistory);
    return { message: 'Historial médico eliminado correctamente' };
  }
}
