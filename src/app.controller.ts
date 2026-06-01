import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator';

/** Raíz del API bajo el prefijo global `api` → GET /api */
@Public()
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
