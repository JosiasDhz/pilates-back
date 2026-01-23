import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginUserDto {
  @IsEmail({}, { message: 'Debes de colocar un correo' })
  email: string;

  @IsString()
  // @MinLength(6)
  @MaxLength(50)
  // @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
  //   message: 'La contraseña debe de tener una mayuscula, minuscula y un numero',
  // })
  password: string;
}
