import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, Not, DataSource } from 'typeorm';
import { isUUID } from 'class-validator';
import * as bcrypt from 'bcrypt';

import { CreateUserDto } from './dto/create-user.dto';
import { RegisterStudentDto } from './dto/register-student.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { User } from './entities/user.entity';
import { Rol } from 'src/rols/entities/rol.entity';
import { File } from 'src/files/entities/file.entity';
import { v4 as uuid } from 'uuid';
import { FilesService } from 'src/files/files.service';
import { PaginationUserDto } from './dto/paginate-user.dto';
import { Aspirante } from 'src/aspirantes/entities/aspirante.entity';
import { AspirantStatus } from 'src/aspirant-status/entities/aspirant-status.entity';
import { AspirantPhysicalRecord } from 'src/aspirant-physical-record/entities/aspirant-physical-record.entity';
import { AspirantMedicalHistory } from 'src/aspirant-medical-history/entities/aspirant-medical-history.entity';
import { AspirantAssessmentPhoto } from 'src/aspirant-assessment-photo/entities/aspirant-assessment-photo.entity';
import { Student } from 'src/students/entities/student.entity';
import { StudentStatusHistory, StudentStatus } from 'src/students/entities/student-status-history.entity';
import { PaymentMethod } from 'src/payment-methods/entities/payment-method.entity';
import { WhatsappNotificationService } from 'src/whatsapp/services/whatsapp-notification.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,

    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,

    @InjectRepository(Aspirante)
    private readonly aspiranteRepository: Repository<Aspirante>,

    @InjectRepository(AspirantStatus)
    private readonly aspirantStatusRepository: Repository<AspirantStatus>,

    @InjectRepository(AspirantPhysicalRecord)
    private readonly physicalRecordRepository: Repository<AspirantPhysicalRecord>,

    @InjectRepository(AspirantMedicalHistory)
    private readonly medicalHistoryRepository: Repository<AspirantMedicalHistory>,

    @InjectRepository(AspirantAssessmentPhoto)
    private readonly assessmentPhotoRepository: Repository<AspirantAssessmentPhoto>,

    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,

    @InjectRepository(StudentStatusHistory)
    private readonly statusHistoryRepository: Repository<StudentStatusHistory>,

    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,

    private readonly fileService: FilesService,
    private readonly dataSource: DataSource,
    private readonly whatsappNotificationService: WhatsappNotificationService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const {
      rolId,
      avatar,
      isStudent,
      physicalRecord,
      medicalHistory,
      enrollmentDate,
      assessmentComments,
      assessmentNotes,
      ...data
    } = createUserDto;

    // Si es estudiante, usar transacción para crear Aspirante -> User -> Student
    if (isStudent) {
      return this.createStudentUser(createUserDto);
    }

    // Creación normal de usuario (sin estudiante)
    if (!data.password) data.password = uuid();
    // Guardar la contraseña en texto plano temporalmente para enviarla por WhatsApp
    const plainPassword = data.password;

    const userEmail = await this.findOneByEmail(data.email);

    if (userEmail)
      throw new BadRequestException({
        message: `Ya existe un usuario con ese correo`,
      });

    const rol = await this.rolRepository.findOneBy({ id: rolId });

    if (!rol) throw new NotFoundException(`Rol con id ${rolId} no encontrado`);

    let file = null;
    if (avatar) {
      file = await this.fileRepository.findOneBy({ id: avatar });
      if (!file)
        throw new NotFoundException(`Archivo con id ${avatar} no encontrado`);
    }

    data.password = bcrypt.hashSync(data.password, 10);
    const user = this.userRepository.create({ ...data, rol, ...(file && { avatar: file }) });
    await this.userRepository.save(user);

    delete user.password;

    // Enviar credenciales por WhatsApp si hay teléfono
    if (data.phone) {
      const fullName = `${data.name} ${data.lastName}${data.secondLastName ? ' ' + data.secondLastName : ''}`.trim();
      this.whatsappNotificationService.sendSystemCredentials(
        fullName,
        data.email,
        plainPassword,
        data.phone,
        'usuario',
      ).catch((error) => {
        // Loggear el error pero no fallar la creación del usuario
        console.error('Error al enviar credenciales por WhatsApp:', error);
      });
    }

    return user;
  }

  async registerPublicStudent(registerStudentDto: RegisterStudentDto) {
    // Validar que el registro público solo permita crear estudiantes
    if (!registerStudentDto.isStudent) {
      throw new BadRequestException('Solo se pueden registrar estudiantes desde este endpoint');
    }

    // Obtener el rol de Estudiante
    const studentRol = await this.rolRepository.findOne({
      where: { name: 'Estudiante' },
    });

    if (!studentRol) {
      throw new NotFoundException('Rol de Estudiante no encontrado');
    }

    // Validar que se proporcione una contraseña
    if (!registerStudentDto.password) {
      throw new BadRequestException('La contraseña es requerida');
    }

    // Crear un nuevo DTO con los valores correctos para CreateUserDto
    const createUserDto: CreateUserDto = {
      name: registerStudentDto.name,
      lastName: registerStudentDto.lastName,
      secondLastName: registerStudentDto.secondLastName, // Puede ser undefined, que es válido para CreateUserDto
      email: registerStudentDto.email,
      password: registerStudentDto.password,
      phone: registerStudentDto.phone,
      status: true, // Los estudiantes registrados públicamente siempre están activos
      avatar: registerStudentDto.avatar,
      rolId: studentRol.id, // Asignar el rolId del estudiante
      position: undefined, // Campo opcional, no requerido para estudiantes
      isStudent: true,
      physicalRecord: registerStudentDto.physicalRecord,
      medicalHistory: registerStudentDto.medicalHistory,
      enrollmentDate: registerStudentDto.enrollmentDate,
      assessmentComments: registerStudentDto.assessmentComments,
      assessmentNotes: registerStudentDto.assessmentNotes,
      language: registerStudentDto.language,
      occupation: registerStudentDto.occupation,
      assessmentPhotoFileIds: registerStudentDto.assessmentPhotoFileIds,
    } as CreateUserDto; // Usar type assertion para evitar problemas de tipos opcionales

    return this.createStudentUser(createUserDto);
  }

  private async createStudentUser(createUserDto: CreateUserDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const {
        rolId,
        avatar,
        physicalRecord,
        medicalHistory,
        enrollmentDate,
        assessmentComments,
        assessmentNotes,
        assessmentPhotoFileIds,
        name,
        lastName,
        secondLastName,
        email,
        phone,
        password,
        status = true,
        language,
        occupation,
      } = createUserDto;

      // Verificar que no exista usuario con ese email
      const existingUser = await queryRunner.manager.findOne(User, {
        where: { email },
      });

      if (existingUser) {
        throw new BadRequestException(`Ya existe un usuario con el correo ${email}`);
      }

      // Verificar que no exista aspirante con ese email
      const existingAspirant = await queryRunner.manager.findOne(Aspirante, {
        where: { email },
      });

      if (existingAspirant) {
        throw new BadRequestException(`Ya existe un aspirante con el correo ${email}`);
      }

      // Obtener o crear rol de Estudiante
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

      // Si se especificó un rolId diferente, usar ese en lugar del rol Estudiante
      let finalRol = studentRol;
      if (rolId && rolId !== studentRol.id) {
        const customRol = await queryRunner.manager.findOne(Rol, {
          where: { id: rolId },
        });
        if (customRol) {
          finalRol = customRol;
        }
      }

      // Obtener estado CONVERTED
      const convertedStatus = await queryRunner.manager.findOne(AspirantStatus, {
        where: { code: 'CONVERTED' },
      });

      if (!convertedStatus) {
        throw new NotFoundException(
          'Estado CONVERTED no encontrado. Por favor, crea los estados iniciales.',
        );
      }

      // Obtener método de pago por defecto (necesario para crear Aspirante)
      const paymentMethod = await queryRunner.manager.findOne(PaymentMethod, {
        where: { status: true },
      });

      if (!paymentMethod) {
        throw new NotFoundException(
          'No se encontró un método de pago activo. Por favor, crea uno primero.',
        );
      }

      // Obtener archivo de avatar si existe
      let avatarFile: File | null = null;
      if (avatar) {
        avatarFile = await queryRunner.manager.findOne(File, {
          where: { id: avatar },
        });

        if (!avatarFile) {
          throw new NotFoundException(`Archivo con id ${avatar} no encontrado`);
        }
      }

      // 1. Crear Aspirante con estado CONVERTED
      // NOTA: Los campos age, language, occupation y gender son opcionales
      // IMPORTANTE: Ejecutar la migración SQL en migrations/make-aspirant-fields-nullable.sql
      // para hacer estos campos nullable en la base de datos
      // Temporalmente usamos valores por defecto hasta que se ejecute la migración
      const newAspirant = queryRunner.manager.create(Aspirante, {
        firstName: name,
        lastNamePaternal: lastName,
        lastNameMaternal: secondLastName || null,
        email,
        phone,
        // Valores temporales hasta ejecutar la migración para hacer nullable estos campos
        age: null as any, // Se convertirá a NULL después de la migración
        language: language || (null as any), // Se convertirá a NULL después de la migración
        occupation: occupation || (null as any), // Se convertirá a NULL después de la migración
        gender: null as any, // Se convertirá a NULL después de la migración
        paymentMethod,
        status: convertedStatus,
        avatarId: avatarFile ? avatarFile.id : null,
        assessmentComments: assessmentComments || null,
        assessmentNotes: assessmentNotes || null,
      });
      const savedAspirant = await queryRunner.manager.save(Aspirante, newAspirant);

      // 2. Crear historial médico (siempre se crea para guardar el vínculo, aunque esté vacío)
        const medicalHistoryRecord = queryRunner.manager.create(AspirantMedicalHistory, {
          aspirantId: savedAspirant.id,
        hasInjury: medicalHistory?.hasInjury || false,
        injuryLocation: medicalHistory?.injuryLocation || null,
        injuryTime: medicalHistory?.injuryTime || null,
        hasPhysicalAilment: medicalHistory?.hasPhysicalAilment || false,
        ailmentDetail: medicalHistory?.ailmentDetail || null,
        surgeryComments: medicalHistory?.surgeryComments || null,
        additionalInfo: medicalHistory?.additionalInfo || null,
        });
        await queryRunner.manager.save(AspirantMedicalHistory, medicalHistoryRecord);

      // 3. Crear registro físico (siempre se crea para guardar el vínculo, aunque esté vacío)
      const physicalRecordEntity = queryRunner.manager.create(AspirantPhysicalRecord, {
        aspirantId: savedAspirant.id,
        weight: physicalRecord?.weight || null,
        height: physicalRecord?.height || null,
        flexibility: physicalRecord?.flexibility || null,
        strength: physicalRecord?.strength || null,
        balance: physicalRecord?.balance || null,
        posture: physicalRecord?.posture || null,
        rangeOfMotion: physicalRecord?.rangeOfMotion || null,
        observations: physicalRecord?.observations || null,
      });
      await queryRunner.manager.save(AspirantPhysicalRecord, physicalRecordEntity);

      // 3.5. Crear fotos de valoración si se proporcionan
      if (assessmentPhotoFileIds && assessmentPhotoFileIds.length > 0) {
        for (const fileId of assessmentPhotoFileIds) {
          // Verificar que el archivo existe
          const file = await queryRunner.manager.findOne(File, {
            where: { id: fileId },
          });

          if (file) {
            const assessmentPhoto = queryRunner.manager.create(AspirantAssessmentPhoto, {
              aspirantId: savedAspirant.id,
              fileId: fileId,
            });
            await queryRunner.manager.save(AspirantAssessmentPhoto, assessmentPhoto);
          }
        }
      }

      // 4. Crear User
      const userPassword = password || uuid();
      const hashedPassword = bcrypt.hashSync(userPassword, 10);
      // Guardar la contraseña en texto plano temporalmente para enviarla por WhatsApp
      const plainPassword = userPassword;

      const newUser = queryRunner.manager.create(User, {
        name,
        lastName,
        secondLastName: secondLastName || null,
        email,
        phone,
        password: hashedPassword,
        rol: finalRol,
        avatar: avatarFile,
        status,
      });
      const savedUser = await queryRunner.manager.save(User, newUser);

      // 5. Crear Student vinculado con User y Aspirante
      const finalEnrollmentDate = enrollmentDate || new Date();
      const newStudent = queryRunner.manager.create(Student, {
        userId: savedUser.id,
        aspirantId: savedAspirant.id,
        enrollmentDate: finalEnrollmentDate,
        isActive: true,
      });
      const savedStudent = await queryRunner.manager.save(Student, newStudent);

      // 6. Crear primer registro en StudentStatusHistory
      const initialStatusHistory = queryRunner.manager.create(StudentStatusHistory, {
        studentId: savedStudent.id,
        status: StudentStatus.ACTIVE,
        startDate: finalEnrollmentDate,
        endDate: null,
        reason: 'Ingreso inicial desde creación de usuario',
      });
      await queryRunner.manager.save(StudentStatusHistory, initialStatusHistory);

      await queryRunner.commitTransaction();

      // Limpiar password antes de retornar
      delete (savedUser as any).password;

      // Enviar credenciales por WhatsApp si hay teléfono
      if (phone) {
        const fullName = `${name} ${lastName}${secondLastName ? ' ' + secondLastName : ''}`.trim();
        this.whatsappNotificationService.sendSystemCredentials(
          fullName,
          email,
          plainPassword,
          phone,
          'estudiante',
        ).catch((error) => {
          // Loggear el error pero no fallar la creación del estudiante
          console.error('Error al enviar credenciales por WhatsApp:', error);
        });
      }

      return {
        user: savedUser,
        student: savedStudent,
        aspirant: savedAspirant,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(paginationDto: PaginationUserDto) {
    const {
      limit = 10,
      offset = 0,
      sort = 'Creado',
      order = 'asc',
      search = '',
      rol = 'Todos',
      sucursal = 'Todas',
      estatus = 'Todos',
    } = paginationDto;

    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.avatar', 'avatar')
      .leftJoinAndSelect('user.rol', 'rol')
      .take(limit)
      .skip(offset);

    if (estatus !== 'Todos') {
      if (estatus === 'Activos') {
        query.andWhere('user.status = :status', { status: true });
      }
      if (estatus === 'Inactivos') {
        query.andWhere('user.status = :status', { status: false });
      }
    }

    if (search.trim() !== '') {
      const searchTerms = search
        .trim()
        .split(/\s+/) // Divide el input en palabras
        .map((term) => `%${term}%`);

      searchTerms.forEach((term, index) => {
        query.andWhere(
          `(user.name ILIKE :term${index} OR user.lastName ILIKE :term${index} OR user.secondLastName ILIKE :term${index} OR user.email ILIKE :term${index})`,
          { [`term${index}`]: term },
        );
      });
    }

    if (rol !== 'Todos') {
      console.log('ENRTO AL ROL');
      const roles = rol.split(',');
      query.andWhere('UPPER(rol.name) IN (:...roles)', {
        roles: roles.map((role) => role.toUpperCase()),
      });
    }

    const orderType = order === 'asc' ? 'ASC' : 'DESC';
    if (sort === 'Creado') {
      query.orderBy('user.createdAt', orderType);
    }

    if (sort === 'Nombre(s)') {
      query.orderBy('user.name', orderType);
    }

    if (sort === 'Email') {
      query.orderBy('user.email', orderType);
    }

    if (sort === 'Permisos') {
      query.orderBy('rol.name', orderType);
    }

    if (sort === 'Status') {
      query.orderBy('user.status', orderType);
    }

    const [data, total] = await query.getManyAndCount();

    // const records = await Promise.all(
    //   data.map(async (user) => {
    //     const image = await this.fileService.findOne(user.avatar.id);

    //     user.avatar = image;

    //     return { ...user, avatar: image };
    //   }),
    // );

    return {
      records: data,
      total: total,
    };
  }

  async findOne(id: string, user: User) {
    if (!isUUID(id))
      throw new BadRequestException('Proporciona un UUID valido');

    const userFound = await this.userRepository.findOne({
      where: { id },
      relations: {
        avatar: true,
        rol: true,
      },
    });

    if (!userFound) throw new NotFoundException('Usuario no encontrado');

    // Solo obtener la imagen si el avatar existe
    if (userFound.avatar?.id) {
      try {
        const image = await this.fileService.findOne(userFound.avatar.id);
        userFound.avatar = image;
      } catch (error) {
        // Si hay error al obtener la imagen, mantener el avatar como null
        userFound.avatar = null;
      }
    }

    // Buscar si el usuario tiene un registro de estudiante asociado
    const student = await this.studentRepository.findOne({
      where: { userId: id },
      relations: {
        aspirant: {
          physicalRecord: true,
          medicalHistory: true,
          assessmentPhotos: {
            file: true,
          },
        },
      },
    });

    // Agregar información del estudiante al objeto de usuario si existe
    if (student) {
      (userFound as any).student = {
        id: student.id,
        enrollmentDate: student.enrollmentDate,
        isActive: student.isActive,
        aspirant: {
          id: student.aspirant.id,
          firstName: student.aspirant.firstName,
          lastNamePaternal: student.aspirant.lastNamePaternal,
          lastNameMaternal: student.aspirant.lastNameMaternal,
          age: student.aspirant.age,
          language: student.aspirant.language,
          occupation: student.aspirant.occupation,
          gender: student.aspirant.gender,
          assessmentComments: student.aspirant.assessmentComments,
          assessmentNotes: student.aspirant.assessmentNotes,
          physicalRecord: student.aspirant.physicalRecord,
          medicalHistory: student.aspirant.medicalHistory,
          assessmentPhotos: student.aspirant.assessmentPhotos,
        },
      };
    }

    if (user.rol.name === 'Administrador') return userFound;

    if (userFound.id === user.id) return userFound;

    throw new ForbiddenException(
      `Usuario: ${user.name} no tiene los permisos necesarios`,
    );
  }

  async update(id: string, updateUserDto: UpdateUserDto, user: User) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
    let userFound: any = await this.findOne(id, user);
      const { 
        avatar, 
        rolId, 
        isStudent,
        physicalRecord,
        medicalHistory,
        enrollmentDate,
        assessmentComments,
        assessmentNotes,
        language,
        occupation,
        assessmentPhotoFileIds,
        ...data 
      } = updateUserDto;
      
    userFound = { ...userFound, ...data };

    if (updateUserDto.password) {
      userFound.password = bcrypt.hashSync(updateUserDto.password, 10);
    }

      let newRol: Rol | null = null;
    if (rolId) {
      if (!isUUID(updateUserDto.rolId))
        throw new BadRequestException('Proporciona un UUID valido');

        const rol = await queryRunner.manager.findOne(Rol, {
          where: { id: updateUserDto.rolId },
      });

      if (!rol)
        throw new NotFoundException(
          `Rol con id ${updateUserDto.rolId} no encontrado`,
        );

        newRol = rol;
      userFound.rol = rol;
    }

    if (avatar) {
        const file = await queryRunner.manager.findOne(File, {
          where: { id: updateUserDto.avatar },
      });
      if (!file)
        throw new NotFoundException(
          `Archivo con id ${updateUserDto.avatar} no encontrado`,
        );
      userFound.avatar = file;
    }

    userFound.name = this.normalizeName(userFound.name);
    userFound.lastName = this.normalizeName(userFound.lastName);
      userFound.secondLastName = userFound.secondLastName ? this.normalizeName(userFound.secondLastName) : null;
      if (userFound.email) {
    userFound.email = userFound.email.toLowerCase().trim();
      }

      // Eliminar la propiedad 'student' que agregamos manualmente en findOne
      // ya que no es parte de la entidad User y causaría error al guardar
      const { student, ...userToSave } = userFound;
      
      await queryRunner.manager.save(User, userToSave);

      // Verificar si el nuevo rol es "Estudiante" o si isStudent es true
      const estudianteRol = newRol || userFound.rol;
      const isEstudianteRol = estudianteRol?.name === 'Estudiante';
      const shouldCreateStudent = isEstudianteRol && (isStudent !== false);

      if (shouldCreateStudent) {
        // Verificar si ya existe un registro de estudiante
        const existingStudent = await queryRunner.manager.findOne(Student, {
          where: { userId: id },
          relations: ['aspirant'],
        });

        if (!existingStudent) {
          // Crear nuevo registro de estudiante para usuario existente
          // Obtener estado CONVERTED
          const convertedStatus = await queryRunner.manager.findOne(AspirantStatus, {
            where: { code: 'CONVERTED' },
          });

          if (!convertedStatus) {
            throw new NotFoundException(
              'Estado CONVERTED no encontrado. Por favor, crea los estados iniciales.',
            );
          }

          // Obtener método de pago por defecto
          const paymentMethod = await queryRunner.manager.findOne(PaymentMethod, {
            where: { status: true },
          });

          if (!paymentMethod) {
            throw new NotFoundException(
              'No se encontró un método de pago activo. Por favor, crea uno primero.',
            );
          }

          // Obtener archivo de avatar si existe
          let avatarFile: File | null = null;
          const avatarId = avatar || userFound.avatar?.id;
          if (avatarId) {
            avatarFile = await queryRunner.manager.findOne(File, {
              where: { id: avatarId },
            });
          }

          // 1. Crear Aspirante con estado CONVERTED
          const newAspirant = queryRunner.manager.create(Aspirante, {
            firstName: userFound.name,
            lastNamePaternal: userFound.lastName,
            lastNameMaternal: userFound.secondLastName || null,
            email: userFound.email,
            phone: userFound.phone || '',
            age: null as any,
            language: language || (null as any),
            occupation: occupation || (null as any),
            gender: null as any,
            paymentMethod,
            status: convertedStatus,
            avatarId: avatarFile ? avatarFile.id : null,
            assessmentComments: assessmentComments || null,
            assessmentNotes: assessmentNotes || null,
          });
          const savedAspirant = await queryRunner.manager.save(Aspirante, newAspirant);

          // 2. Crear historial médico
          const medicalHistoryRecord = queryRunner.manager.create(AspirantMedicalHistory, {
            aspirantId: savedAspirant.id,
            hasInjury: medicalHistory?.hasInjury || false,
            injuryLocation: medicalHistory?.injuryLocation || null,
            injuryTime: medicalHistory?.injuryTime || null,
            hasPhysicalAilment: medicalHistory?.hasPhysicalAilment || false,
            ailmentDetail: medicalHistory?.ailmentDetail || null,
            surgeryComments: medicalHistory?.surgeryComments || null,
            additionalInfo: medicalHistory?.additionalInfo || null,
          });
          await queryRunner.manager.save(AspirantMedicalHistory, medicalHistoryRecord);

          // 3. Crear registro físico
          const physicalRecordEntity = queryRunner.manager.create(AspirantPhysicalRecord, {
            aspirantId: savedAspirant.id,
            weight: physicalRecord?.weight || null,
            height: physicalRecord?.height || null,
            flexibility: physicalRecord?.flexibility || null,
            strength: physicalRecord?.strength || null,
            balance: physicalRecord?.balance || null,
            posture: physicalRecord?.posture || null,
            rangeOfMotion: physicalRecord?.rangeOfMotion || null,
            observations: physicalRecord?.observations || null,
          });
          await queryRunner.manager.save(AspirantPhysicalRecord, physicalRecordEntity);

          // 4. Crear fotos de valoración si se proporcionan
          if (assessmentPhotoFileIds && assessmentPhotoFileIds.length > 0) {
            for (const fileId of assessmentPhotoFileIds) {
              const file = await queryRunner.manager.findOne(File, {
                where: { id: fileId },
              });
              if (file) {
                const assessmentPhoto = queryRunner.manager.create(AspirantAssessmentPhoto, {
                  aspirantId: savedAspirant.id,
                  fileId: fileId,
                });
                await queryRunner.manager.save(AspirantAssessmentPhoto, assessmentPhoto);
              }
            }
          }

          // 5. Crear Student vinculado con User existente y Aspirante
          const finalEnrollmentDate = enrollmentDate ? new Date(enrollmentDate) : new Date();
          const newStudent = queryRunner.manager.create(Student, {
            userId: id,
            aspirantId: savedAspirant.id,
            enrollmentDate: finalEnrollmentDate,
            isActive: true,
          });
          const savedStudent = await queryRunner.manager.save(Student, newStudent);

          // 6. Crear primer registro en StudentStatusHistory
          const initialStatusHistory = queryRunner.manager.create(StudentStatusHistory, {
            studentId: savedStudent.id,
            status: StudentStatus.ACTIVE,
            startDate: finalEnrollmentDate,
            endDate: null,
            reason: 'Ingreso desde actualización de usuario',
          });
          await queryRunner.manager.save(StudentStatusHistory, initialStatusHistory);
        } else {
          // Actualizar registro existente de aspirante si se proporcionan datos
          const aspirant = existingStudent.aspirant;
          
          if (language !== undefined) aspirant.language = language || null;
          if (occupation !== undefined) aspirant.occupation = occupation || null;
          if (assessmentComments !== undefined) aspirant.assessmentComments = assessmentComments || null;
          if (assessmentNotes !== undefined) aspirant.assessmentNotes = assessmentNotes || null;
          
          await queryRunner.manager.save(Aspirante, aspirant);

          // Actualizar registro físico si se proporciona
          if (physicalRecord) {
            const physicalRecordEntity = await queryRunner.manager.findOne(
              AspirantPhysicalRecord,
              { where: { aspirantId: aspirant.id } }
            );
            
            if (physicalRecordEntity) {
              Object.assign(physicalRecordEntity, {
                weight: physicalRecord.weight ?? physicalRecordEntity.weight,
                height: physicalRecord.height ?? physicalRecordEntity.height,
                flexibility: physicalRecord.flexibility ?? physicalRecordEntity.flexibility,
                strength: physicalRecord.strength ?? physicalRecordEntity.strength,
                balance: physicalRecord.balance ?? physicalRecordEntity.balance,
                posture: physicalRecord.posture ?? physicalRecordEntity.posture,
                rangeOfMotion: physicalRecord.rangeOfMotion ?? physicalRecordEntity.rangeOfMotion,
                observations: physicalRecord.observations ?? physicalRecordEntity.observations,
              });
              await queryRunner.manager.save(AspirantPhysicalRecord, physicalRecordEntity);
            }
          }

          // Actualizar historial médico si se proporciona
          if (medicalHistory) {
            const medicalHistoryEntity = await queryRunner.manager.findOne(
              AspirantMedicalHistory,
              { where: { aspirant: { id: aspirant.id } } }
            );
            
            if (medicalHistoryEntity) {
              Object.assign(medicalHistoryEntity, {
                hasInjury: medicalHistory.hasInjury ?? medicalHistoryEntity.hasInjury,
                injuryLocation: medicalHistory.injuryLocation ?? medicalHistoryEntity.injuryLocation,
                injuryTime: medicalHistory.injuryTime ?? medicalHistoryEntity.injuryTime,
                hasPhysicalAilment: medicalHistory.hasPhysicalAilment ?? medicalHistoryEntity.hasPhysicalAilment,
                ailmentDetail: medicalHistory.ailmentDetail ?? medicalHistoryEntity.ailmentDetail,
                surgeryComments: medicalHistory.surgeryComments ?? medicalHistoryEntity.surgeryComments,
                additionalInfo: medicalHistory.additionalInfo ?? medicalHistoryEntity.additionalInfo,
              });
              await queryRunner.manager.save(AspirantMedicalHistory, medicalHistoryEntity);
            }
          }

          // Actualizar enrollmentDate si se proporciona
          if (enrollmentDate) {
            existingStudent.enrollmentDate = new Date(enrollmentDate);
            await queryRunner.manager.save(Student, existingStudent);
          }
        }
      }

      await queryRunner.commitTransaction();
    return { message: `Usuario actualizado` };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string) {
    const { affected } = await this.userRepository.delete({ id });
    if (affected === 0)
      throw new BadRequestException(`Usuario con id ${id} no encontrado`);

    return { message: 'Usuario eliminado' };
  }

  async findOneByEmail(email: string) {
    const user = await this.userRepository.findOneBy({ email });

    return user;
  }

  private normalizeName(name: string | null | undefined): string {
    if (!name) return '';
    return name
      .trim()
      .replace(/\s+/g, ' ') // Reemplaza múltiples espacios por uno solo
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  async findWithFolio() {
    const users = await this.userRepository.find({
      where: {
        folio: Not(IsNull()),
      },
    });

    return users;
  }

  async getStats() {
    // Query SQL optimizada que obtiene todas las estadísticas en una sola consulta
    const stats = await this.userRepository
      .createQueryBuilder('user')
      .select('COUNT(*)', 'total')
      .addSelect(
        'SUM(CASE WHEN user.status = true THEN 1 ELSE 0 END)',
        'activos',
      )
      .addSelect(
        'SUM(CASE WHEN user.status = false THEN 1 ELSE 0 END)',
        'inactivos',
      )
      .getRawOne();

    return {
      total: parseInt(stats.total) || 0,
      activos: parseInt(stats.activos) || 0,
      inactivos: parseInt(stats.inactivos) || 0,
    };
  }

  async checkEmailExists(email: string): Promise<{ exists: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Verificar en usuarios
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    
    if (user) {
      return { exists: true };
    }
    
    // Verificar en aspirantes
    const aspirant = await this.aspiranteRepository.findOne({
      where: { email: normalizedEmail },
    });
    
    return {
      exists: !!aspirant,
    };
  }

  async checkPhoneExists(phone: string): Promise<{ exists: boolean }> {
    const normalizedPhone = phone.trim();
    
    // Verificar en usuarios
    const user = await this.userRepository.findOne({
      where: { phone: normalizedPhone },
    });
    
    if (user) {
      return { exists: true };
    }
    
    // Verificar en aspirantes
    const aspirant = await this.aspiranteRepository.findOne({
      where: { phone: normalizedPhone },
    });
    
    return {
      exists: !!aspirant,
    };
  }

  /**
   * Regenera y envía credenciales de acceso para un usuario existente
   * @param userId ID del usuario
   * @returns Usuario actualizado (sin password)
   */
  async regenerateAndSendCredentials(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { rol: true },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con id ${userId} no encontrado`);
    }

    if (!user.phone) {
      throw new BadRequestException('El usuario no tiene un número de teléfono registrado');
    }

    // Generar nueva contraseña
    const newPassword = uuid();
    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    // Actualizar contraseña en la base de datos
    user.password = hashedPassword;
    await this.userRepository.save(user);

    // Enviar credenciales por WhatsApp
    const fullName = `${user.name} ${user.lastName}${user.secondLastName ? ' ' + user.secondLastName : ''}`.trim();
    const userType = user.rol?.name?.toLowerCase().includes('estudiante') ? 'estudiante' : 'usuario';
    
    await this.whatsappNotificationService.sendSystemCredentials(
      fullName,
      user.email,
      newPassword,
      user.phone,
      userType as 'estudiante' | 'usuario',
    );

    // Eliminar password del objeto antes de retornar
    delete (user as any).password;
    return user;
  }
}
