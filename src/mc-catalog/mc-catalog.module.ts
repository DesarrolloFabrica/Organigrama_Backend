import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McCatalogService } from './mc-catalog.service';
import { McMappingService } from './mc-catalog.mapping.service';
import { McPa2Service } from './mc-pa2.service';
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
} from './entities';

export const MC_CATALOG_ENTITIES = [
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
] as const;

/**
 * Catálogo MC1 + mappings + motor PA2 (MC1.3.3).
 * Sin HTTP / frontend / radar.
 */
@Module({
  imports: [TypeOrmModule.forFeature([...MC_CATALOG_ENTITIES])],
  providers: [McCatalogService, McMappingService, McPa2Service],
  exports: [
    McCatalogService,
    McMappingService,
    McPa2Service,
    TypeOrmModule,
  ],
})
export class McCatalogModule {}
