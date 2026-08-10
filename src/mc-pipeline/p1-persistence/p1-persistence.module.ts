import { Module, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  createP1PersistenceService,
  P1PersistenceService,
} from './p1-persistence.service';
import type { P1PersistenceMode } from './p1-persistence.types';

export const P1_PERSISTENCE_MODE = 'P1_PERSISTENCE_MODE';

/**
 * Módulo opcional. Por defecto DRY_RUN (sin writers).
 * No se registra en AppModule todavía — solo bootstraps MDE / tests.
 */
@Module({
  providers: [
    {
      provide: P1_PERSISTENCE_MODE,
      useValue: 'DRY_RUN' as P1PersistenceMode,
    },
    {
      provide: P1PersistenceService,
      inject: [P1_PERSISTENCE_MODE, { token: DataSource, optional: true }],
      useFactory: (mode: P1PersistenceMode, ds?: DataSource) => {
        if (mode === 'PERSIST_MDE') {
          if (!ds) {
            throw new Error('PERSIST_MDE requires DataSource');
          }
          return createP1PersistenceService({ mode, dataSource: ds });
        }
        return createP1PersistenceService({ mode });
      },
    },
  ],
  exports: [P1PersistenceService],
})
export class P1PersistenceModule {}

void Optional;
