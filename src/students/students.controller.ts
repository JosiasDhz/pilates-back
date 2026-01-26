import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { PaginateStudentDto } from './dto/paginate-student.dto';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  create(@Body() createStudentDto: CreateStudentDto) {
    return this.studentsService.create(createStudentDto);
  }

  @Get('stats')
  getStats() {
    return this.studentsService.getStats();
  }

  @Get()
  findAll(@Query() paginationDto: PaginateStudentDto) {
    // Si hay parámetros de paginación, usar findAllPaginated
    if (paginationDto.limit !== undefined || paginationDto.offset !== undefined || paginationDto.sort || paginationDto.search) {
      return this.studentsService.findAllPaginated(paginationDto);
    }
    // Si no hay parámetros, retornar todos (compatibilidad hacia atrás)
    return this.studentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.studentsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStudentDto: UpdateStudentDto) {
    return this.studentsService.update(id, updateStudentDto);
  }

  @Post(':id/change-status')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  changeStatus(
    @Param('id') id: string,
    @Body() changeStatusDto: ChangeStatusDto,
  ) {
    return this.studentsService.changeStatus(id, changeStatusDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.studentsService.remove(id);
  }
}
