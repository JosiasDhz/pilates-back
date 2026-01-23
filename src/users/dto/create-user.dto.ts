import {
  IsString,
  IsEmail,
  IsBoolean,
  IsUUID,
  IsOptional,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsString()
  lastName: string;

  @IsString()
  secondLastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  password: string;

  @IsString()
  phone: string;

  @IsBoolean()
  @IsOptional()
  status: boolean;

  @IsString()
  @IsOptional()
  avatar: string;

  @IsUUID()
  rolId: string;

  @IsString()
  @IsOptional()
  position: string;
}
