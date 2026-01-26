import { Event } from 'src/calendar/entities/event.entity';
import { Aspirante } from 'src/aspirantes/entities/aspirante.entity';

export class AspirantRegistrationMessage {
  public readonly firstName: string;
  public readonly fechaFormateada: string;
  public readonly hora: string;
  public readonly estudioNombre: string;

  constructor(aspirant: Aspirante, valoracionEvent: Event) {
    this.firstName = aspirant.firstName;
    this.fechaFormateada = this.formatDate(valoracionEvent.date);
    this.hora = valoracionEvent.time;
    this.estudioNombre = valoracionEvent.location || 'Estudio';
  }

  build(): string {
    return `¡Hola ${this.firstName}! 👋

✅ Tu registro de valoración ha sido confirmado:

📅 Fecha: ${this.fechaFormateada}
🕐 Hora: ${this.hora}
📍 Estudio: ${this.estudioNombre}

Te esperamos en tu clase de valoración. Si tienes alguna pregunta, no dudes en contactarnos.

¡Nos vemos pronto! 🧘‍♀️`;
  }

  private formatDate(date: string | Date): string {
    const fechaDate = typeof date === 'string' ? new Date(date) : date;
    return fechaDate.toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}
