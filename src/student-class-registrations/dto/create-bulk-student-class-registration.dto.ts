import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateStudentClassRegistrationDto } from './create-student-class-registration.dto';

export class CreateBulkStudentClassRegistrationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStudentClassRegistrationDto)
  registrations: CreateStudentClassRegistrationDto[];
}
