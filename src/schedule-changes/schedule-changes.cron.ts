import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduleChangesService } from './schedule-changes.service';

@Injectable()
export class ScheduleChangesCron {
  private readonly logger = new Logger(ScheduleChangesCron.name);

  constructor(private readonly scheduleChangesService: ScheduleChangesService) {}

  /**
   * Cron job que se ejecuta cada día a las 11:00 PM
   * Procesa las bajas temporales y cancela las registraciones futuras
   * Formato cron: '0 23 * * *' = minuto 0, hora 23 (11 PM), todos los días
   */
  @Cron('0 23 * * *', {
    name: 'process-temporary-leaves',
    timeZone: 'America/Mexico_City', // Ajustar según la zona horaria del servidor
  })
  async handleProcessTemporaryLeaves() {
    this.logger.log('Iniciando procesamiento de bajas temporales...');
    
    try {
      const result = await this.scheduleChangesService.processTemporaryLeaves();
      
      this.logger.log(
        `Procesamiento completado: ${result.processedLeaves} bajas procesadas, ` +
        `${result.cancelledRegistrations} registraciones canceladas`,
      );
    } catch (error) {
      this.logger.error(
        'Error al procesar bajas temporales:',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
