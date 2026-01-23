import { Body, Controller, Post, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login.dto';
import { Auth } from './decorators/auth.decorator';
import { ValidRoles } from './dto/valid-roles.interface';
import { GetUser } from './decorators/get-user.decorator';
import { User } from 'src/users/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  loginUser(@Body() loginDto: LoginUserDto) {
    return this.authService.login(loginDto);
  }

  @Auth()
  @Get('validate')
  me(@GetUser() user: User) {
    return this.authService.validateUser(user.id)
  }
}
