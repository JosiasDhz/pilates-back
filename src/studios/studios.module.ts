import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Studio } from './entities/studio.entity';
import { File } from 'src/files/entities/file.entity';
import { StudiosService } from './studios.service';
import { StudiosController } from './studios.controller';
import { FilesModule } from 'src/files/files.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Studio, File]),
    FilesModule,
  ],
  controllers: [StudiosController],
  providers: [StudiosService],
  exports: [TypeOrmModule, StudiosService],
})
export class StudiosModule {}
