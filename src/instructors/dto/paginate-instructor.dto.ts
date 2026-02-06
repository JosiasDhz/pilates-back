import { IsOptional, IsUUID } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class PaginateInstructorDto extends PartialType(PaginationDto) {
  @IsOptional()
  @IsUUID()
  studioId?: string;
}
