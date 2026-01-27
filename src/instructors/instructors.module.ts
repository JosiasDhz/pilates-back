import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Rol } from 'src/rols/entities/rol.entity';
import { File } from 'src/files/entities/file.entity';
import { Employee } from 'src/employee/entities/employee.entity';
import { Studio } from 'src/studios/entities/studio.entity';
import { Instructor } from './entities/instructor.entity';
import { InstructorsService } from './instructors.service';
import { InstructorsController } from './instructors.controller';
import { FilesModule } from 'src/files/files.module';
import { WhatsappModule } from 'src/whatsapp/whatsapp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Rol, File, Employee, Studio, Instructor]),
    FilesModule,
    forwardRef(() => WhatsappModule),
  ],
  controllers: [InstructorsController],
  providers: [InstructorsService],
  exports: [TypeOrmModule, InstructorsService],
})
export class InstructorsModule {}
