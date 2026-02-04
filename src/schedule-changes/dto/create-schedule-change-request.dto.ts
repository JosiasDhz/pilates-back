import {
  IsUUID,
  IsEnum,
  IsString,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsNumber,
  Min,
  IsArray,
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

  @IsDateString()
  @IsOptional()
  leaveStartDate?: string; // Fecha de inicio de baja temporal (formato YYYY-MM-DD)

  @IsArray()
  @IsDateString({}, { each: true })
  @IsOptional()
  travelFeeDates?: string[]; // Días seleccionados para tarifa de viaje (formato YYYY-MM-DD)

  @IsBoolean()
  @IsOptional()
  usesJoker?: boolean;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  travelFeeAmount?: number;
}
