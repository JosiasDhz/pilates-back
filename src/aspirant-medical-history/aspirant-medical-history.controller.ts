import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AspirantMedicalHistoryService } from './aspirant-medical-history.service';
import { CreateAspirantMedicalHistoryDto } from './dto/create-aspirant-medical-history.dto';
import { UpdateAspirantMedicalHistoryDto } from './dto/update-aspirant-medical-history.dto';

@Controller('aspirant-medical-history')
export class AspirantMedicalHistoryController {
  constructor(private readonly aspirantMedicalHistoryService: AspirantMedicalHistoryService) {}

  @Post()
  create(@Body() createAspirantMedicalHistoryDto: CreateAspirantMedicalHistoryDto) {
    return this.aspirantMedicalHistoryService.create(createAspirantMedicalHistoryDto);
  }

  @Get()
  findAll() {
    return this.aspirantMedicalHistoryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aspirantMedicalHistoryService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAspirantMedicalHistoryDto: UpdateAspirantMedicalHistoryDto,
  ) {
    return this.aspirantMedicalHistoryService.update(
      id,
      updateAspirantMedicalHistoryDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aspirantMedicalHistoryService.remove(id);
  }
}
