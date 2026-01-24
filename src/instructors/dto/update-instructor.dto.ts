import { IsString, IsOptional, IsUUID, IsBoolean } from 'class-validator';

export class UpdateInstructorDto {
  @IsUUID()
  @IsOptional()
  studioId?: string | null;

  @IsBoolean()
  @IsOptional()
  instructorStatus?: boolean;

  @IsString()
  @IsOptional()
  specialty?: string;

  @IsString()
  @IsOptional()
  bio?: string;
}
