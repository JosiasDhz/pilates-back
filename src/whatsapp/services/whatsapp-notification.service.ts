import { Injectable, Logger } from '@nestjs/common';
import { WhatsappService } from '../whatsapp.service';
import { Aspirante } from 'src/aspirantes/entities/aspirante.entity';
import { Event } from 'src/calendar/entities/event.entity';
import { AspirantRegistrationMessage } from '../messages/aspirant-registration.message';
import { aspirantRegisterTemplate } from '../templates/aspirant-register.template';
import { credentialsTemplate } from '../templates/credentials.template';

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

      // Si hay evidenceLink Y NO se subió evidencia, usar mensaje interactivo con botón
      // Si ya se subió evidencia, solo enviar el template de confirmación
      if (evidenceLink && !evidenceUploaded) {
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
                  display_text: 'Subir comprobante',
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

      // Siempre usar template appointment_confirme para confirmación de registro
      try {
        const template = aspirantRegisterTemplate(
          messageBuilder.firstName,
          messageBuilder.fechaFormateada,
          messageBuilder.hora,
          messageBuilder.estudioNombre,
        );

        this.logger.log(`Intentando usar template 'appointment_confirme' para ${phoneNumber}`);
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
        const isTemplateNotApproved = templateError?.isTemplateNotApproved || false;
        const errorCode = templateError?.errorCode;

        // Detectar si el template no está aprobado o tiene problemas
        if (
          isTemplateNotApproved ||
          errorCode === 132001 || // Template not found
          errorCode === 132005 || // Template not approved
          errorCode === 132012 || // Template rejected
          errorMessage.includes('132001') ||
          errorMessage.includes('132005') ||
          errorMessage.includes('132012') ||
          errorMessage.includes('does not exist') ||
          errorMessage.toLowerCase().includes('revisión') ||
          errorMessage.toLowerCase().includes('not approved') ||
          errorMessage.toLowerCase().includes('pending') ||
          errorMessage.toLowerCase().includes('rejected')
        ) {
          this.logger.warn(
            `⚠️ Template 'appointment_confirme' no está aprobado o no disponible. ` +
            `Código de error: ${errorCode || 'N/A'}. ` +
            `Usando mensaje de texto como fallback. ` +
            `NOTA IMPORTANTE: El mensaje de texto solo funcionará si el usuario te escribió en las últimas 24h. ` +
            `Para enviar a números nuevos, el template 'appointment_confirme' DEBE estar aprobado en WhatsApp Business Manager.`
          );

          try {
            await this.whatsappService.sendTextMessage(phoneNumber, messageBuilder.build());
            this.logger.log(`✅ Confirmación enviada exitosamente con mensaje de texto a ${phoneNumber}`);
            this.logger.warn(
              `⚠️ IMPORTANTE: Este mensaje solo llegará si el usuario te escribió en las últimas 24 horas. ` +
              `Para números nuevos, necesitas que el template 'appointment_confirme' esté aprobado.`
            );
          } catch (textError: any) {
            this.logger.error(
              `❌ Error al enviar mensaje de texto: ${textError?.message}. ` +
              `El usuario probablemente no te ha escrito en las últimas 24 horas. ` +
              `SOLUCIÓN: Ve a WhatsApp Business Manager y asegúrate de que el template 'appointment_confirme' ` +
              `esté en estado "APPROVED" (Aprobado) para poder enviar mensajes a números nuevos.`
            );
            // No lanzar el error aquí, solo loguearlo para que el proceso continúe
          }
        } else {
          // Si es otro tipo de error, lanzarlo
          this.logger.error(`Error inesperado al enviar template:`, templateError);
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

  /**
   * Envía las credenciales de acceso al sistema por WhatsApp
   * @param name Nombre del usuario
   * @param email Email del usuario
   * @param password Contraseña temporal generada
   * @param phone Número de teléfono del usuario
   * @param userType Tipo de usuario (instructor, estudiante, usuario)
   */
  async sendSystemCredentials(
    name: string,
    email: string,
    password: string,
    phone: string,
    userType: 'instructor' | 'estudiante' | 'usuario' = 'usuario',
  ): Promise<void> {
    if (!phone) {
      this.logger.warn(`No se puede enviar credenciales: teléfono no proporcionado para ${email}`);
      return;
    }

    try {
      const phoneNumber = this.formatPhoneNumber(phone);
      const loginUrl = process.env.FRONTEND_URL || 
                       process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 
                       'http://localhost:3000';
      const fullLoginUrl = `${loginUrl}/login`;

      const userTypeLabel = {
        instructor: 'Instructor',
        estudiante: 'Estudiante',
        usuario: 'Usuario',
      }[userType];

      this.logger.log(`Enviando credenciales de acceso a ${phoneNumber} para ${email}`);

      // Usar mensaje interactivo directamente (sin template)
      try {
        const messageText = `¡Hola ${name}! 👋

✅ Tus credenciales de acceso al sistema han sido creadas:

📧 Email: ${email}
🔑 Contraseña: ${password}

Puedes acceder al sistema usando el botón de abajo.

⚠️ Te recomendamos cambiar tu contraseña después del primer acceso por seguridad.

¡Bienvenido a Pilates Oaxaca! 🧘‍♀️`;

        this.logger.log(`Enviando mensaje interactivo con credenciales para ${phoneNumber}`);

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
                display_text: 'Acceder al sistema',
                url: fullLoginUrl,
              },
            },
          },
        });

        this.logger.log(`✅ Credenciales enviadas exitosamente con mensaje interactivo a ${phoneNumber}`);
      } catch (interactiveError: any) {
        this.logger.error(
          `Error al enviar mensaje interactivo: ${interactiveError?.message}. ` +
          `Intentando con mensaje de texto como fallback.`
        );

        // Fallback: mensaje de texto (solo funciona si el usuario escribió en las últimas 24h)
        try {
          const textMessage = `¡Hola ${name}!

✅ Tus credenciales de acceso al sistema han sido creadas:

📧 Email: ${email}
🔑 Contraseña: ${password}

Accede aquí: ${fullLoginUrl}

⚠️ Te recomendamos cambiar tu contraseña después del primer acceso.

¡Bienvenido a Pilates Oaxaca! 🧘‍♀️`;

          await this.whatsappService.sendTextMessage(phoneNumber, textMessage);
          this.logger.log(`✅ Credenciales enviadas exitosamente con mensaje de texto a ${phoneNumber}`);
          this.logger.warn(
            `⚠️ IMPORTANTE: Este mensaje solo llegará si el usuario te escribió en las últimas 24 horas.`
          );
        } catch (textError: any) {
          this.logger.error(
            `❌ Error al enviar mensaje de texto: ${textError?.message}. ` +
            `El usuario probablemente no te ha escrito en las últimas 24 horas.`
          );
          // No lanzar el error aquí, solo loguearlo para que el proceso continúe
        }
      }
    } catch (error: any) {
      this.logger.error(
        `Error al enviar credenciales a ${phone}:`,
        error?.message || error,
      );
      // No lanzar el error para que el proceso de creación continúe
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
