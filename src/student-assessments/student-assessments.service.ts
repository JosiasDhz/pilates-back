import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { StudentAssessment } from './entities/student-assessment.entity';
import { StudentAssessmentMedicalHistory } from './entities/student-assessment-medical-history.entity';
import { StudentAssessmentPhysicalRecord } from './entities/student-assessment-physical-record.entity';
import { StudentAssessmentPhoto } from './entities/student-assessment-photo.entity';
import { CreateStudentAssessmentDto } from './dto/create-student-assessment.dto';
import { UpdateStudentAssessmentDto } from './dto/update-student-assessment.dto';
import { Student } from 'src/students/entities/student.entity';

@Injectable()
export class StudentAssessmentsService {
  constructor(
    @InjectRepository(StudentAssessment)
    private assessmentRepository: Repository<StudentAssessment>,
    @InjectRepository(Student)
    private studentRepository: Repository<Student>,
    @InjectRepository(StudentAssessmentMedicalHistory)
    private medicalHistoryRepository: Repository<StudentAssessmentMedicalHistory>,
    @InjectRepository(StudentAssessmentPhysicalRecord)
    private physicalRecordRepository: Repository<StudentAssessmentPhysicalRecord>,
    @InjectRepository(StudentAssessmentPhoto)
    private photoRepository: Repository<StudentAssessmentPhoto>,
    private dataSource: DataSource,
  ) {}

  async create(createDto: CreateStudentAssessmentDto): Promise<StudentAssessment> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verificar que el estudiante existe
      const student = await queryRunner.manager.findOne(Student, {
        where: { id: createDto.studentId },
      });

      if (!student) {
        throw new NotFoundException(`Estudiante con id ${createDto.studentId} no encontrado`);
      }

      // Crear la valoración
      const assessment = queryRunner.manager.create(StudentAssessment, {
        studentId: createDto.studentId,
        assessmentDate: createDto.assessmentDate,
        assessmentComments: createDto.assessmentComments || null,
        assessmentNotes: createDto.assessmentNotes || null,
      });
      const savedAssessment = await queryRunner.manager.save(StudentAssessment, assessment);

      // Crear historial médico si se proporciona
      if (createDto.medicalHistory) {
        const medicalHistory = queryRunner.manager.create(StudentAssessmentMedicalHistory, {
          assessmentId: savedAssessment.id,
          hasInjury: createDto.medicalHistory.hasInjury || false,
          injuryLocation: createDto.medicalHistory.injuryLocation || null,
          injuryTime: createDto.medicalHistory.injuryTime || null,
          hasPhysicalAilment: createDto.medicalHistory.hasPhysicalAilment || false,
          ailmentDetail: createDto.medicalHistory.ailmentDetail || null,
          surgeryComments: createDto.medicalHistory.surgeryComments || null,
          additionalInfo: createDto.medicalHistory.additionalInfo || null,
        });
        await queryRunner.manager.save(StudentAssessmentMedicalHistory, medicalHistory);
      }

      // Crear registro físico si se proporciona
      if (createDto.physicalRecord) {
        const physicalRecord = queryRunner.manager.create(StudentAssessmentPhysicalRecord, {
          assessmentId: savedAssessment.id,
          weight: createDto.physicalRecord.weight || null,
          height: createDto.physicalRecord.height || null,
          flexibility: createDto.physicalRecord.flexibility || null,
          strength: createDto.physicalRecord.strength || null,
          balance: createDto.physicalRecord.balance || null,
          posture: createDto.physicalRecord.posture || null,
          complexion: createDto.physicalRecord.complexion || null,
          rangeOfMotion: createDto.physicalRecord.rangeOfMotion || null,
          observations: createDto.physicalRecord.observations || null,
        });
        await queryRunner.manager.save(StudentAssessmentPhysicalRecord, physicalRecord);
      }

      // Crear fotos si se proporcionan
      if (createDto.photoFileIds && createDto.photoFileIds.length > 0) {
        const photos = createDto.photoFileIds.map((fileId) =>
          queryRunner.manager.create(StudentAssessmentPhoto, {
            assessmentId: savedAssessment.id,
            fileId,
          }),
        );
        await queryRunner.manager.save(StudentAssessmentPhoto, photos);
      }

