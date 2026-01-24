import { IsString, IsUUID, IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class CreateEmployeeDto {
  @IsUUID()
  userId: string;

  @IsString()
  employeeNumber: string;

  @IsString()
  internalEmail: string;

  @IsDateString()
  hiredAt: string;

  @IsDateString()
  latestContractAt: string;

  @IsDateString()
  @IsOptional()
  resignedAt?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
