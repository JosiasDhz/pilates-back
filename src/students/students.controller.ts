import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { PaginateStudentDto } from './dto/paginate-student.dto';
import { ClassSelectionDto } from './dto/class-selection.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from 'src/users/entities/user.entity';

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

  @Get('my-profile')
  @Auth()
  getMyProfile(@GetUser() user: User) {
    return this.studentsService.findByUserId(user.id);
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

  @Post(':id/class-selection')
  @UsePipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }))
  selectClasses(
    @Param('id') id: string,
    @Body() classSelectionDto: ClassSelectionDto,
  ) {
    console.log('=== CLASS SELECTION REQUEST ===');
    console.log('URL param id:', id, 'type:', typeof id);
    console.log('Body received:', JSON.stringify(classSelectionDto, null, 2));
    
    // Asegurar que el studentId del DTO coincida con el parámetro de la URL
    // El studentId viene del parámetro de la URL, no del body
    const finalDto: ClassSelectionDto = {
      ...classSelectionDto,
      studentId: id, // Siempre usar el id de la URL
    };
    
    console.log('Final DTO:', JSON.stringify(finalDto, null, 2));
    
    return this.studentsService.selectClasses(finalDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.studentsService.remove(id);
  }
}
