import { IsUUID, IsDateString, IsString, IsOptional } from 'class-validator';

export class CreateWaitlistDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  eventId: string;

  @IsDateString()
  requestedDate: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
