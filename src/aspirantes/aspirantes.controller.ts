import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AspirantesService } from './aspirantes.service';
import { CreateAspiranteDto } from './dto/create-aspirante.dto';
import { UpdateAspiranteDto } from './dto/update-aspirante.dto';

@Controller('aspirantes')
export class AspirantesController {
  constructor(private readonly aspirantesService: AspirantesService) {}

  @Post()
  create(@Body() createAspiranteDto: CreateAspiranteDto) {
    return this.aspirantesService.create(createAspiranteDto);
  }

  @Get()
  findAll() {
    return this.aspirantesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aspirantesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAspiranteDto: UpdateAspiranteDto) {
    return this.aspirantesService.update(+id, updateAspiranteDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aspirantesService.remove(+id);
  }
}
