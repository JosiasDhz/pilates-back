import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateConfigurationDto } from './dto/create-configuration.dto';
import { UpdateConfigurationDto } from './dto/update-configuration.dto';
import { Configuration, ConfigurationType } from './entities/configuration.entity';

@Injectable()
export class ConfigurationsService {
  constructor(
    @InjectRepository(Configuration)
    private readonly configRepo: Repository<Configuration>,
  ) {}

  private parseValue(cfg: Configuration): string | number | boolean | unknown {
    switch (cfg.type) {
      case ConfigurationType.NUMBER: {
        const n = Number(cfg.value);
        if (Number.isNaN(n)) throw new BadRequestException(`Valor inválido para ${cfg.key}`);
        return n;
      }
      case ConfigurationType.BOOLEAN:
        return String(cfg.value).toLowerCase() === 'true';
      case ConfigurationType.JSON:
        try {
          return JSON.parse(cfg.value);
        } catch {
          throw new BadRequestException(`JSON inválido para ${cfg.key}`);
        }
      case ConfigurationType.STRING:
      default:
        return cfg.value;
    }
  }

  private serializeValue(type: ConfigurationType, value: any): string {
    switch (type) {
      case ConfigurationType.NUMBER: {
        const n = Number(value);
        if (Number.isNaN(n)) throw new BadRequestException('Valor numérico inválido');
        return String(n);
      }
      case ConfigurationType.BOOLEAN:
        return value ? 'true' : 'false';
      case ConfigurationType.JSON:
        try {
          return JSON.stringify(value ?? null);
        } catch {
          throw new BadRequestException('JSON inválido');
        }
      case ConfigurationType.STRING:
      default:
        return String(value ?? '');
    }
  }

  async create(dto: CreateConfigurationDto) {
    const entity = this.configRepo.create({
      ...dto,
      value: this.serializeValue(dto.type, dto.value),
    });
    return this.configRepo.save(entity);
  }

  async findAll() {
    const list = await this.configRepo.find();
    return list.map((c) => ({ ...c, value: this.parseValue(c) }));
  }

  async findOne(id: string) {
    const cfg = await this.configRepo.findOne({ where: { id } });
    if (!cfg) throw new NotFoundException(`Configuración ${id} no encontrada`);
    return { ...cfg, value: this.parseValue(cfg) };
  }

  async update(id: string, dto: UpdateConfigurationDto) {
    const cfg = await this.configRepo.findOne({ where: { id } });
    if (!cfg) throw new NotFoundException(`Configuración ${id} no encontrada`);
    const nextType = dto.type ?? cfg.type;
    const nextValue =
      dto.value !== undefined ? this.serializeValue(nextType, dto.value) : cfg.value;
    Object.assign(cfg, { ...dto, type: nextType, value: nextValue });
    const saved = await this.configRepo.save(cfg);
    return { ...saved, value: this.parseValue(saved) };
  }

  async remove(id: string) {
    const cfg = await this.configRepo.findOne({ where: { id } });
    if (!cfg) throw new NotFoundException(`Configuración ${id} no encontrada`);
    await this.configRepo.remove(cfg);
    return { message: 'Configuración eliminada correctamente' };
  }

  async getByKey(key: string) {
    const cfg = await this.configRepo.findOne({ where: { key } });
    if (!cfg) return null;
    return this.parseValue(cfg);
  }

  private inferType(value: any): ConfigurationType {
    if (typeof value === 'number') return ConfigurationType.NUMBER;
    if (typeof value === 'boolean') return ConfigurationType.BOOLEAN;
    if (value !== null && typeof value === 'object') return ConfigurationType.JSON;
    return ConfigurationType.STRING;
  }

  async updateByKey(
    key: string,
    value: any,
    type?: ConfigurationType,
    group = 'SYSTEM',
  ) {
    const cfg = await this.configRepo.findOne({ where: { key } });
    if (!cfg) {
      const newType = type ?? this.inferType(value);
      const created = this.configRepo.create({
        key,
        type: newType,
        group,
        value: this.serializeValue(newType, value),
      });
      const saved = await this.configRepo.save(created);
      return { ...saved, value: this.parseValue(saved) };
    }
    const nextType = type ?? cfg.type;
    cfg.type = nextType;
    cfg.group = cfg.group ?? group;
    cfg.value = this.serializeValue(nextType, value);
    const saved = await this.configRepo.save(cfg);
    return { ...saved, value: this.parseValue(saved) };
  }

  async getByGroup(group: string) {
    const list = await this.configRepo.find({ where: { group } });
    return list.map((c) => ({ ...c, value: this.parseValue(c) }));
  }
}
