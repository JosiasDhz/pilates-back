import { Module, forwardRef } from '@nestjs/common';
import { RolsService } from './rols.service';
import { RolsController } from './rols.controller';
import { Rol } from './entities/rol.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [RolsController],
  providers: [RolsService],
  imports: [TypeOrmModule.forFeature([Rol]), forwardRef(() => AuthModule)],
  exports: [TypeOrmModule],
})
export class RolsModule {}
