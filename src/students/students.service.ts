import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { PaginateStudentDto } from './dto/paginate-student.dto';
import { Student } from './entities/student.entity';
import { StudentStatusHistory, StudentStatus } from './entities/student-status-history.entity';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(StudentStatusHistory)
    private readonly statusHistoryRepository: Repository<StudentStatusHistory>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createStudentDto: CreateStudentDto) {
    const student = this.studentRepository.create({
      ...createStudentDto,
      enrollmentDate: createStudentDto.enrollmentDate || new Date(),
      isActive: createStudentDto.isActive !== undefined ? createStudentDto.isActive : true,
    });
    return await this.studentRepository.save(student);
  }

  async findAll() {
    return await this.studentRepository.find({
      relations: ['user', 'aspirant'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAllPaginated(paginationDto: PaginateStudentDto) {
    const {
      limit = 10,
      offset = 0,
      sort = 'createdAt',
      order = 'desc',
      search = '',
    } = paginationDto;

    const query = this.studentRepository
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.user', 'user')
      .leftJoinAndSelect('user.avatar', 'avatar')
      .leftJoinAndSelect('student.aspirant', 'aspirant')
      .take(limit)
      .skip(offset);

    if (search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      query.andWhere(
        `(user.name ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search OR user.phone ILIKE :search OR aspirant.firstName ILIKE :search OR aspirant.lastNamePaternal ILIKE :search OR aspirant.email ILIKE :search)`,
        { search: searchTerm },
      );
    }

    // Mapeo de campos de ordenamiento
    const sortMapping: Record<string, string> = {
      nombre: 'user.name',
      name: 'user.name',
      email: 'user.email',
      fechaIngreso: 'student.enrollmentDate',
      enrollmentDate: 'student.enrollmentDate',
      estatus: 'student.isActive',
      status: 'student.isActive',
      createdAt: 'student.createdAt',
      creado: 'student.createdAt',
    };

    const sortField = sortMapping[sort] || 'student.createdAt';
    const orderType = order === 'asc' ? 'ASC' : 'DESC';
    query.orderBy(sortField, orderType);

    const [records, total] = await query.getManyAndCount();

    return {
      records,
      total,
    };
  }

  async findOne(id: string) {
    const student = await this.studentRepository
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.user', 'user')
      .leftJoinAndSelect('user.avatar', 'avatar')
      .leftJoinAndSelect('student.aspirant', 'aspirant')
      .leftJoinAndSelect('aspirant.physicalRecord', 'physicalRecord')
      .leftJoinAndSelect('aspirant.medicalHistory', 'medicalHistory')
      .leftJoinAndSelect('aspirant.assessmentPhotos', 'assessmentPhotos')
      .leftJoinAndSelect('assessmentPhotos.file', 'file')
      .leftJoinAndSelect('student.statusHistory', 'statusHistory')
      .where('student.id = :id', { id })
      .getOne();

    if (!student) {
      throw new NotFoundException(`Estudiante con id ${id} no encontrado`);
    }

    // Ordenar el historial por fecha de inicio descendente
    if (student.statusHistory) {
      student.statusHistory.sort((a, b) => {
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      });
    }

    return student;
  }

  async update(id: string, updateStudentDto: UpdateStudentDto) {
    const student = await this.findOne(id);
    Object.assign(student, updateStudentDto);
    return await this.studentRepository.save(student);
  }

  async remove(id: string) {
    const student = await this.findOne(id);
    await this.studentRepository.remove(student);
    return { message: 'Estudiante eliminado correctamente' };
  }

  async getStats() {
    const total = await this.studentRepository.count();

    const active = await this.studentRepository.count({
      where: { isActive: true },
    });

    const inactive = await this.studentRepository.count({
      where: { isActive: false },
    });

    return {
      total,
      active,
      inactive,
    };
  }

  async changeStatus(studentId: string, changeStatusDto: ChangeStatusDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Obtener el estudiante
      const student = await queryRunner.manager.findOne(Student, {
        where: { id: studentId },
      });

      if (!student) {
        throw new NotFoundException(`Estudiante con id ${studentId} no encontrado`);
      }

      // Buscar el registro actual activo (sin endDate)
      const currentStatusHistory = await queryRunner.manager.findOne(
        StudentStatusHistory,
        {
          where: {
            studentId: student.id,
            endDate: null,
          },
          order: { startDate: 'DESC' },
        },
      );

      const newStartDate = changeStatusDto.startDate || new Date();

      // Si hay un registro actual, cerrarlo
      if (currentStatusHistory) {
        // Verificar que el nuevo estado sea diferente
        if (currentStatusHistory.status === changeStatusDto.status) {
          throw new BadRequestException(
            `El estudiante ya tiene el estado ${changeStatusDto.status}`,
          );
        }

        currentStatusHistory.endDate = newStartDate;
        await queryRunner.manager.save(StudentStatusHistory, currentStatusHistory);
      }

      // Crear el nuevo registro de historial
      const newStatusHistory = queryRunner.manager.create(StudentStatusHistory, {
        studentId: student.id,
        status: changeStatusDto.status,
        startDate: newStartDate,
        endDate: null,
        reason: changeStatusDto.reason || null,
      });
      await queryRunner.manager.save(StudentStatusHistory, newStatusHistory);

      // Actualizar el estado isActive del estudiante según el nuevo status
      student.isActive = changeStatusDto.status === StudentStatus.ACTIVE;
      await queryRunner.manager.save(Student, student);

      // Confirmar la transacción
      await queryRunner.commitTransaction();

      return {
        student: await this.findOne(studentId),
        statusHistory: newStatusHistory,
      };
    } catch (error) {
      // Hacer rollback en caso de error
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Liberar el query runner
      await queryRunner.release();
    }
  }
}
