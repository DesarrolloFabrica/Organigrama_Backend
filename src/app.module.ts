import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
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
import {
  buildPgPoolExtra,
  createTypeOrmDataSource,
} from './database/typeorm-data-source.factory';
import { GoogleWorkspaceModule } from './google-workspace/google-workspace.module';
import { OrgVisualRelation } from './org-chart/entities/org-visual-relation.entity';
import { OrgVisualRelationOverride } from './org-chart/entities/org-visual-relation-override.entity';
import { OrgVisualRelationPositionChild } from './org-chart/entities/org-visual-relation-position-child.entity';
import { OrgChartVersion } from './org-chart/entities/org-chart-version.entity';
import { OrgChartPersonOverride } from './org-chart/entities/org-chart-person-override.entity';
import { Vacancy } from './org-chart/vacancies/entities/vacancy.entity';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { PersonProfileState } from './profile/entities/person-profile-state.entity';
import { PersonPermission } from './permissions/entities/person-permission.entity';
import { CvSkillsModule } from './cv-skills/cv-skills.module';
import { CvSkillsEnrichmentModule } from './cv-skills-enrichment/cv-skills-enrichment.module';
import { CvEvidenceModule } from './cv-evidence/cv-evidence.module';
import {
  CvEvidenceEvaluation,
  CvEvidenceEvaluationItem,
} from './cv-evidence/entities';
import { CvAttributesModule } from './cv-attributes/cv-attributes.module';
import {
  CvAttributeCatalogVersion,
  CvAttributeResultSkill,
  CvAttributeRun,
  CvMacroattribute,
  CvMacroattributeResult,
  CvSkillAttributeMapping,
  CvSubattribute,
  CvSubattributeResult,
} from './cv-attributes/entities';
import { McCatalogModule } from './mc-catalog/mc-catalog.module';
import {
  McCatalogVersion,
  McDomain,
  McEvaluationSet,
  McEvaluationSetDomain,
  McMappingPackRelease,
  McProfileEvaluation,
  McProfileSpecialtyResult,
  McSkillDomainClassification,
  McSkillSpecialtyMapping,
  McSpecialty,
} from './mc-catalog/entities';
import { McCvSnapshot } from './mc-pipeline/entities/mc-cv-snapshot.entity';
import { McPipelineModule } from './mc-pipeline/mc-pipeline.module';
import { Mc1ProfilePreviewModule } from './mc-pipeline/preview/mc1-profile-preview.module';
import {
  CvSkillEnrichment,
  CvSkillEnrichmentBlock,
  CvSkillEnrichmentItem,
} from './cv-skills-enrichment/entities';
import {
  CvExtraction,
  CvExtractionCertification,
  CvExtractionLanguage,
  CvExtractionSkill,
  CvSkill,
  CvSkillAlias,
} from './cv-skills/entities';

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
        const host = config.get<string>('DB_HOST') || 'localhost';
        const dbName = config.get<string>('DB_NAME');
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

        const isProd = config.get<string>('NODE_ENV') === 'production';
        const poolExtra = buildPgPoolExtra(isProd);

        return {
          type: 'postgres' as const,
          host,
          port: parseInt(config.get<string>('DB_PORT', '5432'), 10),
          username: config.get<string>('DB_USERNAME'),
          password: config.get<string>('DB_PASSWORD'),
          database: dbName,
          schema,
          /** Producción: pocos reintentos + timeout corto (Cloud Run ya tiene el puerto abierto). */
          retryAttempts: isProd ? 2 : 10,
          retryDelay: isProd ? 1000 : 3000,
          extra: poolExtra,
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
            OrgVisualRelationOverride,
            OrgVisualRelationPositionChild,
            OrgChartVersion,
            OrgChartPersonOverride,
            Vacancy,
            PersonProfileState,
            PersonPermission,
            CvSkill,
            CvSkillAlias,
            CvExtraction,
            CvExtractionSkill,
            CvExtractionLanguage,
            CvExtractionCertification,
            CvSkillEnrichment,
            CvSkillEnrichmentBlock,
            CvSkillEnrichmentItem,
            CvEvidenceEvaluation,
            CvEvidenceEvaluationItem,
            CvAttributeCatalogVersion,
            CvMacroattribute,
            CvSubattribute,
            CvSkillAttributeMapping,
            CvAttributeRun,
            CvSubattributeResult,
            CvMacroattributeResult,
            CvAttributeResultSkill,
            McCatalogVersion,
            McDomain,
            McSpecialty,
            McSkillDomainClassification,
            McSkillSpecialtyMapping,
            McProfileEvaluation,
            McProfileSpecialtyResult,
            McMappingPackRelease,
            McEvaluationSet,
            McEvaluationSetDomain,
            McCvSnapshot,
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
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error(
            'TypeORM dataSourceFactory recibió options indefinidas.',
          );
        }
        return createTypeOrmDataSource(options, new Logger('TypeORM'));
      },
    }),
    AuthModule,
    ProfileModule,
    HealthModule,
    OrgChartModule,
    GoogleWorkspaceModule,
    CvSkillsModule,
    CvSkillsEnrichmentModule,
    CvEvidenceModule,
    CvAttributesModule,
    McCatalogModule,
    McPipelineModule,
    Mc1ProfilePreviewModule,
  ],
  controllers: [AppController],
  providers: [OrganigramaDemoSeedBootstrap],
})
export class AppModule {}
