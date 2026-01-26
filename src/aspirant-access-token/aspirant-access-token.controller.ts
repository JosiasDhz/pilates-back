import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AspirantAccessTokenService } from './aspirant-access-token.service';
import { CreateAspirantAccessTokenDto } from './dto/create-aspirant-access-token.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { PaymentsService } from 'src/payments/payments.service';
import { FilesService } from 'src/files/files.service';
import { AspirantesService } from 'src/aspirantes/aspirantes.service';

@Controller('aspirant-access-tokens')
export class AspirantAccessTokenController {
  constructor(
    private readonly tokenService: AspirantAccessTokenService,
    private readonly paymentsService: PaymentsService,
    private readonly filesService: FilesService,
    private readonly aspirantesService: AspirantesService,
  ) {}

  /**
   * Generar token para un aspirante (solo admin/dashboard)
   */
  @Auth()
  @Post('generate')
  async generateToken(@Body() createDto: CreateAspirantAccessTokenDto) {
    const token = await this.tokenService.generateToken(createDto);
    return {
      token: token.token,
      expiresAt: token.expiresAt,
      link: `${process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3000'}/aspirantes/subir-evidencia/${token.token}`,
    };
  }

  /**
   * Verificar si un token es válido (público)
   */
  @Get('verify/:token')
  async verifyToken(@Param('token') token: string) {
    const aspirant = await this.tokenService.verifyToken(token);
    return {
      valid: true,
      aspirant: {
        id: aspirant.id,
        firstName: aspirant.firstName,
        lastNamePaternal: aspirant.lastNamePaternal,
      },
    };
  }

  /**
   * Subir evidencia usando token (público)
   */
  @Post('upload-evidence/:token')
  @UseInterceptors(FileInterceptor('evidence'))
  async uploadEvidence(
    @Param('token') token: string,
    @UploadedFile() evidence: Express.Multer.File,
  ) {
    if (!evidence) {
      throw new NotFoundException('No se proporcionó archivo de evidencia');
    }

    // Verificar token
    const aspirant = await this.tokenService.verifyToken(token);

    // Obtener el payment del aspirante
    const payments = await this.paymentsService.findByAspirantId(aspirant.id);
    const payment = payments.find((p) => p.status === 'PENDING');

    if (!payment) {
      throw new NotFoundException('No se encontró un pago pendiente para este aspirante');
    }

    // Subir archivo usando FilesService
    const uploadedFile = await this.filesService.uploadFile(evidence);

    // Crear evidencia de pago
    await this.paymentsService.addEvidenceToPayment(payment.id, uploadedFile.id);

    // Marcar token como usado (opcional)
    await this.tokenService.markTokenAsUsed(token);

    return {
      success: true,
      message: 'Evidencia subida exitosamente',
      paymentId: payment.id,
    };
  }

  /**
   * Obtener información del aspirante y estado de evidencia (público)
   */
  @Get('info/:token')
  async getAspirantInfo(@Param('token') token: string) {
    const aspirant = await this.tokenService.verifyToken(token);
    
    // Obtener payments del aspirante
    const payments = await this.paymentsService.findByAspirantId(aspirant.id);
    // Buscar payment PENDING o UNDER_REVIEW (para mostrar evidencia ya subida)
    const payment = payments.find((p) => p.status === 'PENDING' || p.status === 'UNDER_REVIEW');

    return {
      aspirant: {
        firstName: aspirant.firstName,
        lastNamePaternal: aspirant.lastNamePaternal,
        paymentMethod: aspirant.paymentMethod?.name,
      },
      payment: payment
        ? {
            id: payment.id,
            // Convertir centavos a pesos para el frontend (dividir entre 100)
            // amountCents es BigInt, convertir a Number primero
            amount: Number(payment.amountCents) / 100,
            hasEvidence: payment.evidences && payment.evidences.length > 0,
            evidenceCount: payment.evidences?.length || 0,
          }
        : null,
    };
  }
}
