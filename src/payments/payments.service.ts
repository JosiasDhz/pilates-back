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
import { Aspirante } from 'src/aspirantes/entities/aspirante.entity';
import { Student } from 'src/students/entities/student.entity';
import * as PDFDocument from 'pdfkit';
import { format, startOfMonth, endOfMonth, getDay, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import * as path from 'path';
import * as fs from 'fs';

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
    @InjectRepository(Aspirante)
    private readonly aspirantRepository: Repository<Aspirante>,
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
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
    // Normalizar userId, aspirantId y studentId (eliminar strings vacíos)
    let userId = createPaymentDto.userId?.trim() || null;
    const aspirantId = createPaymentDto.aspirantId?.trim() || null;
    const studentId = createPaymentDto.studentId?.trim() || null;

    // Si se proporciona studentId, obtener el userId correspondiente
    if (studentId) {
      const student = await this.studentRepository.findOne({
        where: { id: studentId },
        relations: ['user'],
      });
      if (!student) {
        throw new NotFoundException('Estudiante no encontrado');
      }
      userId = student.userId;
    }

    // Verificar que al menos uno de userId o aspirantId esté presente
    if (!userId && !aspirantId) {
      throw new BadRequestException('Debe proporcionarse userId, studentId o aspirantId');
    }

    // Verificar que el usuario existe si se proporciona userId
    let user: User | null = null;
    if (userId) {
      user = await this.userRepository.findOne({
        where: { id: userId },
      });
      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }
    }

    // Verificar que el aspirante existe si se proporciona aspirantId
    if (aspirantId) {
      const aspirant = await this.aspirantRepository.findOne({
        where: { id: aspirantId },
      });
      if (!aspirant) {
        throw new NotFoundException('Aspirante no encontrado');
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
      userId: userId || null,
      aspirantId: aspirantId || null,
      paymentMethodId: createPaymentDto.paymentMethodId,
      classSelectionData: createPaymentDto.classSelectionData || null,
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
   * Encuentra todos los pagos del usuario autenticado (estudiante) con paginación
   */
  async findByUserId(userId: string, paginationDto?: any): Promise<any> {
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
      .where('payment.userId = :userId', { userId })
      .take(limit)
      .skip(offset);

    if (search.trim() !== '') {
      query.andWhere(
        '(payment.referenceCode ILIKE :search OR paymentMethod.name ILIKE :search OR payment.status::text ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    // Mapeo de campos de ordenamiento
    const sortMapping: Record<string, string> = {
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

  /**
   * Genera un ticket PDF para un pago
   */
  async generateTicket(paymentId: string): Promise<Buffer> {
    // Obtener el pago con todas sus relaciones
    const payment = await this.findOne(paymentId);

    // Obtener información del cliente
    let clientName = '';
    let clientEmail = '';
    let clientPhone = '';

    if (payment.user) {
      const user = payment.user;
      clientName = `${user.name || ''} ${user.lastName || ''} ${user.secondLastName || ''}`.trim();
      clientEmail = user.email || '';
      clientPhone = user.phone || '';
    } else if (payment.aspirant) {
      const aspirant = payment.aspirant;
      clientName = `${aspirant.firstName || ''} ${aspirant.lastNamePaternal || ''} ${aspirant.lastNameMaternal || ''}`.trim();
      clientEmail = aspirant.email || '';
      clientPhone = aspirant.phone || '';
    }

    // Información del negocio (puedes mover esto a variables de entorno)
    const businessName = process.env.BUSINESS_NAME || 'Pilates Studio';
    const businessSubtitle = process.env.BUSINESS_SUBTITLE || 'Sistema de gestión';

    // Convertir amountCents a número
    const amountCents = typeof payment.amountCents === 'string' 
      ? parseInt(payment.amountCents, 10) 
      : Number(payment.amountCents);
    const amount = amountCents / 100;

    // Formatear fechas
    const createdAt = format(new Date(payment.createdAt), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es });
    const verifiedAt = payment.verifiedAt 
      ? format(new Date(payment.verifiedAt), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })
      : null;
    const ticketGeneratedAt = format(new Date(), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es });

    // Mapear estado
    const statusMap: Record<PaymentStatus, string> = {
      PENDING: 'Pendiente',
      UNDER_REVIEW: 'En revisión',
      COMPLETED: 'Completado',
      REJECTED: 'Rechazado',
    };

    // Procesar datos de clases seleccionadas
    const classSelectionData = payment.classSelectionData;
    let classDaysInfo: Array<{ dayName: string; time: string; dates: string }> = [];
    
    if (classSelectionData?.selectedDayTimePairs && classSelectionData.month && classSelectionData.year) {
      const monthStart = startOfMonth(new Date(classSelectionData.year, classSelectionData.month - 1, 1));
      const monthEnd = endOfMonth(monthStart);
      const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

      const getDatesForDayOfWeek = (dayOfWeek: number): Date[] => {
        return allDays.filter(date => getDay(date) === dayOfWeek);
      };

      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      
      // Agrupar por día y hora
      const grouped = classSelectionData.selectedDayTimePairs.reduce((acc, pair) => {
        const key = `${pair.dayOfWeek}-${pair.time}`;
        if (!acc[key]) {
          const dates = getDatesForDayOfWeek(pair.dayOfWeek);
          acc[key] = {
            dayOfWeek: pair.dayOfWeek,
            time: pair.time,
            dates: dates
          };
        }
        return acc;
      }, {} as Record<string, { dayOfWeek: number; time: string; dates: Date[] }>);

      classDaysInfo = Object.values(grouped).map(group => {
        const days = group.dates.map(date => format(date, "d", { locale: es }));
        const month = format(group.dates[0], "'de' MMMM", { locale: es });
        let datesStr = '';
        
        if (days.length === 1) {
          datesStr = `${days[0]} ${month}`;
        } else if (days.length === 2) {
          datesStr = `${days[0]} y ${days[1]} ${month}`;
        } else {
          const lastDay = days[days.length - 1];
          const otherDays = days.slice(0, -1);
          datesStr = `${otherDays.join(", ")} y ${lastDay} ${month}`;
        }

        return {
          dayName: dayNames[group.dayOfWeek],
          time: group.time,
          dates: datesStr
        };
      });
    }

    // Crear documento PDF (80mm x 297mm - tamaño ticket estándar)
    // Convertir mm a puntos: 1mm = 2.83465 puntos
    const widthMM = 80;
    const heightMM = 297;
    const widthPT = widthMM * 2.83465;
    const heightPT = heightMM * 2.83465;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: [widthPT, heightPT],
        margins: { top: 20, bottom: 20, left: 15, right: 15 },
      });

      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => {
        chunks.push(chunk);
      });

      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      doc.on('error', (error) => {
        reject(error);
      });

      let yPosition = 15;

      // Encabezado
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a1a1a').text('TICKET DE PAGO', { align: 'center' });
      yPosition += 16;

      // Información del negocio
      doc.fontSize(8).font('Helvetica').fillColor('#333333').text(businessName, { align: 'center' });
      yPosition += 10;
      doc.fontSize(6).fillColor('#666666').text(businessSubtitle, { align: 'center' });
      yPosition += 15;

      // Línea divisoria mejorada
      doc.strokeColor('#cccccc').lineWidth(0.5);
      doc.moveTo(15, yPosition).lineTo(widthPT - 15, yPosition).stroke();
      doc.strokeColor('#000000').lineWidth(1);
      yPosition += 15;

      // Información del cliente
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a1a1a').text('CLIENTE', 15, yPosition);
      yPosition += 12;
      doc.fontSize(8).font('Helvetica').fillColor('#333333').text(clientName || 'N/A', 15, yPosition);
      yPosition += 11;
      doc.fontSize(7).fillColor('#555555').text(`Email: ${clientEmail || 'N/A'}`, 15, yPosition);
      yPosition += 10;
      doc.text(`Tel: ${clientPhone || 'N/A'}`, 15, yPosition);
      yPosition += 15;

      // Línea divisoria
      doc.strokeColor('#cccccc').lineWidth(0.5);
      doc.moveTo(15, yPosition).lineTo(widthPT - 15, yPosition).stroke();
      doc.strokeColor('#000000').lineWidth(1);
      yPosition += 15;

      // Información del pago
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a1a1a').text('INFORMACIÓN DEL PAGO', { align: 'center' });
      yPosition += 12;

      doc.fontSize(8).font('Helvetica').fillColor('#333333');
      doc.text(`Código: ${payment.referenceCode}`, 15, yPosition);
      yPosition += 11;
      doc.text(`Método: ${payment.paymentMethod?.name || 'N/A'}`, 15, yPosition);
      yPosition += 11;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a1a1a').text(`Monto: $${amount.toFixed(2)} ${payment.currency}`, 15, yPosition);
      yPosition += 12;
      doc.fontSize(7).font('Helvetica').fillColor('#555555');
      doc.text(`Estado: ${statusMap[payment.status] || payment.status}`, 15, yPosition);
      yPosition += 10;
      doc.text(`Fecha: ${createdAt}`, 15, yPosition);
      yPosition += 10;

      if (verifiedAt) {
        doc.text(`Verificado: ${verifiedAt}`, 15, yPosition);
        yPosition += 10;
      }

      // Mostrar días comprados si están disponibles
      if (classDaysInfo.length > 0) {
        yPosition += 8;
        doc.strokeColor('#cccccc').lineWidth(0.5);
        doc.moveTo(15, yPosition).lineTo(widthPT - 15, yPosition).stroke();
        doc.strokeColor('#000000').lineWidth(1);
        yPosition += 10;

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#1a1a1a').text('CLASES COMPRADAS', { align: 'center' });
        yPosition += 10;

        doc.fontSize(7).font('Helvetica').fillColor('#333333');
        classDaysInfo.forEach((info, index) => {
          // Verificar si hay espacio suficiente antes de agregar contenido
          if (yPosition > heightPT - 80) {
            doc.addPage();
            yPosition = 15;
          }
          doc.text(`${info.dayName} ${info.time}`, 15, yPosition);
          yPosition += 8;
          doc.fontSize(6).fillColor('#555555').text(`  ${info.dates}`, 15, yPosition);
          yPosition += 9;
          doc.fontSize(7).fillColor('#333333');
        });
      }

      yPosition += 8;

      // Línea divisoria
      doc.strokeColor('#cccccc').lineWidth(0.5);
      doc.moveTo(15, yPosition).lineTo(widthPT - 15, yPosition).stroke();
      doc.strokeColor('#000000').lineWidth(1);
      yPosition += 12;

      // Pie de página mejorado - verificar espacio antes de escribir
      if (yPosition < heightPT - 40) {
        doc.fontSize(7).font('Helvetica').fillColor('#333333').text('Gracias por su pago', { align: 'center' });
        yPosition += 9;
        doc.fontSize(6).fillColor('#666666').text('Conserve este ticket como comprobante', { align: 'center' });
        yPosition += 10;
      }
      
      // Ticket generado siempre al final si hay espacio
      if (yPosition < heightPT - 15) {
        doc.fontSize(5).fillColor('#999999').text(`Ticket generado: ${ticketGeneratedAt}`, { align: 'center' });
      }

      doc.end();
    });
  }
}
