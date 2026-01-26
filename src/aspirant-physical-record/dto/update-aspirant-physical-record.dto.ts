import { PartialType } from '@nestjs/mapped-types';
import { CreateAspirantPhysicalRecordDto } from './create-aspirant-physical-record.dto';

export class UpdateAspirantPhysicalRecordDto extends PartialType(CreateAspirantPhysicalRecordDto) {}
