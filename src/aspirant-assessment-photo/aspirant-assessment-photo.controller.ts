import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AspirantAssessmentPhotoService } from './aspirant-assessment-photo.service';
import { CreateAspirantAssessmentPhotoDto } from './dto/create-aspirant-assessment-photo.dto';
import { UpdateAspirantAssessmentPhotoDto } from './dto/update-aspirant-assessment-photo.dto';

@Controller('aspirant-assessment-photo')
export class AspirantAssessmentPhotoController {
  constructor(private readonly aspirantAssessmentPhotoService: AspirantAssessmentPhotoService) {}

  @Post()
  create(@Body() createAspirantAssessmentPhotoDto: CreateAspirantAssessmentPhotoDto) {
    return this.aspirantAssessmentPhotoService.create(createAspirantAssessmentPhotoDto);
  }

  @Get()
  findAll() {
    return this.aspirantAssessmentPhotoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aspirantAssessmentPhotoService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAspirantAssessmentPhotoDto: UpdateAspirantAssessmentPhotoDto) {
    return this.aspirantAssessmentPhotoService.update(+id, updateAspirantAssessmentPhotoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aspirantAssessmentPhotoService.remove(+id);
  }
}
