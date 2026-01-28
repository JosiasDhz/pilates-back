import { IsEnum, IsDateString, IsOptional } from 'class-validator';
import { WaitlistStatus } from '../entities/waitlist.entity';

export class UpdateWaitlistDto {
  @IsEnum(WaitlistStatus)
  @IsOptional()
  status?: WaitlistStatus;

  @IsDateString()
  @IsOptional()
  notifiedAt?: string;

  @IsDateString()
  @IsOptional()
  registeredAt?: string;
}
