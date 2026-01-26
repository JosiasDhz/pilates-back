import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CreateAspirantPhysicalRecordDto } from 'src/aspirant-physical-record/dto/create-aspirant-physical-record.dto';

export class SaveAssessmentDto {
  @ValidateNested()
  @Type(() => CreateAspirantPhysicalRecordDto)
  physicalRecord: CreateAspirantPhysicalRecordDto;

  @IsUUID()
  @IsOptional()
  avatarFileId?: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(0)
  assessmentPhotoFileIds: string[];

  @IsString()
  @IsOptional()
  assessmentComments?: string;

  @IsString()
  @IsOptional()
  assessmentNotes?: string;
}
