import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AspirantStatusService } from './aspirant-status.service';
import { AspirantStatusController } from './aspirant-status.controller';
import { AspirantStatus } from './entities/aspirant-status.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AspirantStatus])],
  controllers: [AspirantStatusController],
  providers: [AspirantStatusService],
  exports: [TypeOrmModule, AspirantStatusService],
})
export class AspirantStatusModule {}
