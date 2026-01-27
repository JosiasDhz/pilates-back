import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateAspiranteDto } from './dto/create-aspirante.dto';
import { UpdateAspiranteDto } from './dto/update-aspirante.dto';
import { SaveAssessmentDto } from './dto/save-assessment.dto';
import { Aspirante } from './entities/aspirante.entity';
import { AspirantMedicalHistoryService } from 'src/aspirant-medical-history/aspirant-medical-history.service';
import { PaymentMethod } from 'src/payment-methods/entities/payment-method.entity';
import { AspirantStatus } from 'src/aspirant-status/entities/aspirant-status.entity';
import { Event } from 'src/calendar/entities/event.entity';
import { PaymentsService } from 'src/payments/payments.service';
import { ConfigurationsService } from 'src/configurations/configurations.service';
import { WhatsappNotificationService } from 'src/whatsapp/services/whatsapp-notification.service';
import { AspirantAccessTokenService } from 'src/aspirant-access-token/aspirant-access-token.service';
import { AspirantPhysicalRecord } from 'src/aspirant-physical-record/entities/aspirant-physical-record.entity';
import { AspirantAssessmentPhoto } from 'src/aspirant-assessment-photo/entities/aspirant-assessment-photo.entity';
import { User } from 'src/users/entities/user.entity';
import { Rol } from 'src/rols/entities/rol.entity';
import { File } from 'src/files/entities/file.entity';
import { Student } from 'src/students/entities/student.entity';
import { StudentStatusHistory, StudentStatus } from 'src/students/entities/student-status-history.entity';

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
    @InjectRepository(AspirantPhysicalRecord)
    private readonly physicalRecordRepository: Repository<AspirantPhysicalRecord>,
    @InjectRepository(AspirantAssessmentPhoto)
    private readonly assessmentPhotoRepository: Repository<AspirantAssessmentPhoto>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    private readonly dataSource: DataSource,
    private readonly medicalHistoryService: AspirantMedicalHistoryService,
    private readonly paymentsService: PaymentsService,
    private readonly configurationsService: ConfigurationsService,
    private readonly whatsappNotificationService: WhatsappNotificationService,
    private readonly aspirantAccessTokenService: AspirantAccessTokenService,
  ) { }

  async create(createAspiranteDto: CreateAspiranteDto, evidence?: Express.Multer.File) {
    const { medicalHistory, paymentMethodId, statusId, valoracionEventId, ...aspirantData } = createAspiranteDto;


    if (!createAspiranteDto.age || isNaN(createAspiranteDto.age) || createAspiranteDto.age <= 0) {
      throw new BadRequestException('La edad es requerida y debe ser un número válido mayor a 0');
    }


    const existingAspirant = await this.aspiranteRepository.findOne({
      where: { email: createAspiranteDto.email },
    });

    if (existingAspirant) {
      throw new BadRequestException(
        `Ya existe un aspirante con el correo ${createAspiranteDto.email}`,
      );
    }


    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId },
    });

    if (!paymentMethod) {
      throw new NotFoundException(
        `Método de pago con id ${paymentMethodId} no encontrado`,
      );
    }


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

      status = await this.aspirantStatusRepository.findOne({
        where: { code: 'PENDING' },
      });
      if (!status) {
        throw new NotFoundException(
          'Estado PENDING no encontrado. Por favor, crea los estados iniciales.',
        );
      }
    }


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

      if (valoracionEvent.type !== 'valoracion') {
        throw new BadRequestException(
          `El evento con id ${valoracionEventId} no es de tipo valoración`,
        );
      }
    }


    const aspirant = this.aspiranteRepository.create({
      ...aspirantData,
      paymentMethod,
      status,
      ...(valoracionEvent && { valoracionEvent }),
    });
    const savedAspirant = await this.aspiranteRepository.save(aspirant);


    if (medicalHistory) {
      const medicalHistoryEntity =
        await this.medicalHistoryService.createForAspirant(
          savedAspirant.id,
          medicalHistory,
        );
      savedAspirant.medicalHistory = medicalHistoryEntity;
    }


    console.log('PaymentMethod requiresEvidence:', paymentMethod.requiresEvidence);
    console.log('Evidence disponible:', evidence ? { name: evidence.originalname, size: evidence.size } : 'No hay evidencia');


    let accessTokenLink: string | undefined = undefined;
    let evidenceUploaded = false;

    if (paymentMethod.requiresEvidence) {

      const costoValoracion = await this.configurationsService.getByKey('costo_valoracion');

      // Normalizar el costo: siempre asumir que está en pesos
      // Si el valor es mayor a 1000, probablemente está guardado incorrectamente en centavos, dividir entre 100
      let costoEnPesos = costoValoracion ? Number(costoValoracion) : 0;
      if (costoEnPesos > 1000) {
        // Probablemente está guardado en centavos, convertir a pesos primero
        costoEnPesos = costoEnPesos / 100;
      }
      // Convertir pesos a centavos (multiplicar por 100)
      const amountCents = Math.round(costoEnPesos * 100);

      console.log('Costo valoración (pesos):', costoEnPesos, 'AmountCents:', amountCents);
      console.log('Evidence recibida:', evidence ? { name: evidence.originalname, size: evidence.size, mimetype: evidence.mimetype } : 'NO HAY EVIDENCIA');

      if (amountCents > 0) {

        const payment = await this.paymentsService.createManualPayment({
          amountCents,
          currency: 'MXN',
          aspirantId: savedAspirant.id,
          paymentMethodId: paymentMethod.id,
        });

        console.log('Payment creado:', payment.id);



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
            evidenceUploaded = true;
          } catch (error: any) {
            console.error('❌ Error al subir evidencia:', error);
            // Si el error es sobre paymentId null pero la evidencia se guardó, considerar como subida
            // El método uploadEvidence ahora maneja este caso y siempre retorna la evidencia si se guardó
            const errorMessage = error?.message || String(error);
            if (errorMessage.includes('paymentId') && errorMessage.includes('null')) {
              console.log('⚠️ Error de sincronización después de guardar evidencia, pero evidencia ya está guardada');
              evidenceUploaded = true; // La evidencia se guardó correctamente antes del error
            } else {
              console.error('Error completo:', JSON.stringify(error, null, 2));
              evidenceUploaded = false;
            }
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

      // Solo generar token de acceso si NO se subió evidencia
      // Si se subió evidencia, no necesita el link para subirla después
      if (!evidenceUploaded) {
        try {
          const accessToken = await this.aspirantAccessTokenService.generateToken({
            aspirantId: savedAspirant.id,
            expiresInDays: 30,
          });
          console.log('✅ Token de acceso generado:', accessToken.token);

          (savedAspirant as any).accessToken = accessToken.token;
          accessTokenLink = `${process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3000'}/aspirantes/subir-evidencia/${accessToken.token}`;
          (savedAspirant as any).accessTokenLink = accessTokenLink;
          console.log('✅ Link de acceso generado:', accessTokenLink);
        } catch (error) {
          console.error('❌ Error al generar token de acceso:', error);
        }
      } else {
        console.log('✅ Evidencia ya subida, no se genera token de acceso');
      }
    }


    if (valoracionEvent) {
      const aspirantWithRelations = await this.findOne(savedAspirant.id);

      await this.whatsappNotificationService.sendAspirantRegistrationConfirmation(
        aspirantWithRelations,
        valoracionEvent,
        accessTokenLink,
        evidenceUploaded,
      );
    }

    return this.findOne(savedAspirant.id);
  }

  async findAll(limit = 10, offset = 0, sort = 'createdAt', order: 'ASC' | 'DESC' = 'DESC', search = '', statusId?: string) {
    const query = this.aspiranteRepository
      .createQueryBuilder('aspirant')
      .leftJoinAndSelect('aspirant.medicalHistory', 'medicalHistory')
      .leftJoinAndSelect('aspirant.paymentMethod', 'paymentMethod')
      .leftJoinAndSelect('aspirant.status', 'status')
      .leftJoinAndSelect('aspirant.valoracionEvent', 'valoracionEvent')
      .take(limit)
      .skip(offset);

    // Si no se especifica un statusId, excluir los convertidos por defecto
    if (!statusId) {
      const convertedStatus = await this.aspirantStatusRepository.findOne({
        where: { code: 'CONVERTED' },
      });
      if (convertedStatus) {
        query.andWhere('status.id != :convertedId', { convertedId: convertedStatus.id });
      }
    } else {
      // Si se especifica un statusId, filtrar por ese status
      query.andWhere('status.id = :statusId', { statusId });
    }

    if (search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      query.andWhere(
        `(aspirant.firstName ILIKE :search OR aspirant.lastNamePaternal ILIKE :search OR aspirant.email ILIKE :search OR aspirant.phone ILIKE :search)`,
        { search: searchTerm },
      );
    }

    // Mapeo de campos de ordenamiento del frontend al backend
    const sortMapping: Record<string, string> = {
      nombre: 'firstName',
      firstName: 'firstName',
      email: 'email',
      fechaHora: 'createdAt',
      createdAt: 'createdAt',
      estatus: 'status',
      status: 'status',
    };
    
    const sortField = sortMapping[sort] || 'createdAt';
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
      relations: [
        'medicalHistory',
        'paymentMethod',
        'status',
        'valoracionEvent',
        'avatar',
        'physicalRecord',
        'assessmentPhotos',
        'assessmentPhotos.file',
      ],
    });

    if (!aspirant) {
      throw new NotFoundException(`Aspirante con id ${id} no encontrado`);
    }

    return aspirant;
  }

  async update(id: string, updateAspiranteDto: UpdateAspiranteDto) {
    const aspirant = await this.findOne(id);
    const { medicalHistory, paymentMethodId, statusId, valoracionEventId, ...aspirantData } = updateAspiranteDto;


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

        if (valoracionEvent.type !== 'valoracion') {
          throw new BadRequestException(
            `El evento con id ${valoracionEventId} no es de tipo valoración`,
          );
        }
        aspirant.valoracionEvent = valoracionEvent;
      }
    }


    Object.assign(aspirant, aspirantData);
    await this.aspiranteRepository.save(aspirant);


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
    
    // Buscar primero con el número tal como viene
    let aspirant = await this.aspiranteRepository.findOne({
      where: { phone: normalizedPhone },
    });
    
    // Si no se encuentra y el número tiene 10 dígitos, buscar también con prefijo 521
    if (!aspirant && normalizedPhone.length === 10 && /^\d+$/.test(normalizedPhone)) {
      const phoneWithPrefix = `521${normalizedPhone}`;
      aspirant = await this.aspiranteRepository.findOne({
        where: { phone: phoneWithPrefix },
      });
    }
    
    // Si no se encuentra y el número tiene 12 dígitos y empieza con 52, buscar también sin el prefijo
    if (!aspirant && normalizedPhone.length === 12 && normalizedPhone.startsWith('52')) {
      const phoneWithoutPrefix = normalizedPhone.substring(2);
      aspirant = await this.aspiranteRepository.findOne({
        where: { phone: phoneWithoutPrefix },
      });
    }
    
    // Si no se encuentra y el número tiene 13 dígitos y empieza con 521, buscar también sin el prefijo
    if (!aspirant && normalizedPhone.length === 13 && normalizedPhone.startsWith('521')) {
      const phoneWithoutPrefix = normalizedPhone.substring(3);
      aspirant = await this.aspiranteRepository.findOne({
        where: { phone: phoneWithoutPrefix },
      });
    }
    
    return {
      exists: !!aspirant,
    };
  }

  async saveAssessment(aspirantId: string, saveAssessmentDto: SaveAssessmentDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {

      const aspirant = await queryRunner.manager.findOne(Aspirante, {
        where: { id: aspirantId },
        relations: ['status'],
      });

      if (!aspirant) {
        throw new NotFoundException(`Aspirante con id ${aspirantId} no encontrado`);
      }

      let avatarFile: File | null = null;
      if (saveAssessmentDto.avatarFileId) {
        avatarFile = await queryRunner.manager.findOne(File, {
          where: { id: saveAssessmentDto.avatarFileId },
        });

        if (!avatarFile) {
          throw new NotFoundException(
            `Archivo de avatar con id ${saveAssessmentDto.avatarFileId} no encontrado`,
          );
        }
      }


      const assessmentPhotoFiles: File[] = [];
      if (saveAssessmentDto.assessmentPhotoFileIds && saveAssessmentDto.assessmentPhotoFileIds.length > 0) {
        for (const fileId of saveAssessmentDto.assessmentPhotoFileIds) {
          const file = await queryRunner.manager.findOne(File, {
            where: { id: fileId },
          });

          if (!file) {
            throw new NotFoundException(
              `Archivo de foto de valoración con id ${fileId} no encontrado`,
            );
          }

          assessmentPhotoFiles.push(file);
        }
      }


      const existingPhysicalRecord = await queryRunner.manager.findOne(AspirantPhysicalRecord, {
        where: { aspirantId: aspirant.id },
      });

      if (existingPhysicalRecord) {
        await queryRunner.manager.remove(AspirantPhysicalRecord, existingPhysicalRecord);
      }


      const physicalRecord = queryRunner.manager.create(AspirantPhysicalRecord, {
        aspirantId: aspirant.id,
        ...saveAssessmentDto.physicalRecord,
      });
      const savedPhysicalRecord = await queryRunner.manager.save(
        AspirantPhysicalRecord,
        physicalRecord,
      );


      const existingPhotos = await queryRunner.manager.find(AspirantAssessmentPhoto, {
        where: { aspirantId: aspirant.id },
      });

      if (existingPhotos.length > 0) {
        await queryRunner.manager.remove(AspirantAssessmentPhoto, existingPhotos);
      }


      const savedAssessmentPhotos: AspirantAssessmentPhoto[] = [];
      for (const file of assessmentPhotoFiles) {
        const assessmentPhoto = queryRunner.manager.create(AspirantAssessmentPhoto, {
          aspirantId: aspirant.id,
          fileId: file.id,
        });
        const savedPhoto = await queryRunner.manager.save(
          AspirantAssessmentPhoto,
          assessmentPhoto,
        );
        savedAssessmentPhotos.push(savedPhoto);
      }


      aspirant.avatarId = avatarFile ? avatarFile.id : null;
      aspirant.assessmentComments = saveAssessmentDto.assessmentComments || null;
      aspirant.assessmentNotes = saveAssessmentDto.assessmentNotes || null;
      await queryRunner.manager.save(Aspirante, aspirant);


      await queryRunner.commitTransaction();

      return {
        aspirant: await this.findOne(aspirantId),
        physicalRecord: savedPhysicalRecord,
        assessmentPhotos: savedAssessmentPhotos,
      };
    } catch (error) {

      await queryRunner.rollbackTransaction();
      throw error;
    } finally {

      await queryRunner.release();
    }
  }

  async promoteToUser(aspirantId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {

      const aspirant = await queryRunner.manager.findOne(Aspirante, {
        where: { id: aspirantId },
        relations: ['status', 'avatar', 'physicalRecord', 'assessmentPhotos'],
      });

      if (!aspirant) {
        throw new NotFoundException(`Aspirante con id ${aspirantId} no encontrado`);
      }

      if (aspirant.status.code === 'CONVERTED') {
        throw new BadRequestException('El aspirante ya ha sido convertido a usuario');
      }

      if (!aspirant.physicalRecord) {
        throw new BadRequestException(
          'El aspirante debe tener una valoración física guardada antes de convertirse a usuario',
        );
      }

      const existingUser = await queryRunner.manager.findOne(User, {
        where: { email: aspirant.email },
      });

      if (existingUser) {
        throw new BadRequestException(
          `Ya existe un usuario con el correo ${aspirant.email}`,
        );
      }

      let studentRol = await queryRunner.manager.findOne(Rol, {
        where: { name: 'Estudiante' },
      });

      if (!studentRol) {
        studentRol = queryRunner.manager.create(Rol, {
          name: 'Estudiante',
          description: 'Estudiante convertido desde aspirante',
          permissions: ['/dashboard/my-profile', '/dashboard/my-classes'],
          status: true,
        });
        studentRol = await queryRunner.manager.save(Rol, studentRol);
      }

      const convertedStatus = await queryRunner.manager.findOne(AspirantStatus, {
        where: { code: 'CONVERTED' },
      });

      if (!convertedStatus) {
        throw new NotFoundException(
          'Estado CONVERTED no encontrado. Por favor, crea los estados iniciales.',
        );
      }

      // Cargar el archivo del avatar si existe
      let avatarFile: File | null = null;
      if (aspirant.avatarId) {
        avatarFile = await queryRunner.manager.findOne(File, {
          where: { id: aspirant.avatarId },
        });
      }

      aspirant.status = convertedStatus;
      await queryRunner.manager.save(Aspirante, aspirant);

      const newUser = queryRunner.manager.create(User, {
        name: aspirant.firstName,
        lastName: aspirant.lastNamePaternal,
        secondLastName: aspirant.lastNameMaternal || null,
        email: aspirant.email,
        phone: aspirant.phone,
        rol: studentRol,
        avatar: avatarFile,
        status: true,
      });
      const savedUser = await queryRunner.manager.save(User, newUser);

      // Crear el registro Student vinculado con User y Aspirante
      const enrollmentDate = new Date();
      const newStudent = queryRunner.manager.create(Student, {
        userId: savedUser.id,
        aspirantId: aspirant.id,
        enrollmentDate,
        isActive: true,
      });
      const savedStudent = await queryRunner.manager.save(Student, newStudent);

      // Crear el primer registro en StudentStatusHistory
      const initialStatusHistory = queryRunner.manager.create(StudentStatusHistory, {
        studentId: savedStudent.id,
        status: StudentStatus.ACTIVE,
        startDate: enrollmentDate,
        endDate: null,
        reason: 'Ingreso inicial desde valoración',
      });
      await queryRunner.manager.save(StudentStatusHistory, initialStatusHistory);

      await queryRunner.commitTransaction();

      return {
        user: savedUser,
        student: savedStudent,
        aspirant: await this.findOne(aspirantId),
      };
    } catch (error) {

      await queryRunner.rollbackTransaction();
      throw error;
    } finally {

      await queryRunner.release();
    }
  }
}