      await queryRunner.commitTransaction();

      // Retornar la valoración completa con relaciones
      return this.findOne(savedAssessment.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(studentId?: string): Promise<StudentAssessment[]> {
    const query = this.assessmentRepository
      .createQueryBuilder('assessment')
      .leftJoinAndSelect('assessment.medicalHistory', 'medicalHistory')
      .leftJoinAndSelect('assessment.physicalRecord', 'physicalRecord')
      .leftJoinAndSelect('assessment.photos', 'photos')
      .leftJoinAndSelect('photos.file', 'file')
      .orderBy('assessment.createdAt', 'DESC');

    if (studentId) {
      query.where('assessment.studentId = :studentId', { studentId });
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<StudentAssessment> {
    const assessment = await this.assessmentRepository
      .createQueryBuilder('assessment')
      .leftJoinAndSelect('assessment.student', 'student')
      .leftJoinAndSelect('student.user', 'user')
      .leftJoinAndSelect('user.avatar', 'avatar')
      .leftJoinAndSelect('assessment.medicalHistory', 'medicalHistory')
      .leftJoinAndSelect('assessment.physicalRecord', 'physicalRecord')
      .leftJoinAndSelect('assessment.photos', 'photos')
      .leftJoinAndSelect('photos.file', 'file')
      .where('assessment.id = :id', { id })
      .getOne();

    if (!assessment) {
      throw new NotFoundException(`Valoración con id ${id} no encontrada`);
    }

    return assessment;
  }

  async update(id: string, updateDto: UpdateStudentAssessmentDto): Promise<StudentAssessment> {
    const assessment = await this.findOne(id);

    if (updateDto.assessmentDate) {
      assessment.assessmentDate = updateDto.assessmentDate;
    }
    if (updateDto.assessmentComments !== undefined) {
      assessment.assessmentComments = updateDto.assessmentComments;
    }
    if (updateDto.assessmentNotes !== undefined) {
      assessment.assessmentNotes = updateDto.assessmentNotes;
    }

    await this.assessmentRepository.save(assessment);

    // Actualizar historial médico si se proporciona
    if (updateDto.medicalHistory) {
      const medicalHistory = await this.medicalHistoryRepository.findOne({
        where: { assessmentId: id },
      });

      if (medicalHistory) {
        Object.assign(medicalHistory, updateDto.medicalHistory);
        await this.medicalHistoryRepository.save(medicalHistory);
      } else if (updateDto.medicalHistory) {
        const newMedicalHistory = this.medicalHistoryRepository.create({
          assessmentId: id,
          ...updateDto.medicalHistory,
        });
        await this.medicalHistoryRepository.save(newMedicalHistory);
      }
    }

    // Actualizar registro físico si se proporciona
    if (updateDto.physicalRecord) {
      const physicalRecord = await this.physicalRecordRepository.findOne({
        where: { assessmentId: id },
      });

      if (physicalRecord) {
        Object.assign(physicalRecord, updateDto.physicalRecord);
        await this.physicalRecordRepository.save(physicalRecord);
      } else if (updateDto.physicalRecord) {
        const newPhysicalRecord = this.physicalRecordRepository.create({
          assessmentId: id,
          ...updateDto.physicalRecord,
        });
        await this.physicalRecordRepository.save(newPhysicalRecord);
      }
    }

    // Actualizar fotos si se proporcionan
    if (updateDto.photoFileIds) {
      // Eliminar fotos existentes
      await this.photoRepository.delete({ assessmentId: id });

      // Crear nuevas fotos
      if (updateDto.photoFileIds.length > 0) {
        const photos = updateDto.photoFileIds.map((fileId) =>
          this.photoRepository.create({
            assessmentId: id,
            fileId,
          }),
        );
        await this.photoRepository.save(photos);
      }
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const assessment = await this.findOne(id);
    await this.assessmentRepository.remove(assessment);
  }
}
