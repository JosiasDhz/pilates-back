import { IsBoolean, IsString, IsOptional } from 'class-validator';

export class CreateAspirantMedicalHistoryDto {
  @IsBoolean()
  @IsOptional()
  hasInjury?: boolean;

  @IsString()
  @IsOptional()
  injuryLocation?: string;

  @IsString()
  @IsOptional()
  injuryTime?: string;

  @IsBoolean()
  @IsOptional()
  hasPhysicalAilment?: boolean;

  @IsString()
  @IsOptional()
  ailmentDetail?: string;

  @IsString()
  @IsOptional()
  surgeryComments?: string;

  @IsString()
  @IsOptional()
  additionalInfo?: string;
}
