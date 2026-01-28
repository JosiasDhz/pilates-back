import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { InstructorsService } from './instructors.service';
import { CreateInstructorDto } from './dto/create-instructor.dto';
import { UpdateInstructorDto } from './dto/update-instructor.dto';
import { PaginateInstructorDto } from './dto/paginate-instructor.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from 'src/users/entities/user.entity';

@Controller('instructors')
export class InstructorsController {
  constructor(private readonly instructorsService: InstructorsService) {}

  @Post()
  create(@Body() createInstructorDto: CreateInstructorDto) {
    return this.instructorsService.create(createInstructorDto);
  }

  @Get('paginate')
  findAllPaginated(@Query() paginationDto: PaginateInstructorDto) {
    return this.instructorsService.findAllPaginated(paginationDto);
  }

  @Get('stats')
  getStats() {
    return this.instructorsService.getStats();
  }

  @Get('my-profile')
  @Auth()
  getMyProfile(@GetUser() user: User) {
    return this.instructorsService.findByUserId(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.instructorsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateInstructorDto: UpdateInstructorDto) {
    return this.instructorsService.update(id, updateInstructorDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.instructorsService.remove(id);
  }

  @Post(':id/regenerate-credentials')
  async regenerateCredentials(@Param('id') id: string) {
    return this.instructorsService.regenerateAndSendCredentials(id);
  }
}
