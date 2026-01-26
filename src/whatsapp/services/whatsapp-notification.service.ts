import { Injectable, Logger } from '@nestjs/common';
import { WhatsappService } from '../whatsapp.service';
import { Aspirante } from 'src/aspirantes/entities/aspirante.entity';
import { Event } from 'src/calendar/entities/event.entity';
import { AspirantRegistrationMessage } from '../messages/aspirant-registration.message';
import { aspirantRegisterTemplate } from '../templates/aspirant-register.template';

@Injectable()
export class WhatsappNotificationService {
  private readonly logger = new Logger(WhatsappNotificationService.name);

  constructor(private readonly whatsappService: WhatsappService) { }

  async sendAspirantRegistrationConfirmation(
    aspirant: Aspirante,
    valoracionEvent: Event,
  ): Promise<void> {
    if (!aspirant.phone || !valoracionEvent) {
      this.logger.warn(
        `No se puede enviar WhatsApp: teléfono=${!!aspirant.phone}, evento=${!!valoracionEvent}`,
      );
      return;
    }

    try {
      const phoneNumber = this.formatPhoneNumber(aspirant.phone);
      const messageBuilder = new AspirantRegistrationMessage(aspirant, valoracionEvent);

      this.logger.log(`Enviando confirmación de registro a ${phoneNumber}`);


      try {
        const template = aspirantRegisterTemplate(
          messageBuilder.firstName,
          messageBuilder.fechaFormateada,
          messageBuilder.hora,
          messageBuilder.estudioNombre,
        );

        this.logger.log(`Intentando usar template 'registro_valoracion' para ${phoneNumber}`);
        this.logger.debug(`Parámetros del template:`, {
          nombre: messageBuilder.firstName,
          fecha: messageBuilder.fechaFormateada,
          hora: messageBuilder.hora,
          estudio: messageBuilder.estudioNombre,
        });

        await this.whatsappService.sendMessage({
          to: phoneNumber,
          template: template,
        });

        this.logger.log(`✅ Confirmación enviada exitosamente con template a ${phoneNumber}`);
      } catch (templateError: any) {

        const errorMessage = templateError?.message || String(templateError);

        if (
          errorMessage.includes('132001') ||
          errorMessage.includes('does not exist') ||
          errorMessage.includes('revisión') ||
          errorMessage.includes('not approved')
        ) {
          this.logger.warn(
            `Template 'registro_valoracion' no disponible (estado: En revisión). ` +
            `Usando mensaje de texto como fallback. ` +
            `Nota: Solo funcionará si el usuario te escribió en las últimas 24h.`
          );

          try {
            await this.whatsappService.sendTextMessage(phoneNumber, messageBuilder.build());
            this.logger.log(`✅ Confirmación enviada exitosamente con mensaje de texto a ${phoneNumber}`);
          } catch (textError: any) {
            this.logger.error(
              `Error al enviar mensaje de texto: ${textError?.message}. ` +
              `El usuario probablemente no te ha escrito en las últimas 24 horas. ` +
              `Una vez que la plantilla 'registro_valoracion' sea aprobada, funcionará para todos.`
            );

          }
        } else {

          throw templateError;
        }
      }
    } catch (error: any) {
      this.logger.error(
        `Error al enviar confirmación de registro a ${aspirant.phone}:`,
        error?.message || error,
      );


    }
  }

  private formatPhoneNumber(phone: string): string {
    const cleaned = phone.trim();


    if (cleaned.startsWith('521') && cleaned.length === 13) {
      return cleaned;
    }


    if (cleaned.length === 10 && /^\d+$/.test(cleaned)) {
      return `521${cleaned}`;
    }


    if (cleaned.startsWith('52') && cleaned.length === 12) {
      return `521${cleaned.substring(2)}`;
    }


    return cleaned.startsWith('52') ? cleaned : `521${cleaned}`;
  }
}
