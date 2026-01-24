import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StudiosService } from './studios.service';
import { Studio } from './entities/studio.entity';
import { File } from 'src/files/entities/file.entity';
import { FilesService } from 'src/files/files.service';

describe('StudiosService', () => {
  let service: StudiosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudiosService,
        { provide: getRepositoryToken(Studio), useValue: {} },
        { provide: getRepositoryToken(File), useValue: {} },
        { provide: FilesService, useValue: {} },
      ],
    }).compile();

    service = module.get<StudiosService>(StudiosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
