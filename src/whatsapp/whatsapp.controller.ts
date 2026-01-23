import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpException,
} from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('webhook')
  webhook(@Query() query: any) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    const VERIFY_TOKEN = 'algo_bien_secreto_ue';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return challenge;
    } else {
      throw new HttpException('Forbidden', 403);
    }
  }

  @Post('webhook')
  handleIncomingMessage(@Body() body: any) {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];
    const hasContext = changes?.value?.messages?.[0]?.context;
    // Es un mensaje plano
    if (message && !hasContext) {
      const from = message.from;
      const text = message.text?.body;

      return this.whatsappService.sendForm(from);
      
    }
    // Viene de un formulario de whatsapp
    if (hasContext) {
      return this.whatsappService.saveRegister(body);
      
    }

    return { status: 'success' };
  }

  @Get('current-version')
  version() {
    return {
      message: 'version 1.0.1',
    };
  }
}
