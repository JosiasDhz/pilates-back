import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AspirantPhysicalRecordService } from './aspirant-physical-record.service';
import { CreateAspirantPhysicalRecordDto } from './dto/create-aspirant-physical-record.dto';
import { UpdateAspirantPhysicalRecordDto } from './dto/update-aspirant-physical-record.dto';

@Controller('aspirant-physical-record')
export class AspirantPhysicalRecordController {
  constructor(private readonly aspirantPhysicalRecordService: AspirantPhysicalRecordService) {}

  @Post()
  create(@Body() createAspirantPhysicalRecordDto: CreateAspirantPhysicalRecordDto) {
    return this.aspirantPhysicalRecordService.create(createAspirantPhysicalRecordDto);
  }

  @Get()
  findAll() {
    return this.aspirantPhysicalRecordService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aspirantPhysicalRecordService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAspirantPhysicalRecordDto: UpdateAspirantPhysicalRecordDto) {
    return this.aspirantPhysicalRecordService.update(+id, updateAspirantPhysicalRecordDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aspirantPhysicalRecordService.remove(+id);
  }
}
