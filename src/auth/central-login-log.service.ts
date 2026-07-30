import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class CentralLoginLogService implements OnModuleDestroy {
  private readonly pool: Pool | null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('LOGIN_LOGS_DB_HOST');
    if (!host) {
      this.pool = null;
      return;
    }

    const ssl =
      (this.config.get<string>('LOGIN_LOGS_DB_SSL') ?? 'true') === 'true'
        ? { rejectUnauthorized: false }
        : undefined;

    this.pool = new Pool({
      host,
      port: Number(this.config.get<string>('LOGIN_LOGS_DB_PORT') ?? 5432),
      database: this.config.get<string>('LOGIN_LOGS_DB_NAME') ?? 'core',
      user: this.config.get<string>('LOGIN_LOGS_DB_USER'),
      password: String(
        this.config.get<string>('LOGIN_LOGS_DB_PASSWORD') ?? '',
      ).replace(/^'|'$/g, ''),
      ssl,
      max: 2,
      connectionTimeoutMillis: 5000,
    });
  }

  async onModuleDestroy() {
    await this.pool?.end().catch(() => undefined);
  }

  /** Fire-and-forget. No tumba el login si falla. */
  record(
    email: string,
    appLogin:
      | 'nova'
      | 'actas'
      | 'acervo'
      | 'orbit'
      | 'organigrama' = 'organigrama',
  ) {
    const correo = String(email ?? '').trim().toLowerCase();
    if (!correo || !this.pool) return;

    void this.pool
      .query(
        `
        INSERT INTO logs.login_apps (correo, fecha, hora, app_login)
        VALUES (
          $1,
          (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date,
          (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::time,
          $2
        )
        `,
        [correo, appLogin],
      )
      .catch((error) => {
        console.warn('[CentralLoginLog] No se pudo registrar login:', error);
      });
  }
}
