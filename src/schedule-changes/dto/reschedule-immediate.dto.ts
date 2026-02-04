import { IsUUID } from 'class-validator';

export class RescheduleImmediateDto {
  @IsUUID()
  originalEventId: string;

  @IsUUID()
  newEventId: string;
}
