import { IsArray, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReschedulePairDto {
  @IsUUID()
  originalEventId: string;

  @IsUUID()
  newEventId: string;
}

export class RescheduleImmediateBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReschedulePairDto)
  pairs: ReschedulePairDto[];
}
