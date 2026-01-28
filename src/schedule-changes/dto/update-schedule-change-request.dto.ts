import {
  IsEnum,
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
} from 'class-validator';
import {
  ChangeRequestStatus,
  ChangeRequestType,
} from '../entities/schedule-change-request.entity';

export class UpdateScheduleChangeRequestDto {
  @IsEnum(ChangeRequestStatus)
  @IsOptional()
  status?: ChangeRequestStatus;

  @IsUUID()
  @IsOptional()
  newEventId?: string;

  @IsString()
  @IsOptional()
  adminNotes?: string;

  @IsDateString()
  @IsOptional()
  approvedAt?: string;

  @IsUUID()
  @IsOptional()
  approvedById?: string;
}
