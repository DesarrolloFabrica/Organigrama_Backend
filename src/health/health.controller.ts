import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** Punto de comprobación simple para monitoreo y smoke tests del API. */
@Public()
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHealth() {
    return {
      ok: true,
      app: 'Organigrama Backend',
      status: 'running',
    };
  }

  /** Verifica la conectividad real a la base de datos con una consulta minima. */
  @Get('db')
  async getDbHealth() {
    try {
      await this.dataSource.query('SELECT 1');
      return { ok: true, db: 'connected' };
    } catch {
      throw new HttpException(
        { ok: false, db: 'unreachable' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
