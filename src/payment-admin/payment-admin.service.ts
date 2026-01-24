import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentAuditLog, PaymentAuditAction } from './entities/payment-audit-log.entity';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { PaymentsService } from 'src/payments/payments.service';
import { Payment, PaymentStatus } from 'src/payments/entities/payment.entity';
import { FilesService } from 'src/files/files.service';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class PaymentAdminService {
  constructor(
    @InjectRepository(PaymentAuditLog)
    private readonly paymentAuditLogRepository: Repository<PaymentAuditLog>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly paymentsService: PaymentsService,
    private readonly filesService: FilesService,
  ) {}

  /**
   * Procesa un pago (aprobar o rechazar) y registra la acción en el audit log
   */
  async processPayment(
    paymentId: string,
    adminId: string,
    action: PaymentAuditAction,
    notes?: string,
  ) {
    // Verificar que el pago existe
    const payment = await this.paymentsService.findOne(paymentId);

    // Verificar que el admin existe
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
    });
    if (!admin) {
      throw new NotFoundException('Administrador no encontrado');
    }

    // Verificar que el pago está en estado UNDER_REVIEW
    if (payment.status !== PaymentStatus.UNDER_REVIEW) {
      throw new BadRequestException(
        `No se puede procesar el pago. El estado actual es: ${payment.status}. Solo se pueden procesar pagos en estado UNDER_REVIEW.`,
      );
    }

    // Determinar el nuevo estado según la acción
    let newStatus: PaymentStatus;
    if (action === PaymentAuditAction.APPROVE) {
      newStatus = PaymentStatus.COMPLETED;
    } else if (action === PaymentAuditAction.REJECT) {
      newStatus = PaymentStatus.REJECTED;
    } else {
      throw new BadRequestException('Acción inválida');
    }

    // Actualizar el estado del pago
    payment.status = newStatus;
    payment.verifiedAt = new Date();
    await this.paymentRepository.save(payment);

    // Registrar en el audit log
    const auditLog = this.paymentAuditLogRepository.create({
      paymentId: payment.id,
      adminId: admin.id,
      action,
      notes: notes || null,
    });
    await this.paymentAuditLogRepository.save(auditLog);

    // Obtener el pago completo con evidencias
    const paymentWithEvidences = await this.paymentsService.findOne(paymentId);

    // Obtener URLs firmadas para cada evidencia
    const evidencesWithUrls = await Promise.all(
      paymentWithEvidences.evidences.map(async (evidence) => {
        const fileWithUrl = await this.filesService.findOne(evidence.fileId);
        return {
          id: evidence.id,
          uploadedAt: evidence.uploadedAt,
          file: {
            id: fileWithUrl.id,
            name: fileWithUrl.name,
            extension: fileWithUrl.extension,
            url: fileWithUrl.url,
          },
        };
      }),
    );

    // Retornar el pago con evidencias y URLs firmadas
    return {
      ...paymentWithEvidences,
      evidences: evidencesWithUrls,
      auditLog: {
        id: auditLog.id,
        action: auditLog.action,
        notes: auditLog.notes,
        createdAt: auditLog.createdAt,
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
        },
      },
    };
  }

  /**
   * Obtiene todos los logs de auditoría
   */
  async findAllAuditLogs() {
    return await this.paymentAuditLogRepository.find({
      relations: ['payment', 'admin'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Obtiene los logs de auditoría de un pago específico
   */
  async findAuditLogsByPaymentId(paymentId: string) {
    return await this.paymentAuditLogRepository.find({
      where: { paymentId },
      relations: ['admin'],
      order: { createdAt: 'DESC' },
    });
  }
}
