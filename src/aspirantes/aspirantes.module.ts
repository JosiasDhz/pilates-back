import { Module } from '@nestjs/common';
import { AspirantesService } from './aspirantes.service';
import { AspirantesController } from './aspirantes.controller';

@Module({
  controllers: [AspirantesController],
  providers: [AspirantesService],
})
export class AspirantesModule {}
