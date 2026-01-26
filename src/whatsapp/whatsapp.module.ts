import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { UsersModule } from 'src/users/users.module';
import { WhatsappNotificationService } from './services/whatsapp-notification.service';

@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsappNotificationService],
  imports: [
    UsersModule
  ],
  exports: [WhatsappService, WhatsappNotificationService],
})
export class WhatsappModule {}
