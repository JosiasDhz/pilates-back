import { IsArray, ValidateNested, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateStudentClassRegistrationDto } from './create-student-class-registration.dto';

export class CreateBulkStudentClassRegistrationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStudentClassRegistrationDto)
  registrations: CreateStudentClassRegistrationDto[];

  @IsNumber()
  @IsOptional()
  classesCoveredByTravelFee?: number; // Número de clases cubiertas por tarifa de viaje

  @IsString()
  @IsOptional()
  monthYear?: string; // Formato "YYYY-MM" para identificar el mes del balance
}
