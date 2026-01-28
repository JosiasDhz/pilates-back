import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';

import { User } from 'src/users/entities/user.entity';
import { Rol } from 'src/rols/entities/rol.entity';
import { File } from 'src/files/entities/file.entity';
import { Employee } from 'src/employee/entities/employee.entity';
import { Studio } from 'src/studios/entities/studio.entity';
import { Instructor } from './entities/instructor.entity';
import { CreateInstructorDto } from './dto/create-instructor.dto';
import { UpdateInstructorDto } from './dto/update-instructor.dto';
import { PaginateInstructorDto } from './dto/paginate-instructor.dto';
import { FilesService } from 'src/files/files.service';
import { WhatsappNotificationService } from 'src/whatsapp/services/whatsapp-notification.service';

@Injectable()
export class InstructorsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly filesService: FilesService,
    private readonly whatsappNotificationService: WhatsappNotificationService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Studio)
    private readonly studioRepository: Repository<Studio>,
    @InjectRepository(Instructor)
    private readonly instructorRepository: Repository<Instructor>,
  ) {}

  private async hydrateAvatarUrl(instructor: Instructor): Promise<void> {
    const user = instructor?.employee?.user;
    if (!user?.avatar?.id) return;
    try {
      const fileWithUrl = await this.filesService.findOne(user.avatar.id);
      (user as any).avatar = fileWithUrl;
    } catch {
      (user as any).avatar = null;
    }
  }

  private normalizeForEmail(s: string): string {
    return (s ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  }

  private buildInternalEmailLocal(name: string, lastName: string, secondLastName?: string): string {
    const n = this.normalizeForEmail(name);
    const l1 = (lastName ?? '').trim();
    const l2 = (secondLastName ?? '').trim();
    const i1 = l1 ? this.normalizeForEmail(l1[0]) : '';
    const i2 = l2 ? this.normalizeForEmail(l2[0]) : '';
    const inits = i1 + i2;
    return inits ? `${n}.${inits}` : n;
  }

  /**
   * Crea User + Employee + Instructor en una transacción atómica.
   * employeeNumber: EMP-YYYY-XXX (XXX = secuencia anual).
   * internalEmail: nombre.iniciales@pilatesoaxaca.com (ej. adriana.mb@pilatesoaxaca.com).
   */
  async create(dto: CreateInstructorDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const email = dto.email.toLowerCase().trim();
      const existing = await queryRunner.manager.findOne(User, { where: { email } });
      if (existing) {
        throw new BadRequestException('Ya existe un usuario con ese correo');
      }

      let rol: Rol;
      if (dto.rolId) {
        const found = await queryRunner.manager.findOne(Rol, { where: { id: dto.rolId } });
        if (!found) throw new NotFoundException(`Rol con id ${dto.rolId} no encontrado`);
        rol = found;
      } else {
        const instructorRol = await queryRunner.manager.findOne(Rol, { where: { name: 'Instructor' } });
        if (!instructorRol) throw new BadRequestException('Rol "Instructor" no configurado en el sistema');
        rol = instructorRol;
      }

      let file: File | null = null;
      if (dto.avatar) {
        file = await queryRunner.manager.findOne(File, { where: { id: dto.avatar } });
        if (!file) throw new NotFoundException(`Archivo con id ${dto.avatar} no encontrado`);
      }

      const password = dto.password || uuid();
      const hashed = bcrypt.hashSync(password, 10);
      // Guardar la contraseña en texto plano temporalmente para enviarla por WhatsApp
      const plainPassword = password;

      const user = queryRunner.manager.create(User, {
        name: dto.name,
        lastName: dto.lastName,
        secondLastName: dto.secondLastName ?? '',
        email,
        phone: dto.phone ?? null,
        password: hashed,
        status: dto.status ?? true,
        rol,
        ...(file && { avatar: file }),
      });
      const savedUser = await queryRunner.manager.save(User, user);
      const userId = savedUser.id;

      const now = new Date();
      const year = now.getFullYear();
      const prefix = `EMP-${year}-`;
      const count = await queryRunner.manager
        .createQueryBuilder(Employee, 'e')
        .where('e.employeeNumber LIKE :prefix', { prefix: `${prefix}%` })
        .getCount();
      const seq = String(count + 1).padStart(3, '0');
      const employeeNumber = `${prefix}${seq}`;

      const domain = 'pilatesoaxaca.com';
      const local = this.buildInternalEmailLocal(dto.name, dto.lastName, dto.secondLastName);
      let internalEmail = `${local}@${domain}`;
      let suffix = 2;
      while (await queryRunner.manager.findOne(Employee, { where: { internalEmail } })) {
        internalEmail = `${local}-${suffix}@${domain}`;
        suffix += 1;
      }

      const employee = queryRunner.manager.create(Employee, {
        userId,
        employeeNumber,
        internalEmail,
        hiredAt: now,
        latestContractAt: now,
        resignedAt: null,
        isActive: true,
      });
      const savedEmployee = await queryRunner.manager.save(Employee, employee);
      const employeeId = savedEmployee.id;

      let studio: Studio | null = null;
      if (dto.studioId) {
        studio = await queryRunner.manager.findOne(Studio, { where: { id: dto.studioId } });
        if (!studio) throw new NotFoundException(`Estudio con id ${dto.studioId} no encontrado`);
      }

      const instructor = queryRunner.manager.create(Instructor, {
        employeeId,
        specialty: dto.specialty,
        bio: dto.bio ?? null,
        status: dto.instructorStatus ?? true,
        ...(studio && { studio }),
      });
      const savedInstructor = await queryRunner.manager.save(Instructor, instructor);

      await queryRunner.commitTransaction();

      const result = await this.instructorRepository.findOne({
        where: { id: savedInstructor.id },
        relations: { employee: { user: { rol: true, avatar: true } }, studio: true },
      });
      if (!result) return result;
      if (result.employee?.user && 'password' in result.employee.user) {
        delete (result.employee.user as any).password;
      }
      await this.hydrateAvatarUrl(result);

      // Enviar credenciales por WhatsApp si hay teléfono
      if (dto.phone) {
        const fullName = `${dto.name} ${dto.lastName}${dto.secondLastName ? ' ' + dto.secondLastName : ''}`.trim();
        this.whatsappNotificationService.sendSystemCredentials(
          fullName,
          email,
          plainPassword,
          dto.phone,
          'instructor',
        ).catch((error) => {
          // Loggear el error pero no fallar la creación del instructor
          console.error('Error al enviar credenciales por WhatsApp:', error);
        });
      }

      return result;
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll() {
    return this.instructorRepository.find({
      relations: { employee: { user: { rol: true, avatar: true } }, studio: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Paginación, búsqueda y ordenamiento (estilo users).
   */
  async findAllPaginated(paginationDto: PaginateInstructorDto) {
    const {
      limit = 10,
      offset = 0,
      sort = 'Creado',
      order = 'desc',
      search = '',
    } = paginationDto;

    const qb = this.instructorRepository
      .createQueryBuilder('instructor')
      .leftJoinAndSelect('instructor.employee', 'employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('user.rol', 'rol')
      .leftJoinAndSelect('user.avatar', 'avatar')
      .leftJoinAndSelect('instructor.studio', 'studio')
      .take(limit)
      .skip(offset);

    if (search.trim() !== '') {
      const terms = search.trim().split(/\s+/).map((t) => `%${t}%`);
      terms.forEach((term, i) => {
        qb.andWhere(
          `(user.name ILIKE :term${i} OR user.lastName ILIKE :term${i} OR user.secondLastName ILIKE :term${i} OR user.email ILIKE :term${i} OR instructor.specialty ILIKE :term${i})`,
          { [`term${i}`]: term },
        );
      });
    }

    const orderDir = order === 'asc' ? 'ASC' : 'DESC';
    const sortMap: Record<string, string> = {
      Creado: 'instructor.createdAt',
      'Nombre(s)': 'user.name',
      Email: 'user.email',
      Especialidad: 'instructor.specialty',
      Estudio: 'studio.name',
      FechaIngreso: 'employee.hiredAt',
      Status: 'instructor.status',
    };
    const orderBy = sortMap[sort] ?? 'instructor.createdAt';
    qb.orderBy(orderBy, orderDir);

    const [records, total] = await qb.getManyAndCount();
    return { records, total };
  }

  async findByUserId(userId: string) {
    const instructor = await this.instructorRepository
      .createQueryBuilder('instructor')
      .leftJoinAndSelect('instructor.employee', 'employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('user.rol', 'rol')
      .leftJoinAndSelect('user.avatar', 'avatar')
      .leftJoinAndSelect('instructor.studio', 'studio')
      .where('employee.userId = :userId', { userId })
      .getOne();

    if (!instructor) {
      throw new NotFoundException(`Instructor con userId ${userId} no encontrado`);
    }

    if (instructor.employee?.user && 'password' in instructor.employee.user) {
      delete (instructor.employee.user as any).password;
    }

    await this.hydrateAvatarUrl(instructor);
    return instructor;
  }

  async findOne(id: string) {
    if (!isUUID(id)) throw new NotFoundException('Proporciona un UUID válido de instructor');
    const instructor = await this.instructorRepository.findOne({
      where: { id },
      relations: { employee: { user: { rol: true, avatar: true } }, studio: true },
    });
    if (!instructor) throw new NotFoundException(`Instructor con id ${id} no encontrado`);
    if (instructor.employee?.user && 'password' in instructor.employee.user) {
      delete (instructor.employee.user as any).password;
    }
    await this.hydrateAvatarUrl(instructor);
    return instructor;
  }

  async update(id: string, dto: UpdateInstructorDto) {
    const instructor = await this.findOne(id);
    if (dto.studioId !== undefined) {
      if (dto.studioId == null || dto.studioId === '') {
        instructor.studio = null;
      } else {
        const studio = await this.studioRepository.findOne({ where: { id: dto.studioId } });
        if (!studio) throw new NotFoundException(`Estudio con id ${dto.studioId} no encontrado`);
        instructor.studio = studio;
      }
    }
    if (dto.instructorStatus !== undefined) instructor.status = dto.instructorStatus;
    if (dto.specialty != null) instructor.specialty = dto.specialty;
    if (dto.bio !== undefined) instructor.bio = dto.bio;
    await this.instructorRepository.save(instructor);
    return this.findOne(id);
  }

  async remove(id: string) {
    const instructor = await this.findOne(id);
    await this.instructorRepository.remove(instructor);
    return { message: 'Instructor eliminado correctamente' };
  }

  async getStats(): Promise<{ total: number; activos: number; inactivos: number }> {
    const qb = this.instructorRepository
      .createQueryBuilder('instructor')
      .select('COUNT(instructor.id)', 'total')
      .addSelect('SUM(CASE WHEN instructor.status = true THEN 1 ELSE 0 END)', 'activos')
      .addSelect('SUM(CASE WHEN instructor.status = false THEN 1 ELSE 0 END)', 'inactivos');
    const raw = await qb.getRawOne();
    return {
      total: parseInt(raw?.total ?? '0', 10) || 0,
      activos: parseInt(raw?.activos ?? '0', 10) || 0,
      inactivos: parseInt(raw?.inactivos ?? '0', 10) || 0,
    };
  }

  /**
   * Regenera y envía credenciales de acceso para un instructor existente
   * @param instructorId ID del instructor
   * @returns Instructor actualizado (sin password en user)
   */
  async regenerateAndSendCredentials(instructorId: string) {
    const instructor = await this.instructorRepository.findOne({
      where: { id: instructorId },
      relations: { employee: { user: { rol: true } } },
    });

    if (!instructor) {
      throw new NotFoundException(`Instructor con id ${instructorId} no encontrado`);
    }

    const user = instructor.employee?.user;
    if (!user) {
      throw new NotFoundException('No se encontró el usuario asociado al instructor');
    }

    if (!user.phone) {
      throw new BadRequestException('El instructor no tiene un número de teléfono registrado');
    }

    // Generar nueva contraseña
    const newPassword = uuid();
    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    // Actualizar contraseña en la base de datos
    user.password = hashedPassword;
    await this.userRepository.save(user);

    // Enviar credenciales por WhatsApp
    const fullName = `${user.name} ${user.lastName}${user.secondLastName ? ' ' + user.secondLastName : ''}`.trim();
    
    await this.whatsappNotificationService.sendSystemCredentials(
      fullName,
      user.email,
      newPassword,
      user.phone,
      'instructor',
    );

    // Retornar instructor actualizado sin password
    const updatedInstructor = await this.findOne(instructorId);
    return updatedInstructor;
  }
}
