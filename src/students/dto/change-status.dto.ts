import { IsEnum, IsString, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { StudentStatus } from '../entities/student-status-history.entity';

export class ChangeStatusDto {
  @IsEnum(StudentStatus)
  status: StudentStatus;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startDate?: Date;

  @IsString()
  @IsOptional()
  reason?: string;
}
