import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAspiranteDto } from './dto/create-aspirante.dto';
import { UpdateAspiranteDto } from './dto/update-aspirante.dto';
import { Aspirante } from './entities/aspirante.entity';
import { AspirantMedicalHistoryService } from 'src/aspirant-medical-history/aspirant-medical-history.service';
import { PaymentMethod } from 'src/payment-methods/entities/payment-method.entity';
import { AspirantStatus } from 'src/aspirant-status/entities/aspirant-status.entity';
import { Event } from 'src/calendar/entities/event.entity';
import { PaymentsService } from 'src/payments/payments.service';
import { ConfigurationsService } from 'src/configurations/configurations.service';
import { WhatsappNotificationService } from 'src/whatsapp/services/whatsapp-notification.service';

@Injectable()
export class AspirantesService {
  constructor(
    @InjectRepository(Aspirante)
    private readonly aspiranteRepository: Repository<Aspirante>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(AspirantStatus)
    private readonly aspirantStatusRepository: Repository<AspirantStatus>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly medicalHistoryService: AspirantMedicalHistoryService,
    private readonly paymentsService: PaymentsService,
    private readonly configurationsService: ConfigurationsService,
    private readonly whatsappNotificationService: WhatsappNotificationService,
  ) {}

  async create(createAspiranteDto: CreateAspiranteDto, evidence?: Express.Multer.File) {
    const { medicalHistory, paymentMethodId, statusId, valoracionEventId, ...aspirantData } = createAspiranteDto;

    // Validar que la edad sea un número válido
    if (!createAspiranteDto.age || isNaN(createAspiranteDto.age) || createAspiranteDto.age <= 0) {
      throw new BadRequestException('La edad es requerida y debe ser un número válido mayor a 0');
    }

    // Verificar si ya existe un aspirante con ese email
    const existingAspirant = await this.aspiranteRepository.findOne({
      where: { email: createAspiranteDto.email },
    });

    if (existingAspirant) {
      throw new BadRequestException(
        `Ya existe un aspirante con el correo ${createAspiranteDto.email}`,
      );
    }

    // Obtener PaymentMethod
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId },
    });

    if (!paymentMethod) {
      throw new NotFoundException(
        `Método de pago con id ${paymentMethodId} no encontrado`,
      );
    }

    // Obtener AspirantStatus (default: PENDING si no se proporciona)
    let status: AspirantStatus;
    if (statusId) {
      status = await this.aspirantStatusRepository.findOne({
        where: { id: statusId },
      });
      if (!status) {
        throw new NotFoundException(
          `Estado con id ${statusId} no encontrado`,
        );
      }
    } else {
      // Buscar el estado PENDING por defecto
      status = await this.aspirantStatusRepository.findOne({
        where: { code: 'PENDING' },
      });
      if (!status) {
        throw new NotFoundException(
          'Estado PENDING no encontrado. Por favor, crea los estados iniciales.',
        );
      }
    }

    // Obtener Event de valoración si se proporciona
    let valoracionEvent: Event | null = null;
    if (valoracionEventId) {
      valoracionEvent = await this.eventRepository.findOne({
        where: { id: valoracionEventId },
      });
      if (!valoracionEvent) {
        throw new NotFoundException(
          `Evento de valoración con id ${valoracionEventId} no encontrado`,
        );
      }
      // Verificar que el evento sea de tipo valoración
      if (valoracionEvent.type !== 'valoracion') {
        throw new BadRequestException(
          `El evento con id ${valoracionEventId} no es de tipo valoración`,
        );
      }
    }

    // Crear el aspirante
    const aspirant = this.aspiranteRepository.create({
      ...aspirantData,
      paymentMethod,
      status,
      ...(valoracionEvent && { valoracionEvent }),
    });
    const savedAspirant = await this.aspiranteRepository.save(aspirant);

    // Crear el historial médico si se proporciona
    if (medicalHistory) {
      const medicalHistoryEntity =
        await this.medicalHistoryService.createForAspirant(
          savedAspirant.id,
          medicalHistory,
        );
      savedAspirant.medicalHistory = medicalHistoryEntity;
    }

    // Si el método de pago requiere evidencia, crear un Payment
    console.log('PaymentMethod requiresEvidence:', paymentMethod.requiresEvidence);
    console.log('Evidence disponible:', evidence ? { name: evidence.originalname, size: evidence.size } : 'No hay evidencia');

    if (paymentMethod.requiresEvidence) {
      // Obtener el costo de valoración desde configuraciones
      const costoValoracion = await this.configurationsService.getByKey('costo_valoracion');
      // El costo viene en pesos, guardar directamente en pesos (sin convertir a centavos)
      const amountCents = costoValoracion ? Math.round(Number(costoValoracion)) : 0;

      console.log('Costo valoración (pesos):', costoValoracion, 'AmountCents:', amountCents);
      console.log('Evidence recibida:', evidence ? { name: evidence.originalname, size: evidence.size, mimetype: evidence.mimetype } : 'NO HAY EVIDENCIA');

      if (amountCents > 0) {
        // Crear el Payment
        const payment = await this.paymentsService.createManualPayment({
          amountCents,
          currency: 'MXN',
          aspirantId: savedAspirant.id,
          paymentMethodId: paymentMethod.id,
        });

        console.log('Payment creado:', payment.id);

        // Si se proporcionó evidencia, subirla
        // Verificar que la evidencia tenga los campos necesarios
        const hasValidEvidence = evidence &&
          (evidence.buffer || evidence.path) &&
          evidence.originalname;

        console.log('Verificación de evidencia:', {
          evidenceExists: !!evidence,
          hasBuffer: !!(evidence?.buffer),
          hasPath: !!(evidence?.path),
          hasOriginalname: !!(evidence?.originalname),
          isValid: hasValidEvidence,
        });

        if (hasValidEvidence) {
          console.log('Subiendo evidencia para payment:', payment.id);
          try {
            const uploadedEvidence = await this.paymentsService.uploadEvidence(payment.id, evidence);
            console.log('✅ Evidencia subida exitosamente:', uploadedEvidence.id);
          } catch (error) {
            console.error('❌ Error al subir evidencia:', error);
            // No lanzar el error para que el aspirante se cree de todas formas
            // Solo loguear el error
            console.error('Error completo:', JSON.stringify(error, null, 2));
          }
        } else {
          console.log('⚠️ NO SE PROPORCIONÓ EVIDENCIA VÁLIDA');
          console.log('Evidence object:', evidence ? {
            keys: Object.keys(evidence),
            originalname: evidence.originalname,
            mimetype: evidence.mimetype,
            size: evidence.size,
            fieldname: evidence.fieldname,
            hasBuffer: !!evidence.buffer,
            hasPath: !!evidence.path,
          } : 'evidence es null/undefined');
        }
      } else {
        console.log('AmountCents es 0, no se crea Payment');
      }
    }

    // Enviar notificación de WhatsApp al aspirante (no bloquea la creación)
    if (valoracionEvent) {
      const aspirantWithRelations = await this.findOne(savedAspirant.id);
      await this.whatsappNotificationService.sendAspirantRegistrationConfirmation(
        aspirantWithRelations,
        valoracionEvent,
      );
    }

    return this.findOne(savedAspirant.id);
  }

  async findAll(limit = 10, offset = 0, sort = 'createdAt', order: 'ASC' | 'DESC' = 'DESC', search = '') {
    const query = this.aspiranteRepository
      .createQueryBuilder('aspirant')
      .leftJoinAndSelect('aspirant.medicalHistory', 'medicalHistory')
      .leftJoinAndSelect('aspirant.paymentMethod', 'paymentMethod')
      .leftJoinAndSelect('aspirant.status', 'status')
      .leftJoinAndSelect('aspirant.valoracionEvent', 'valoracionEvent')
      .take(limit)
      .skip(offset);

    if (search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      query.andWhere(
        `(aspirant.firstName ILIKE :search OR aspirant.lastNamePaternal ILIKE :search OR aspirant.email ILIKE :search OR aspirant.phone ILIKE :search)`,
        { search: searchTerm },
      );
    }

    const validSortFields = ['createdAt', 'firstName', 'email', 'status'];
    const sortField = validSortFields.includes(sort) ? sort : 'createdAt';
    query.orderBy(`aspirant.${sortField}`, order);

    const [records, total] = await query.getManyAndCount();

    return {
      records,
      total,
    };
  }

  async findOne(id: string) {
    const aspirant = await this.aspiranteRepository.findOne({
      where: { id },
      relations: ['medicalHistory', 'paymentMethod', 'status', 'valoracionEvent'],
    });

    if (!aspirant) {
      throw new NotFoundException(`Aspirante con id ${id} no encontrado`);
    }

    return aspirant;
  }

  async update(id: string, updateAspiranteDto: UpdateAspiranteDto) {
    const aspirant = await this.findOne(id);
    const { medicalHistory, paymentMethodId, statusId, valoracionEventId, ...aspirantData } = updateAspiranteDto;

    // Verificar email único si se está actualizando
    if (aspirantData.email && aspirantData.email !== aspirant.email) {
      const existingAspirant = await this.aspiranteRepository.findOne({
        where: { email: aspirantData.email },
      });

      if (existingAspirant && existingAspirant.id !== id) {
        throw new BadRequestException(
          `Ya existe un aspirante con el correo ${aspirantData.email}`,
        );
      }
    }

    // Actualizar PaymentMethod si se proporciona
    if (paymentMethodId) {
      const paymentMethod = await this.paymentMethodRepository.findOne({
        where: { id: paymentMethodId },
      });
      if (!paymentMethod) {
        throw new NotFoundException(
          `Método de pago con id ${paymentMethodId} no encontrado`,
        );
      }
      aspirant.paymentMethod = paymentMethod;
    }

    // Actualizar Status si se proporciona
    if (statusId) {
      const status = await this.aspirantStatusRepository.findOne({
        where: { id: statusId },
      });
      if (!status) {
        throw new NotFoundException(
          `Estado con id ${statusId} no encontrado`,
        );
      }
      aspirant.status = status;
    }

    // Actualizar Event de valoración si se proporciona
    if (valoracionEventId !== undefined) {
      if (valoracionEventId === null) {
        aspirant.valoracionEvent = null;
      } else {
        const valoracionEvent = await this.eventRepository.findOne({
          where: { id: valoracionEventId },
        });
        if (!valoracionEvent) {
          throw new NotFoundException(
            `Evento de valoración con id ${valoracionEventId} no encontrado`,
          );
        }
        // Verificar que el evento sea de tipo valoración
        if (valoracionEvent.type !== 'valoracion') {
          throw new BadRequestException(
            `El evento con id ${valoracionEventId} no es de tipo valoración`,
          );
        }
        aspirant.valoracionEvent = valoracionEvent;
      }
    }

    // Actualizar datos del aspirante
    Object.assign(aspirant, aspirantData);
    await this.aspiranteRepository.save(aspirant);

    // Actualizar historial médico si se proporciona
    if (medicalHistory) {
      if (aspirant.medicalHistory) {
        await this.medicalHistoryService.update(
          aspirant.medicalHistory.id,
          medicalHistory,
        );
      } else {
        const medicalHistoryEntity =
          await this.medicalHistoryService.createForAspirant(
            aspirant.id,
            medicalHistory,
          );
        aspirant.medicalHistory = medicalHistoryEntity;
      }
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    const aspirant = await this.findOne(id);
    await this.aspiranteRepository.remove(aspirant);
    return { message: 'Aspirante eliminado correctamente' };
  }

  async getStats() {
    const total = await this.aspiranteRepository.count();

    // Obtener estados por código
    const pendingStatus = await this.aspirantStatusRepository.findOne({
      where: { code: 'PENDING' },
    });
    const convertedStatus = await this.aspirantStatusRepository.findOne({
      where: { code: 'CONVERTED' },
    });
    const rejectedStatus = await this.aspirantStatusRepository.findOne({
      where: { code: 'REJECTED' },
    });

    const pending = pendingStatus
      ? await this.aspiranteRepository.count({
        relations: ['status'],
        where: { status: { id: pendingStatus.id } },
      })
      : 0;
    const converted = convertedStatus
      ? await this.aspiranteRepository.count({
        relations: ['status'],
        where: { status: { id: convertedStatus.id } },
      })
      : 0;
    const rejected = rejectedStatus
      ? await this.aspiranteRepository.count({
        relations: ['status'],
        where: { status: { id: rejectedStatus.id } },
      })
      : 0;

    return {
      total,
      pending,
      converted,
      rejected,
    };
  }

  async checkEmailExists(email: string): Promise<{ exists: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();
    const aspirant = await this.aspiranteRepository.findOne({
      where: { email: normalizedEmail },
    });
    return {
      exists: !!aspirant,
    };
  }

  async checkPhoneExists(phone: string): Promise<{ exists: boolean }> {
    const normalizedPhone = phone.trim();
    const aspirant = await this.aspiranteRepository.findOne({
      where: { phone: normalizedPhone },
    });
    return {
      exists: !!aspirant,
    };
  }
}
