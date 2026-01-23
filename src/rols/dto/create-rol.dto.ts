import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateRolDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsBoolean()
  @IsOptional()
  status: boolean;

  @IsString({ each: true })
  @IsOptional()
  permissions: string[];
}
