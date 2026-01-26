import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ConfigurationsService } from './configurations.service';
import { CreateConfigurationDto } from './dto/create-configuration.dto';
import { UpdateConfigurationDto } from './dto/update-configuration.dto';

@Controller('configurations')
export class ConfigurationsController {
  constructor(private readonly configurationsService: ConfigurationsService) {}

  @Post()
  create(@Body() createConfigurationDto: CreateConfigurationDto) {
    return this.configurationsService.create(createConfigurationDto);
  }

  @Get()
  findAll() {
    return this.configurationsService.findAll();
  }

  @Get('key/:key')
  async getByKey(@Param('key') key: string) {
    const result = await this.configurationsService.getByKey(key);
    if (result === null) {
      return null;
    }
    return result;
  }

  @Get('group/:group')
  getByGroup(@Param('group') group: string) {
    return this.configurationsService.getByGroup(group);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.configurationsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateConfigurationDto: UpdateConfigurationDto) {
    return this.configurationsService.update(id, updateConfigurationDto);
  }

  @Patch('key/:key')
  updateByKey(
    @Param('key') key: string,
    @Body('value') value: any,
    @Body('type') type?: string,
    @Body('group') group?: string,
  ) {
    return this.configurationsService.updateByKey(
      key,
      value,
      type as any,
      group,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.configurationsService.remove(id);
  }
}
