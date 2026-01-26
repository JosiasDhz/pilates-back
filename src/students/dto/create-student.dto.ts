import { IsUUID, IsDate, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStudentDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  aspirantId: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  enrollmentDate?: Date;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
