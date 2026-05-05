import { Controller, Get } from '@nestjs/common';

/** Punto de comprobación simple para monitoreo y smoke tests del API. */
@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      ok: true,
      app: 'Organigrama Backend',
      status: 'running',
    };
  }
}
