import { IsUUID, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateAspirantAccessTokenDto {
  @IsUUID()
  aspirantId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  expiresInDays?: number;
}
