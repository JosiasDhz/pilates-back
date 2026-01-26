import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AspirantAccessTokenService } from './aspirant-access-token.service';
import { AspirantAccessTokenController } from './aspirant-access-token.controller';
import { AspirantAccessToken } from './entities/aspirant-access-token.entity';
import { Aspirante } from 'src/aspirantes/entities/aspirante.entity';
import { AspirantesModule } from 'src/aspirantes/aspirantes.module';
import { PaymentsModule } from 'src/payments/payments.module';
import { FilesModule } from 'src/files/files.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AspirantAccessToken, Aspirante]),
    forwardRef(() => AspirantesModule),
    PaymentsModule,
    FilesModule,
  ],
  controllers: [AspirantAccessTokenController],
  providers: [AspirantAccessTokenService],
  exports: [AspirantAccessTokenService],
})
export class AspirantAccessTokenModule {}
