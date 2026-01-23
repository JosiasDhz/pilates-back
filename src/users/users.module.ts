import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { RolsModule } from 'src/rols/rols.module';
import { AuthModule } from 'src/auth/auth.module';
import { FilesModule } from 'src/files/files.module';
import { FilesService } from 'src/files/files.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, FilesService],
  imports: [
    TypeOrmModule.forFeature([User]),
    RolsModule,
    FilesModule,
    forwardRef(() => AuthModule),
  ],
  exports: [TypeOrmModule],
})
export class UsersModule {}
