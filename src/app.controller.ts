import { Controller, Get } from '@nestjs/common';

/** Raíz del API bajo el prefijo global `api` → GET /api */
@Controller()
export class AppController {
  @Get()
  getApiRoot() {
    return {
      ok: true,
      app: 'Organigrama Backend',
      hint: 'Usa /api/health, /api/org-chart/root, etc.',
    };
  }
}
