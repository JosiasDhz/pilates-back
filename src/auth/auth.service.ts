import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from 'src/users/entities/user.entity';
import { LoginUserDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly jwtService: JwtService,
  ) {}

  async login(loginuserDto: LoginUserDto) {
    const { password, email } = loginuserDto;

    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) throw new UnauthorizedException('Credenciales incorrectas');

    if (!bcrypt.compareSync(password, user.password))
      throw new UnauthorizedException('Credenciales incorrectas');

    if (!user.status)
      throw new UnauthorizedException(
        'Tu cuenta de usuario ha sido desactivada',
      );

    if (!user.rol.status)
      throw new UnauthorizedException(
        'Tu rol de usuario esta desactivado actualmente',
      );

    delete user.password;
    const { rol, ...rest } = user;
    return {
      user: { ...rest, rol: rol.name },
      accessList: user.rol.permissions,
      token: this.getJwtToken({ id: user.id }),
    };
  }

  getJwtToken(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
    return token;
  }

  async validateUser(id: string) {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) throw new UnauthorizedException('Credenciales incorrectas');

    delete user.password;
    const { rol, ...rest } = user;
    return {
      user: { ...rest, rol: rol.name },
      accessList: user.rol.permissions,
      token: this.getJwtToken({ id: user.id }),
    };
  }
}
