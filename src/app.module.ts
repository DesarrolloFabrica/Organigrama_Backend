import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from './person/entities/person.entity';
import { HealthModule } from './health/health.module';
import { OrgChartModule } from './org-chart/org-chart.module';
import { Role } from './catalogs/entities/role.entity';
import { Hierarchy } from './catalogs/entities/hierarchy.entity';
import { Area } from './catalogs/entities/area.entity';
import { School } from './catalogs/entities/school.entity';
import { Program } from './catalogs/entities/program.entity';
import { City } from './catalogs/entities/city.entity';
import { Campus } from './catalogs/entities/campus.entity';
import { ContractType } from './catalogs/entities/contract-type.entity';
import { Region } from './catalogs/entities/region.entity';
import { OrganigramaDemoSeedBootstrap } from './database/organigrama-demo-seed.bootstrap';
import { OrgVisualRelation } from './org-chart/entities/org-visual-relation.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Solo lee .env. El archivo .env.local queda como respaldo manual/local
      // y NO se carga automaticamente para evitar que sobreescriba la config Core.
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('DB_HOST', 'localhost');
        const dbName = config.get<string>('DB_NAME', 'organigrama');
        const schema = config.get<string>('DB_SCHEMA') || undefined;
        const useSsl =
          config.get<string>('DB_SSL', 'false') === 'true' &&
          !host.startsWith('/cloudsql/');

        const logger = new Logger('TypeORM');
        logger.log(
          `Conectando a DB: ${dbName} en ${host}${schema ? ` (schema: ${schema})` : ''}`,
        );
        console.log({
          host: process.env.DB_HOST,
          port: process.env.DB_PORT,
          database: process.env.DB_NAME,
          schema: process.env.DB_SCHEMA,
        });

        return {
          type: 'postgres' as const,
          host,
          port: parseInt(config.get<string>('DB_PORT', '5432'), 10),
          username: config.get<string>('DB_USERNAME', 'postgres'),
          password: config.get<string>('DB_PASSWORD', 'postgres'),
          database: dbName,
          schema,
          entities: [
            Person,
            Role,
            Hierarchy,
            Area,
            School,
            Program,
            City,
            Campus,
            ContractType,
            Region,
            OrgVisualRelation,
          ],
          /**
           * Solo para desarrollo: genera/actualiza tablas desde las entidades.
           * En producción usar migraciones y `DB_SYNCHRONIZE=false`.
           */
          synchronize: config.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
          logging: config.get<string>('DB_LOGGING', 'false') === 'true',
          ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
        };
      },
    }),
    HealthModule,
    OrgChartModule,
  ],
  providers: [OrganigramaDemoSeedBootstrap],
})
export class AppModule {}
