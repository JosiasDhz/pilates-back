import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
  NotFoundException,
} from '@nestjs/common';
import { ScheduleChangesService } from './schedule-changes.service';
import { CreateScheduleChangeRequestDto } from './dto/create-schedule-change-request.dto';
import { UpdateScheduleChangeRequestDto } from './dto/update-schedule-change-request.dto';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { UpdateWaitlistDto } from './dto/update-waitlist.dto';
import {
  ChangeRequestStatus,
  ChangeRequestType,
} from './entities/schedule-change-request.entity';
import { WaitlistStatus } from './entities/waitlist.entity';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from 'src/users/entities/user.entity';
import { StudentsService } from 'src/students/students.service';

@Controller('schedule-changes')
export class ScheduleChangesController {
  constructor(
    private readonly scheduleChangesService: ScheduleChangesService,
    private readonly studentsService: StudentsService,
  ) {}

  @Post('request')
  @UsePipes(new ValidationPipe())
  @Auth()
  async createChangeRequest(
    @Body() createDto: CreateScheduleChangeRequestDto,
    @GetUser() user: User,
  ) {
    // Si no viene studentId, usar el del usuario autenticado
    if (!createDto.studentId) {
      const student = await this.studentsService.findByUserId(user.id);
      if (!student) {
        throw new NotFoundException('Estudiante no encontrado para este usuario');
      }
      createDto.studentId = student.id;
    }
    return this.scheduleChangesService.createChangeRequest(createDto);
  }

  @Get('requests')
  findAllChangeRequests(
    @Query('studentId') studentId?: string,
    @Query('status') status?: ChangeRequestStatus,
    @Query('requestType') requestType?: ChangeRequestType,
  ) {
    return this.scheduleChangesService.findAllChangeRequests(
      studentId,
      status,
      requestType,
    );
  }

  @Get('my-requests')
  @Auth()
  async getMyChangeRequests(
    @GetUser() user: User,
    @Query('status') status?: ChangeRequestStatus,
  ) {
    const student = await this.studentsService.findByUserId(user.id);
    if (!student) {
      throw new NotFoundException('Estudiante no encontrado para este usuario');
    }
    return this.scheduleChangesService.findAllChangeRequests(
      student.id,
      status,
    );
  }

  @Get('requests/:id')
  findOneChangeRequest(@Param('id') id: string) {
    return this.scheduleChangesService.findOneChangeRequest(id);
  }

  @Patch('requests/:id/approve')
  @UsePipes(new ValidationPipe())
  @Auth()
  approveChangeRequest(
    @Param('id') id: string,
    @Body() updateDto: UpdateScheduleChangeRequestDto,
    @GetUser() user: User,
  ) {
    return this.scheduleChangesService.approveChangeRequest(
      id,
      updateDto,
      user.id,
    );
  }

  @Patch('requests/:id/reject')
  @UsePipes(new ValidationPipe())
  @Auth()
  rejectChangeRequest(
    @Param('id') id: string,
    @Body('adminNotes') adminNotes?: string,
  ) {
    return this.scheduleChangesService.rejectChangeRequest(id, adminNotes);
  }

  @Post('waitlist')
  @UsePipes(new ValidationPipe())
  @Auth()
  createWaitlist(@Body() createDto: CreateWaitlistDto) {
    return this.scheduleChangesService.createWaitlist(createDto);
  }

  @Get('waitlist')
  findAllWaitlist(
    @Query('studentId') studentId?: string,
    @Query('eventId') eventId?: string,
    @Query('status') status?: WaitlistStatus,
  ) {
    return this.scheduleChangesService.findAllWaitlist(studentId, eventId, status);
  }

  @Get('waitlist/:id')
  findOneWaitlist(@Param('id') id: string) {
    return this.scheduleChangesService.findOneWaitlist(id);
  }

  @Get('waitlist/public')
  getPublicWaitlist() {
    // Lista de espera visible para todos los estudiantes
    return this.scheduleChangesService.findAllWaitlist(
      undefined,
      undefined,
      WaitlistStatus.PENDING,
    );
  }

  @Patch('waitlist/:id')
  @UsePipes(new ValidationPipe())
  @Auth()
  updateWaitlist(
    @Param('id') id: string,
    @Body() updateDto: UpdateWaitlistDto,
  ) {
    // Implementar actualización de waitlist
    // Por ahora retornar el método del servicio
    return { message: 'Not implemented yet' };
  }

  @Get('jokers')
  @Auth()
  async getMyJokers(
    @GetUser() user: User,
    @Query('year') year?: number,
    @Query('month') month?: number,
  ) {
    const student = await this.studentsService.findByUserId(user.id);
    if (!student) {
      throw new NotFoundException('Estudiante no encontrado para este usuario');
    }
    const currentDate = new Date();
    const currentYear = year || currentDate.getFullYear();
    const currentMonth = month || currentDate.getMonth() + 1;

    return this.scheduleChangesService.getStudentJokers(
      student.id,
      currentYear,
      currentMonth,
    );
  }

  @Get('jokers/:studentId')
  getStudentJokers(
    @Param('studentId') studentId: string,
    @Query('year') year?: number,
    @Query('month') month?: number,
  ) {
    const currentDate = new Date();
    const currentYear = year || currentDate.getFullYear();
    const currentMonth = month || currentDate.getMonth() + 1;

    return this.scheduleChangesService.getStudentJokers(
      studentId,
      currentYear,
      currentMonth,
    );
  }

  @Get('can-reschedule/:originalEventId')
  @Auth()
  canReschedule(
    @Param('originalEventId') originalEventId: string,
    @Query('newEventId') newEventId?: string,
    @Query('studentId') studentId?: string,
  ) {
    if (!studentId) {
      return { error: 'StudentId required' };
    }
    return this.scheduleChangesService.canReschedule(
      studentId,
      originalEventId,
      newEventId,
    );
  }
}
