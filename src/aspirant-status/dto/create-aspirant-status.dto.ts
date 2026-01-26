import { IsString, IsOptional, MaxLength, IsBoolean } from 'class-validator';

export class CreateAspirantStatusDto {
  @IsString()
  @MaxLength(50)
  name: string;

  @IsString()
  @MaxLength(20)
  code: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
