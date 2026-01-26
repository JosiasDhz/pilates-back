import {
  Controller,
  Get,
  Post,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { isUUID } from 'class-validator';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file?.originalname) return { message: 'No file provided' };

    return this.filesService.uploadFile(file);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('inline') inline?: string) {
    if (!isUUID(id)) throw new BadRequestException({ message: 'Invalid id' });
    return this.filesService.findOne(id, inline === 'true');
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    if (!isUUID(id)) throw new BadRequestException({ message: 'Invalid id' });
    return this.filesService.remove(id);
  }
}
