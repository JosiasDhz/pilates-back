import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { StudentAssessmentsService } from './student-assessments.service';
import { CreateStudentAssessmentDto } from './dto/create-student-assessment.dto';
import { UpdateStudentAssessmentDto } from './dto/update-student-assessment.dto';

@Controller('student-assessments')
export class StudentAssessmentsController {
  constructor(private readonly assessmentsService: StudentAssessmentsService) {}

  @Post()
  create(@Body() createDto: CreateStudentAssessmentDto) {
    return this.assessmentsService.create(createDto);
  }

  @Get()
  findAll(@Query('studentId') studentId?: string) {
    return this.assessmentsService.findAll(studentId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assessmentsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateStudentAssessmentDto) {
    return this.assessmentsService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.assessmentsService.remove(id);
  }
}
