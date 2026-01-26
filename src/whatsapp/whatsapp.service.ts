import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { WHATSAPP_PHONE_ID, WHATSAPP_TOKEN } from 'src/utils/constants';
import { Repository } from 'typeorm';
import { MessageInterface } from './interfaces/message-interface';
import { registerTemplate } from './templates/register.template';
import { ReceivedMessage } from './interfaces/received-message.interface';
import { confirmRegisterTemplate } from './templates/confirm-register.template';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_ID;

  private readonly purchaseId = '1724273011835663';
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
  }

  async sendMessage(data: MessageInterface) {
    const url = `https://graph.facebook.com/v22.0/${this.phoneNumberId}/messages`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.WHATSAPP_TOKEN}`,
    };

    // Determinar el tipo de mensaje
    let messageType = 'template';
    if (data?.flowId) {
      messageType = 'interactive';
    } else if (data?.interactive) {
      messageType = 'interactive';
    }

    const body = {
      recipient_type: 'individual',
      messaging_product: 'whatsapp',
      to: data.to,
      type: messageType,
      ...(data.template && {
        ...data.template,
      }),
      ...(data?.flowId && {
        interactive: {
          body: {
            text: data.bodyText,
          },
          footer: {
            text: 'Powered by Karimnot',
          },
          type: 'flow',
          action: {
            name: 'flow',
            parameters: {
              flow_message_version: '3',
              flow_id: data.flowId,
              flow_cta: data.flowCta,
            },
          },
        },
      }),
      ...(data?.interactive && !data?.flowId && {
        interactive: data.interactive,
      }),
    };

    try {
      this.logger.log('Enviando mensaje de WhatsApp:', JSON.stringify({ to: data.to, type: messageType }, null, 2));
      this.logger.log('Body completo:', JSON.stringify(body, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        this.logger.error('Error en respuesta de WhatsApp API:', {
          status: response.status,
          statusText: response.statusText,
          error: responseData,
        });
        throw new Error(responseData.error?.message || `WhatsApp API error: ${response.status}`);
      }
      
      this.logger.log('✅ Mensaje de WhatsApp enviado exitosamente:', responseData);
      return responseData;
    } catch (error) {
      this.logger.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  async sendForm(from: string) {
    const user = await this.userRepository.findOne({
      where: {
        phone: from,
      },
    });
    // if (user) return;

    return await this.sendMessage({
      bodyText: `🎉 ¡Participa y gana una Laptop DELL Inspiron 3250💻 completamente GRATIS!

Contagramm, Patrocinador oficial del 7.º aniversario de BNI Guelaguetza | Conferencia: Oso Trava - Siempre es el día 1, te invita a formar parte de esta rifa.

Solo necesitas registrarte en el siguiente formulario

Politica de privacidad: https://www.contagramm.com/politica-privacidad
`,
      flowId: '1192239882646747',
      flowCta: 'Registrate aqui',
      to: from,
    });
  }

  async saveRegister(data: ReceivedMessage) {
    const message = data.entry.at(0).changes.at(0).value;

    const whatsappName = message.contacts.at(0).profile.name;
    const whatsappPhone = message.contacts.at(0).wa_id;

    const user = await this.userRepository.findOne({
      where: {
        phone: whatsappPhone,
      },
    });
    // if (user) return;

    const response = JSON.parse(
      message.messages.at(0).interactive.nfm_reply.response_json,
    );

    const email = response.screen_0_Email_2;
    const company = response.screen_0_Empresa_1;
    const name = response.screen_0_Nombre_0;
    const folio = await this.generateFolio();

    const newUser = await this.userRepository.save({
      name,
      email,
      company,
      whatsappName,
      phone: whatsappPhone,
      folio,
      status: true,
    });

    await this.sendMessage({
      to: whatsappPhone,
      template: confirmRegisterTemplate(folio),
    });
  }

  async sendTextMessage(to: string, message: string) {
    const url = `https://graph.facebook.com/v22.0/${this.phoneNumberId}/messages`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.WHATSAPP_TOKEN}`,
    };

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    };

    try {
      this.logger.log('Enviando mensaje de texto de WhatsApp:', JSON.stringify({ to, messageLength: message.length }, null, 2));
      this.logger.log('Body completo:', JSON.stringify(body, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
      });
      const responseData = await response.json();

      if (!response.ok) {
        this.logger.error('Error en respuesta de WhatsApp API (text message):', {
          status: response.status,
          statusText: response.statusText,
          error: responseData,
        });
        throw new Error(responseData.error?.message || 'Failed to send message');
      }

      this.logger.log('✅ Mensaje de texto de WhatsApp enviado exitosamente:', responseData);
      return responseData;
    } catch (error) {
      this.logger.error('Error sending WhatsApp text message:', error);
      throw error;
    }
  }

  private async generateFolio() {
    const { customAlphabet } = require('fix-esm').require('nanoid');
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const nanoid = customAlphabet(alphabet, 8);

    const id = nanoid();
    return `${id.slice(0, 4)}-${id.slice(4)}`;
  }
}
