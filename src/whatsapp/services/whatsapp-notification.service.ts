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
    evidenceLink?: string,
    evidenceUploaded?: boolean,
  ): Promise<void> {
    if (!aspirant.phone || !valoracionEvent) {
      this.logger.warn(
        `No se puede enviar WhatsApp: teléfono=${!!aspirant.phone}, evento=${!!valoracionEvent}`,
      );
      return;
    }

    try {
      const phoneNumber = this.formatPhoneNumber(aspirant.phone);
      const messageBuilder = new AspirantRegistrationMessage(aspirant, valoracionEvent, evidenceLink);

      this.logger.log(`Enviando confirmación de registro a ${phoneNumber}`);
      if (evidenceLink) {
        this.logger.log(`Incluyendo link de evidencia: ${evidenceLink}`);
      }
      if (evidenceUploaded) {
        this.logger.log(`Evidencia ya fue subida, enviando mensaje interactivo con información de valoración`);
      }

      // Si la evidencia ya fue subida (no eligió "adjuntar más tarde"), enviar mensaje interactivo con info de valoración
      if (evidenceUploaded && !evidenceLink) {
        try {
          const messageText = `¡Hola ${messageBuilder.firstName}! 👋

✅ Tu registro de valoración ha sido confirmado:

📅 Fecha: ${messageBuilder.fechaFormateada}
🕐 Hora: ${messageBuilder.hora}
📍 Estudio: ${messageBuilder.estudioNombre}

✅ Tu comprobante de pago ya fue recibido y está en revisión.

Te esperamos en tu clase de valoración. Si tienes alguna pregunta, no dudes en contactarnos.

¡Nos vemos pronto! 🧘‍♀️`;

          this.logger.log(`Enviando mensaje interactivo con información de valoración para ${phoneNumber}`);

          await this.whatsappService.sendMessage({
            to: phoneNumber,
            interactive: {
              type: 'button',
              body: {
                text: messageText,
              },
              footer: {
                text: 'Pilates Oaxaca',
              },
              action: {
                buttons: [
                  {
                    type: 'reply',
                    reply: {
                      id: 'confirmado',
                      title: '✅ Confirmado',
                    },
                  },
                ],
              },
            },
          });

          this.logger.log(`✅ Confirmación enviada exitosamente con mensaje interactivo a ${phoneNumber}`);
          return;
        } catch (interactiveError: any) {
          this.logger.error(
            `Error al enviar mensaje interactivo: ${interactiveError?.message}. ` +
            `Intentando con template como fallback.`
          );
          // Continuar con el intento de template como fallback
        }
      }

      // Si hay evidenceLink, usar mensaje interactivo con botón en lugar de template
      if (evidenceLink) {
        try {
          const messageText = `¡Hola ${messageBuilder.firstName}! 👋

✅ Tu registro de valoración ha sido confirmado:

📅 Fecha: ${messageBuilder.fechaFormateada}
🕐 Hora: ${messageBuilder.hora}
📍 Estudio: ${messageBuilder.estudioNombre}

📎 Para subir tu comprobante de pago, haz clic en el botón de abajo.

Te esperamos en tu clase de valoración. Si tienes alguna pregunta, no dudes en contactarnos.

¡Nos vemos pronto! 🧘‍♀️`;

          this.logger.log(`Enviando mensaje interactivo con botón para ${phoneNumber}`);

          await this.whatsappService.sendMessage({
            to: phoneNumber,
            interactive: {
              type: 'cta_url',
              body: {
                text: messageText,
              },
              footer: {
                text: 'Pilates Oaxaca',
              },
              action: {
                name: 'cta_url',
                parameters: {
                  display_text: 'Subir comprobante de pago',
                  url: evidenceLink,
                },
              },
            },
          });

          this.logger.log(`✅ Confirmación enviada exitosamente con mensaje interactivo a ${phoneNumber}`);
          return;
        } catch (interactiveError: any) {
          this.logger.error(
            `Error al enviar mensaje interactivo: ${interactiveError?.message}. ` +
            `Intentando con template como fallback.`
          );
          // Continuar con el intento de template como fallback
        }
      }

      try {
        const template = aspirantRegisterTemplate(
          messageBuilder.firstName,
          messageBuilder.fechaFormateada,
          messageBuilder.hora,
          messageBuilder.estudioNombre,
          evidenceLink,
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
