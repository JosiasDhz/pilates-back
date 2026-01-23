import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { UsersModule } from 'src/users/users.module';

@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService],
  imports: [
    UsersModule
  ]
})
export class WhatsappModule {}
