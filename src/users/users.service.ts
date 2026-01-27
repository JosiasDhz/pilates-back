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

      // Validar campos requeridos para estudiante
      if (!physicalRecord?.weight || !physicalRecord?.height) {
        throw new BadRequestException(
          'El peso y la altura son requeridos para crear un estudiante',
        );
      }

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
      const newAspirant = queryRunner.manager.create(Aspirante, {
        firstName: name,
        lastNamePaternal: lastName,
        lastNameMaternal: secondLastName || null,
        email,
        phone,
        age: 0, // Valor por defecto, puede ser actualizado después
        language: language || 'Español',
        occupation: occupation || '',
        gender: '',
        paymentMethod,
        status: convertedStatus,
        avatarId: avatarFile ? avatarFile.id : null,
        assessmentComments: assessmentComments || null,
        assessmentNotes: assessmentNotes || null,
      });
      const savedAspirant = await queryRunner.manager.save(Aspirante, newAspirant);

      // 2. Crear historial médico si se proporciona
      if (medicalHistory) {
        const medicalHistoryRecord = queryRunner.manager.create(AspirantMedicalHistory, {
          aspirantId: savedAspirant.id,
          ...medicalHistory,
        });
        await queryRunner.manager.save(AspirantMedicalHistory, medicalHistoryRecord);
      }

      // 3. Crear registro físico
      const physicalRecordEntity = queryRunner.manager.create(AspirantPhysicalRecord, {
        aspirantId: savedAspirant.id,
        ...physicalRecord,
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

    if (user.rol.name === 'Administrador') return userFound;

    if (userFound.id === user.id) return userFound;

    throw new ForbiddenException(
      `Usuario: ${user.name} no tiene los permisos necesarios`,
    );
  }

  async update(id: string, updateUserDto: UpdateUserDto, user: User) {
    let userFound: any = await this.findOne(id, user);
    const { avatar, rolId, ...data } = updateUserDto;
    userFound = { ...userFound, ...data };

    if (updateUserDto.password) {
      delete updateUserDto.password;
      userFound.password = bcrypt.hashSync(updateUserDto.password, 10);
    }

    if (rolId) {
      if (!isUUID(updateUserDto.rolId))
        throw new BadRequestException('Proporciona un UUID valido');

      const rol = await this.rolRepository.findOneBy({
        id: updateUserDto.rolId,
      });

      if (!rol)
        throw new NotFoundException(
          `Rol con id ${updateUserDto.rolId} no encontrado`,
        );

      userFound.rol = rol;
    }

    if (avatar) {
      const file = await this.fileRepository.findOneBy({
        id: updateUserDto.avatar,
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

    const { affected } = await this.userRepository.update({ id }, userFound);

    return { message: `Usuario actualizado` };
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
