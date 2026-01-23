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
    const url = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.WHATSAPP_TOKEN}`,
    };

    const body = {
      recipient_type: 'individual',
      messaging_product: 'whatsapp',
      to: data.to,
      type: data?.flowId ? 'interactive' : 'template',
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
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
      });
      const responseData = await response.json();

      return responseData;
    } catch (error) {
      this.logger.error('Error sending WhatsApp message:', error);
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

  private async generateFolio() {
    const { customAlphabet } = require('fix-esm').require('nanoid');
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const nanoid = customAlphabet(alphabet, 8);

    const id = nanoid();
    return `${id.slice(0, 4)}-${id.slice(4)}`;
  }
}
