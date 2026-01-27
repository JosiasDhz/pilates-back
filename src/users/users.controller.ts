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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from './entities/user.entity';
import { ValidRoles } from 'src/auth/dto/valid-roles.interface';
import { PaginationUserDto } from './dto/paginate-user.dto';

@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('/save')
  @Auth(ValidRoles.admin)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get('/paginate')
  findAll(@Query() paginationDto: PaginationUserDto) {
    return this.usersService.findAll(paginationDto);
  }
 
  @Get('/find-with-folio')
  findWithFolio() {
    return this.usersService.findWithFolio();
  }

  @Get('/stats')
  getStats() {
    return this.usersService.getStats();
  }

  @Get('check-email/:email')
  async checkEmail(@Param('email') email: string) {
    return this.usersService.checkEmailExists(email);
  }

  @Get('check-phone/:phone')
  async checkPhone(@Param('phone') phone: string) {
    return this.usersService.checkPhoneExists(phone);
  }

  @Get(':id')
  @Auth(ValidRoles.admin)
  findOne(@Param('id') id: string, @GetUser() user: User) {
    return this.usersService.findOne(id, user);
  }

  @Patch(':id')
  @Auth(ValidRoles.admin)
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @GetUser() user: User,
  ) {
    return this.usersService.update(id, updateUserDto, user);
  }

  @Delete(':id')
  @Auth(ValidRoles.admin)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/regenerate-credentials')
  @Auth(ValidRoles.admin)
  async regenerateCredentials(@Param('id') id: string) {
    return this.usersService.regenerateAndSendCredentials(id);
  }
}
