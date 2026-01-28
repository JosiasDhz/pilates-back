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
import { UpdatePaymentDto } from './dto/update-payment.dto';
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

    // Asegurar que amountCents esté en centavos
    // Si el valor es menor a 1000, asumimos que viene en pesos y lo convertimos a centavos
    let amountCents = createPaymentDto.amountCents;
    if (amountCents < 1000) {
      // Probablemente viene en pesos, convertir a centavos
      amountCents = amountCents * 100;
    }

    // Crear el pago
    const payment = this.paymentRepository.create({
      amountCents: BigInt(amountCents),
      currency: createPaymentDto.currency || 'MXN',
      status: PaymentStatus.PENDING,
      referenceCode,
      userId: createPaymentDto.userId || null,
      aspirantId: createPaymentDto.aspirantId || null,
      paymentMethodId: createPaymentDto.paymentMethodId,
    });

    const saved = await this.paymentRepository.save(payment);
    // Devolver con amountCents como string para serialización JSON
    return {
      ...saved,
      amountCents: saved.amountCents.toString(),
    } as any;
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

    // Verificar que el pago existe (SIN cargar relaciones para evitar problemas de sincronización)
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
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

    // Crear el registro de evidencia usando insert directo para evitar problemas de sincronización
    console.log('Guardando evidencia en BD...');
    const insertResult = await this.paymentEvidenceRepository.insert({
      paymentId: payment.id,
      fileId: uploadedFile.id,
      uploadedAt: new Date(),
    });
    
    const savedEvidenceId = insertResult.identifiers[0].id;
    console.log('✅ Evidencia guardada:', savedEvidenceId);

    // Cambiar el estado del pago a UNDER_REVIEW usando update directo para evitar sincronización
    // Usar try-catch para que si hay error aquí, aún retornemos la evidencia guardada
    try {
      await this.paymentRepository.update(
        { id: payment.id },
        { status: PaymentStatus.UNDER_REVIEW }
      );
      console.log('✅ Estado del pago actualizado a UNDER_REVIEW');
    } catch (updateError) {
      console.error('⚠️ Error al actualizar estado del pago (pero evidencia ya guardada):', updateError);
      // Continuar aunque haya error, la evidencia ya está guardada
    }
    
    console.log('======================');

    // Retornar la evidencia buscándola sin relaciones para evitar problemas
    const savedEvidence = await this.paymentEvidenceRepository.findOne({
      where: { id: savedEvidenceId },
    });

    if (!savedEvidence) {
      throw new Error('Evidencia guardada pero no se pudo recuperar');
    }

    return savedEvidence;
  }

  /**
   * Encuentra un pago por ID con todas sus relaciones
   */
  async findOne(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['user', 'aspirant', 'paymentMethod', 'evidences', 'evidences.file'],
    });

    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    // Transformar bigint a string para serialización JSON
    return {
      ...payment,
      amountCents: payment.amountCents.toString(),
    } as any;
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
      .leftJoinAndSelect('payment.aspirant', 'aspirant')
      .leftJoinAndSelect('payment.paymentMethod', 'paymentMethod')
      .leftJoinAndSelect('payment.evidences', 'evidences')
      .leftJoinAndSelect('evidences.file', 'evidenceFile')
      .take(limit)
      .skip(offset);

    if (search.trim() !== '') {
      query.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search OR aspirant.firstName ILIKE :search OR aspirant.lastNamePaternal ILIKE :search OR aspirant.email ILIKE :search OR payment.referenceCode ILIKE :search)',
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

    // Transformar bigint a string para serialización JSON
    const transformedRecords = records.map((payment) => ({
      ...payment,
      amountCents: payment.amountCents.toString(),
    }));

    return {
      records: transformedRecords,
      total,
    };
  }

  /**
   * Encuentra todos los pagos del usuario autenticado (estudiante)
   */
  async findByUserId(userId: string): Promise<any[]> {
    const payments = await this.paymentRepository.find({
      where: { userId },
      relations: ['paymentMethod', 'evidences', 'evidences.file'],
      order: { createdAt: 'DESC' },
    });

    // Transformar bigint a string para serialización JSON
    return payments.map((payment) => ({
      ...payment,
      amountCents: payment.amountCents.toString(),
    }));
  }

  /**
   * Encuentra todos los pagos de un aspirante
   */
  async findByAspirantId(aspirantId: string): Promise<Payment[]> {
    return await this.paymentRepository.find({
      where: { aspirantId },
      relations: ['evidences', 'evidences.file', 'paymentMethod'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Agrega evidencia a un pago usando un fileId existente
   */
  async addEvidenceToPayment(
    paymentId: string,
    fileId: string,
  ): Promise<PaymentEvidence> {
    // No cargar relaciones para evitar problemas con cascade
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(
        `No se puede agregar evidencia. El pago está en estado: ${payment.status}`,
      );
    }

    // Crear el registro de evidencia usando insert directo
    const insertResult = await this.paymentEvidenceRepository.insert({
      paymentId: payment.id,
      fileId,
      uploadedAt: new Date(),
    });

    // Obtener la evidencia creada
    const savedEvidence = await this.paymentEvidenceRepository.findOne({
      where: { id: insertResult.identifiers[0].id },
      relations: ['payment', 'file'],
    });

    if (!savedEvidence) {
      throw new Error('Error al crear la evidencia de pago');
    }

    // Cambiar el estado del pago a UNDER_REVIEW usando update directo
    // Esto evita que TypeORM procese las relaciones con cascade
    await this.paymentRepository.update(
      { id: paymentId },
      { status: PaymentStatus.UNDER_REVIEW },
    );

    return savedEvidence;
  }

  /**
   * Actualiza un pago (principalmente el status)
   */
  async update(id: string, updatePaymentDto: UpdatePaymentDto): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    // Actualizar el status si se proporciona
    if (updatePaymentDto.status !== undefined) {
      payment.status = updatePaymentDto.status;
      
      // Si el status cambia a COMPLETED, establecer verifiedAt
      if (updatePaymentDto.status === PaymentStatus.COMPLETED && !payment.verifiedAt) {
        payment.verifiedAt = new Date();
      }
      
      // Si el status cambia de COMPLETED a otro, limpiar verifiedAt
      if (updatePaymentDto.status !== PaymentStatus.COMPLETED && payment.verifiedAt) {
        payment.verifiedAt = null;
      }
    }

    const updatedPayment = await this.paymentRepository.save(payment);

    // Transformar bigint a string para serialización JSON
    return {
      ...updatedPayment,
      amountCents: updatedPayment.amountCents.toString(),
    } as any;
  }

  /**
   * Actualiza el status del pago más reciente de un aspirante
   */
  async getLatestPaymentByAspirantId(aspirantId: string): Promise<Payment | null> {
    const payment = await this.paymentRepository.findOne({
      where: { aspirantId },
      relations: ['evidences', 'evidences.file', 'paymentMethod', 'user', 'aspirant'],
      order: { createdAt: 'DESC' },
    });

    if (!payment) {
      return null;
    }

    // Transformar bigint a string para serialización JSON
    return {
      ...payment,
      amountCents: payment.amountCents.toString(),
    } as any;
  }

  async updateAspirantPaymentStatus(
    aspirantId: string,
    updatePaymentDto: UpdatePaymentDto,
  ): Promise<Payment> {
    // Buscar el pago más reciente del aspirante
    const payment = await this.paymentRepository.findOne({
      where: { aspirantId },
      order: { createdAt: 'DESC' },
    });

    if (!payment) {
      throw new NotFoundException('No se encontró ningún pago para este aspirante');
    }

    // Actualizar el status si se proporciona
    if (updatePaymentDto.status !== undefined) {
      payment.status = updatePaymentDto.status;
      
      // Si el status cambia a COMPLETED, establecer verifiedAt
      if (updatePaymentDto.status === PaymentStatus.COMPLETED && !payment.verifiedAt) {
        payment.verifiedAt = new Date();
      }
      
      // Si el status cambia de COMPLETED a otro, limpiar verifiedAt
      if (updatePaymentDto.status !== PaymentStatus.COMPLETED && payment.verifiedAt) {
        payment.verifiedAt = null;
      }
    }

    const updatedPayment = await this.paymentRepository.save(payment);

    // Transformar bigint a string para serialización JSON
    return {
      ...updatedPayment,
      amountCents: updatedPayment.amountCents.toString(),
    } as any;
  }
}
