import {
  IsUUID,
  IsEnum,
  IsString,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';
import { ChangeRequestType } from '../entities/schedule-change-request.entity';

export class CreateScheduleChangeRequestDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  originalEventId: string;

  @IsUUID()
  @IsOptional()
  newEventId?: string;

  @IsEnum(ChangeRequestType)
  requestType: ChangeRequestType;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsDateString()
  @IsOptional()
  requestedDate?: string;

  @IsBoolean()
  @IsOptional()
  usesJoker?: boolean;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  travelFeeAmount?: number;
}
