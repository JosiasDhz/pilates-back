import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { Event } from './entities/event.entity';
import { Studio } from 'src/studios/entities/studio.entity';
import { Instructor } from 'src/instructors/entities/instructor.entity';

describe('CalendarController', () => {
  let controller: CalendarController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CalendarController],
      providers: [
        CalendarService,
        {
          provide: getRepositoryToken(Event),
          useValue: { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), remove: jest.fn(), createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(Studio),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Instructor),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<CalendarController>(CalendarController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
