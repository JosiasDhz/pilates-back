import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

export class PaginationDto {
  @IsNumber()
  @IsOptional()
  @IsPositive()
  @Type(() => Number) // Esto no lo pondriamos si hubieramos puesto el enableImplicitiConversions en el main.ts
  limit?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  offset?: number;

  @IsOptional()
  @Type(() => String)
  sort?: string;

  @IsOptional()
  @Type(() => String)
  order?: string;

  @IsOptional()
  @Type(() => String)
  search?: string;
  
  @IsOptional()
  @Type(() => String)
  estatus?: string;

}
