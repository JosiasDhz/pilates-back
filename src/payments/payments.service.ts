import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { PaymentEvidence } from './entities/payment-evidence.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { FilesService } from 'src/files/files.service';
import { User } from 'src/users/entities/user.entity';
import { PaymentMethod } from 'src/payment-methods/entities/payment-method.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentEvidence)
    private readonly paymentEvidenceRepository: Repository<PaymentEvidence>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    private readonly filesService: FilesService,
  ) {}

  /**
   * Genera un código de referencia alfanumérico de 8 caracteres
   */
  private generateReferenceCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Crea un pago manual con código de referencia único
   */
  async createManualPayment(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    // Verificar que el usuario existe si se proporciona userId
    let user: User | null = null;
    if (createPaymentDto.userId) {
      user = await this.userRepository.findOne({
        where: { id: createPaymentDto.userId },
      });
      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }
    }

    // Verificar que el método de pago existe
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: createPaymentDto.paymentMethodId },
    });
    if (!paymentMethod) {
      throw new NotFoundException('Método de pago no encontrado');
    }

    // Generar código de referencia único
    let referenceCode: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      referenceCode = this.generateReferenceCode();
      const existing = await this.paymentRepository.findOne({
        where: { referenceCode },
      });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new BadRequestException(
        'No se pudo generar un código de referencia único',
      );
    }

    // Crear el pago
    const payment = this.paymentRepository.create({
      amountCents: BigInt(createPaymentDto.amountCents),
      currency: createPaymentDto.currency || 'MXN',
      status: PaymentStatus.PENDING,
      referenceCode,
      userId: createPaymentDto.userId || null,
      aspirantId: createPaymentDto.aspirantId || null,
      paymentMethodId: createPaymentDto.paymentMethodId,
    });

    return await this.paymentRepository.save(payment);
  }

  /**
   * Sube una evidencia de pago y cambia el estado a UNDER_REVIEW
   */
  async uploadEvidence(
    paymentId: string,
    file: Express.Multer.File,
  ): Promise<PaymentEvidence> {
    console.log('=== UPLOAD EVIDENCE ===');
    console.log('PaymentId:', paymentId);
    console.log('File recibido:', file ? {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      fieldname: file.fieldname,
      hasBuffer: !!file.buffer,
      bufferLength: file.buffer?.length,
    } : 'NO HAY ARCHIVO');

    // Verificar que el pago existe
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['evidences'],
    });

    if (!payment) {
      console.error('❌ Pago no encontrado:', paymentId);
      throw new NotFoundException('Pago no encontrado');
    }

    console.log('Payment encontrado:', {
      id: payment.id,
      status: payment.status,
      amountCents: payment.amountCents.toString(),
    });

    // Verificar que el pago está en estado PENDING
    if (payment.status !== PaymentStatus.PENDING) {
      console.error('❌ Pago no está en estado PENDING:', payment.status);
      throw new BadRequestException(
        `No se puede subir evidencia. El pago está en estado: ${payment.status}`,
      );
    }

    // Verificar que el archivo tiene buffer
    if (!file.buffer) {
      console.error('❌ Archivo no tiene buffer');
      throw new BadRequestException('El archivo no tiene contenido (buffer)');
    }

    console.log('Subiendo archivo a S3...');
    // Subir el archivo usando FilesService
    const uploadedFile = await this.filesService.uploadFile(file);
    console.log('✅ Archivo subido a S3:', uploadedFile.id);

    // Crear el registro de evidencia
    const evidence = this.paymentEvidenceRepository.create({
      paymentId: payment.id,
      fileId: uploadedFile.id,
      uploadedAt: new Date(),
    });

    console.log('Guardando evidencia en BD...');
    const savedEvidence = await this.paymentEvidenceRepository.save(evidence);
    console.log('✅ Evidencia guardada:', savedEvidence.id);

    // Cambiar el estado del pago a UNDER_REVIEW
    payment.status = PaymentStatus.UNDER_REVIEW;
    await this.paymentRepository.save(payment);
    console.log('✅ Estado del pago actualizado a UNDER_REVIEW');
    console.log('======================');

    return savedEvidence;
  }

  /**
   * Encuentra un pago por ID con todas sus relaciones
   */
  async findOne(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['user', 'paymentMethod', 'evidences', 'evidences.file'],
    });

    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    return payment;
  }

  /**
   * Encuentra todos los pagos con paginación
   */
  async findAll(paginationDto?: any) {
    const {
      limit = 10,
      offset = 0,
      sort = 'createdAt',
      order = 'desc',
      search = '',
    } = paginationDto || {};

    const query = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.user', 'user')
      .leftJoinAndSelect('payment.paymentMethod', 'paymentMethod')
      .leftJoinAndSelect('payment.evidences', 'evidences')
      .take(limit)
      .skip(offset);

    if (search.trim() !== '') {
      query.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search OR payment.referenceCode ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    // Mapeo de campos de ordenamiento
    const sortMapping: Record<string, string> = {
      nombre: 'user.name',
      name: 'user.name',
      cliente: 'user.name',
      fecha: 'payment.createdAt',
      createdAt: 'payment.createdAt',
      monto: 'payment.amountCents',
      amount: 'payment.amountCents',
      estatus: 'payment.status',
      status: 'payment.status',
      referencia: 'payment.referenceCode',
      referenceCode: 'payment.referenceCode',
    };

    const sortField = sortMapping[sort] || 'payment.createdAt';
    const orderType = order === 'asc' ? 'ASC' : 'DESC';
    query.orderBy(sortField, orderType);

    const [records, total] = await query.getManyAndCount();

    return {
      records,
      total,
    };
  }
}
