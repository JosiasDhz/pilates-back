import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AspirantAccessToken } from './entities/aspirant-access-token.entity';
import { Aspirante } from 'src/aspirantes/entities/aspirante.entity';
import { CreateAspirantAccessTokenDto } from './dto/create-aspirant-access-token.dto';
import * as crypto from 'crypto';

@Injectable()
export class AspirantAccessTokenService {
  constructor(
    @InjectRepository(AspirantAccessToken)
    private readonly tokenRepository: Repository<AspirantAccessToken>,
    @InjectRepository(Aspirante)
    private readonly aspirantRepository: Repository<Aspirante>,
  ) {}

  /**
   * Genera un token único para un aspirante
   */
  async generateToken(
    createDto: CreateAspirantAccessTokenDto,
  ): Promise<AspirantAccessToken> {
    const { aspirantId, expiresInDays = 30 } = createDto;

    // Verificar que el aspirante existe
    const aspirant = await this.aspirantRepository.findOne({
      where: { id: aspirantId },
    });

    if (!aspirant) {
      throw new NotFoundException('Aspirante no encontrado');
    }

    // Generar token único
    const token = this.generateUniqueToken();

    // Calcular fecha de expiración
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Crear el token
    const accessToken = this.tokenRepository.create({
      token,
      aspirantId,
      expiresAt,
      usedAt: null,
    });

    return await this.tokenRepository.save(accessToken);
  }

  /**
   * Verifica si un token es válido y retorna el aspirante asociado
   */
  async verifyToken(token: string): Promise<Aspirante> {
    const accessToken = await this.tokenRepository.findOne({
      where: { token },
      relations: ['aspirant'],
    });

    if (!accessToken) {
      throw new UnauthorizedException('Token inválido');
    }

    // Verificar expiración
    if (new Date() > accessToken.expiresAt) {
      throw new UnauthorizedException('Token expirado');
    }

    return accessToken.aspirant;
  }

  /**
   * Marca un token como usado (opcional, para tracking)
   */
  async markTokenAsUsed(token: string): Promise<void> {
    const accessToken = await this.tokenRepository.findOne({
      where: { token },
    });

    if (accessToken && !accessToken.usedAt) {
      accessToken.usedAt = new Date();
      await this.tokenRepository.save(accessToken);
    }
  }

  /**
   * Obtiene el token activo de un aspirante (si existe)
   */
  async getActiveTokenByAspirantId(
    aspirantId: string,
  ): Promise<AspirantAccessToken | null> {
    const now = new Date();
    return await this.tokenRepository
      .createQueryBuilder('token')
      .where('token.aspirantId = :aspirantId', { aspirantId })
      .andWhere('token.expiresAt > :now', { now })
      .orderBy('token.createdAt', 'DESC')
      .getOne();
  }

  /**
   * Genera un token único usando crypto
   */
  private generateUniqueToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Regenera un token para un aspirante (invalida el anterior)
   */
  async regenerateToken(
    createDto: CreateAspirantAccessTokenDto,
  ): Promise<AspirantAccessToken> {
    // Invalidar tokens anteriores (opcional, puedes mantenerlos activos)
    // Por ahora, simplemente generamos uno nuevo
    return await this.generateToken(createDto);
  }
}
