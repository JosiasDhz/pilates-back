import { PartialType } from '@nestjs/mapped-types';
import { CreateAspiranteDto } from './create-aspirante.dto';

export class UpdateAspiranteDto extends PartialType(CreateAspiranteDto) {}
