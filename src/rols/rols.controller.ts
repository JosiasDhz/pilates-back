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
import { RolsService } from './rols.service';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRolDto } from './dto/update-rol.dto';
import { AuthPermissions } from 'src/auth/decorators/auth.decorator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Controller('rol')
export class RolsController {
  constructor(private readonly rolsService: RolsService) {}

  @Post('/save')
  @AuthPermissions('Roles')
  create(@Body() createRolDto: CreateRolDto) {
    return this.rolsService.create(createRolDto);
  }

  @Get('/all')
  findAllNotPaginated() {
    return this.rolsService.findAllNotPaginated();
  }

  @Get('/paginate')
  findAll(@Query() paginationDto: PaginationDto) {
    return this.rolsService.findAll(paginationDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rolsService.findOne(id);
  }

  @Patch(':id')
  @AuthPermissions('Roles')
  update(@Param('id') id: string, @Body() updateRolDto: UpdateRolDto) {
    return this.rolsService.update(id, updateRolDto);
  }

  @Delete(':id')
  @AuthPermissions('Roles')
  remove(@Param('id') id: string) {
    return this.rolsService.remove(id);
  }
}
