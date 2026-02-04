import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { StudentClassRegistrationsService } from './student-class-registrations.service';
import { CreateStudentClassRegistrationDto } from './dto/create-student-class-registration.dto';
import { CreateBulkStudentClassRegistrationDto } from './dto/create-bulk-student-class-registration.dto';
import { UpdateStudentClassRegistrationDto } from './dto/update-student-class-registration.dto';
import { RegistrationStatus } from './entities/student-class-registration.entity';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from 'src/users/entities/user.entity';

@Controller('student-class-registrations')
export class StudentClassRegistrationsController {
  constructor(
    private readonly registrationsService: StudentClassRegistrationsService,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe())
  create(@Body() createDto: CreateStudentClassRegistrationDto) {
    return this.registrationsService.create(createDto);
  }

  @Post('bulk')
  @UsePipes(new ValidationPipe())
  createBulk(@Body() createBulkDto: CreateBulkStudentClassRegistrationDto) {
    return this.registrationsService.createBulk(createBulkDto);
  }

  @Get()
  findAll(
    @Query('studentId') studentId?: string,
    @Query('eventId') eventId?: string,
    @Query('status') status?: RegistrationStatus,
  ) {
    return this.registrationsService.findAll(studentId, eventId, status);
  }

  @Get('my-registrations')
  @Auth()
  getMyRegistrations(
    @GetUser() user: User,
    @Query('status') status?: RegistrationStatus,
  ) {
    return this.registrationsService.findByUserId(user.id, status);
  }

  @Get('student/:studentId')
  findByStudent(
    @Param('studentId') studentId: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const monthNum = month ? parseInt(month, 10) : undefined;
    const yearNum = year ? parseInt(year, 10) : undefined;
    return this.registrationsService.findByStudent(studentId, monthNum, yearNum);
  }

  @Get('event/:eventId')
  findByEvent(@Param('eventId') eventId: string) {
    return this.registrationsService.findByEvent(eventId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.registrationsService.findOne(id);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe())
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateStudentClassRegistrationDto,
  ) {
    return this.registrationsService.update(id, updateDto);
  }

  @Delete('bulk')
  removeBulk(@Body('ids') ids: string[]) {
    return this.registrationsService.removeBulk(ids);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.registrationsService.remove(id);
  }
}
