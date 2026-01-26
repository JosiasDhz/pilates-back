import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ConfigurationType } from '../entities/configuration.entity';

export class CreateConfigurationDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsEnum(ConfigurationType)
  type: ConfigurationType;

  @IsString()
  @IsNotEmpty()
  group: string;
}
