import { PartialType } from '@nestjs/mapped-types';
import { CreateAspirantStatusDto } from './create-aspirant-status.dto';

export class UpdateAspirantStatusDto extends PartialType(CreateAspirantStatusDto) {}
