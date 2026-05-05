import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from './person/person.entity';
import { HealthModule } from './health/health.module';
import { OrgRelation } from './org-chart/entities/org-relation.entity';
import { OrgChartModule } from './org-chart/org-chart.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Permite `.env` local sin commitear (ver `.env.example`).
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: parseInt(config.get<string>('DB_PORT', '5432'), 10),
        username: config.get<string>('DB_USER', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'organigrama'),
        entities: [Person, OrgRelation],
        /**
         * Solo para desarrollo: genera/actualiza tablas desde las entidades.
         * En producción usar migraciones y `DB_SYNCHRONIZE=false`.
         */
        synchronize: config.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
        logging: config.get<string>('DB_LOGGING', 'false') === 'true',
      }),
    }),
    HealthModule,
    OrgChartModule,
  ],
})
export class AppModule {}
