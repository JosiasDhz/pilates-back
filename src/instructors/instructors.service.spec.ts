import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InstructorsService } from './instructors.service';
import { Instructor } from './entities/instructor.entity';
import { Employee } from 'src/employee/entities/employee.entity';
import { User } from 'src/users/entities/user.entity';
import { Rol } from 'src/rols/entities/rol.entity';
import { File } from 'src/files/entities/file.entity';
import { Studio } from 'src/studios/entities/studio.entity';
import { FilesService } from 'src/files/files.service';

describe('InstructorsService', () => {
  let service: InstructorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstructorsService,
        { provide: DataSource, useValue: {} },
        { provide: FilesService, useValue: {} },
        { provide: getRepositoryToken(Instructor), useValue: {} },
        { provide: getRepositoryToken(Employee), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(Rol), useValue: {} },
        { provide: getRepositoryToken(File), useValue: {} },
        { provide: getRepositoryToken(Studio), useValue: {} },
      ],
    }).compile();

    service = module.get<InstructorsService>(InstructorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
