import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { AspirantStatusService } from './aspirant-status.service';
import { CreateAspirantStatusDto } from './dto/create-aspirant-status.dto';
import { UpdateAspirantStatusDto } from './dto/update-aspirant-status.dto';

@Controller('aspirant-status')
export class AspirantStatusController {
  constructor(private readonly aspirantStatusService: AspirantStatusService) {}

  @Post()
  create(@Body() createAspirantStatusDto: CreateAspirantStatusDto) {
    return this.aspirantStatusService.create(createAspirantStatusDto);
  }

  @Post('initialize')
  initializeDefaultStatuses() {
    return this.aspirantStatusService.initializeDefaultStatuses();
  }

  @Get()
  findAll() {
    return this.aspirantStatusService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aspirantStatusService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAspirantStatusDto: UpdateAspirantStatusDto,
  ) {
    return this.aspirantStatusService.update(id, updateAspirantStatusDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aspirantStatusService.remove(id);
  }
}

