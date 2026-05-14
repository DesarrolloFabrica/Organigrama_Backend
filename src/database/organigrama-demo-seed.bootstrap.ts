import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { seedOrganigramaDemoIfEmpty } from './organigrama-demo.seed';

/**
 * Si `RUN_DEMO_SEED=true`, ejecuta el seed demo al arrancar (solo si `person` está vacía).
 * Útil en el primer despliegue contra una BD nueva; luego desactivar la variable.
 */
@Injectable()
export class OrganigramaDemoSeedBootstrap implements OnModuleInit {
  private readonly log = new Logger(OrganigramaDemoSeedBootstrap.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    if (process.env.RUN_DEMO_SEED !== 'true') {
      return;
    }
    await seedOrganigramaDemoIfEmpty(this.dataSource);
    this.log.log('RUN_DEMO_SEED: seed demo revisado o aplicado.');
  }
}
