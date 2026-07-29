/**
 * MC1.6.1B.2 — Backfill inequívoco de metadatos de contexto en evaluaciones.
 *
 * Solo rellena columnas NULL cuando el valor es demostrable:
 * - source_hash ← extraction.pdf_sha256 (si == enrichment.pdf_sha256)
 * - mapping_pack_* ← pack registrado cuyo content_hash == evaluation.mapping_hash
 * - algorithm_version ← fingerprint de regla si config_hash coincide
 * - evaluation_context_hash ← recalculado cuando todos los inputs están
 *
 * También publica mc_mapping_pack_release para packs conocidos.
 *
 * Uso:
 *   node dist/.../mc161b2-backfill-context.js --dry-run
 *   node dist/.../mc161b2-backfill-context.js --i-confirm-backfill
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { computeMcMappingPackHash } from '../../mc-catalog/mc-catalog.mapping-hash';
import { resolveMcMappingPack } from '../../mc-catalog/mc-catalog.mapping-registry';
import { McMappingService } from '../../mc-catalog/mc-catalog.mapping.service';
import { buildMcEvaluationContext } from '../../mc-catalog/mc-evaluation-context';
import {
  resolveMcPa2AlgorithmVersion,
} from '../../mc-catalog/mc-pa2.algorithm';
import {
  computeMcPa2ConfigHash,
  resolveMcPa2EngineConfig,
} from '../../mc-catalog/mc-pa2.config';

type Row = {
  id: string;
  person_id: string;
  domain_code: string;
  engine_rules_version: string;
  config_hash: string;
  mapping_hash: string;
  catalog_version_id: string;
  catalog_version: string;
  extraction_id: string;
  enrichment_id: string;
  evidence_evaluation_id: string;
  mapping_pack_code: string | null;
  mapping_pack_version: string | null;
  source_hash: string | null;
  algorithm_version: string | null;
  evaluation_context_hash: string | null;
  extraction_hash: string;
  enrichment_hash: string;
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const confirm = process.argv.includes('--i-confirm-backfill');
  if (!dryRun && !confirm) {
    throw new Error('Use --dry-run o --i-confirm-backfill');
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);
  const mappingService = app.get(McMappingService);

  // Publicar releases actuales (idempotente)
  for (const domain of ['SOFTWARE', 'VISUAL_DESIGN']) {
    const reg = resolveMcMappingPack(domain);
    const hash = computeMcMappingPackHash(reg.pack);
    if (!dryRun) {
      await mappingService.publishOrAssertPackRelease({
        packCode: reg.packCode,
        packVersion: reg.mappingRulesVersion,
        domainCode: reg.pack.domainCode,
        contentHash: hash,
        sourceRef: reg.pack.sourceRef ?? null,
      });
    }
  }

  const rows = (await ds.query(
    `SELECT e.id::text, e.person_id::text, e.domain_code,
            e.engine_rules_version, e.config_hash, e.mapping_hash,
            e.catalog_version_id::text, cv.version AS catalog_version,
            e.extraction_id::text, e.enrichment_id::text,
            e.evidence_evaluation_id::text,
            e.mapping_pack_code, e.mapping_pack_version, e.source_hash,
            e.algorithm_version, e.evaluation_context_hash,
            x.pdf_sha256 AS extraction_hash,
            en.pdf_sha256 AS enrichment_hash
       FROM organigrama.mc_profile_evaluation e
       JOIN organigrama.mc_catalog_version cv ON cv.id = e.catalog_version_id
       JOIN organigrama.cv_extraction x ON x.id = e.extraction_id
       JOIN organigrama.cv_skill_enrichment en ON en.id = e.enrichment_id
      ORDER BY e.id`,
  )) as Row[];

  const plan = rows.map((r) => {
    let packStatus: 'RECONSTRUIBLE' | 'NO RECONSTRUIBLE' = 'NO RECONSTRUIBLE';
    let sourceStatus: 'RECONSTRUIBLE' | 'NO RECONSTRUIBLE' = 'NO RECONSTRUIBLE';
    let packCode = r.mapping_pack_code;
    let packVersion = r.mapping_pack_version;
    let sourceHash = r.source_hash;
    let algorithmVersion = r.algorithm_version;
    const notes: string[] = [];

    const extHash = String(r.extraction_hash || '').toLowerCase();
    const enrHash = String(r.enrichment_hash || '').toLowerCase();
    if (extHash && extHash === enrHash) {
      sourceStatus = 'RECONSTRUIBLE';
      if (!sourceHash) sourceHash = extHash;
    } else {
      notes.push('extraction/enrichment hash diverge');
    }

    try {
      const reg = resolveMcMappingPack(r.domain_code);
      const hash = computeMcMappingPackHash(reg.pack);
      if (hash === r.mapping_hash) {
        packStatus = 'RECONSTRUIBLE';
        if (!packCode) packCode = reg.packCode;
        if (!packVersion) packVersion = reg.mappingRulesVersion;
      } else {
        notes.push('mapping_hash != pack registrado actual');
      }
    } catch (e) {
      notes.push(String((e as Error).message));
    }

    try {
      const cfg = resolveMcPa2EngineConfig(r.engine_rules_version);
      if (computeMcPa2ConfigHash(cfg) === r.config_hash) {
        if (!algorithmVersion) {
          algorithmVersion = resolveMcPa2AlgorithmVersion(cfg.rankingStrategy);
        }
      } else {
        notes.push('config_hash != regla actual');
      }
    } catch (e) {
      notes.push(String((e as Error).message));
    }

    let contextHash = r.evaluation_context_hash;
    let action = 'SKIP';
    if (
      packCode &&
      packVersion &&
      sourceHash &&
      algorithmVersion &&
      (!r.mapping_pack_code ||
        !r.mapping_pack_version ||
        !r.source_hash ||
        !r.algorithm_version ||
        !r.evaluation_context_hash)
    ) {
      contextHash = buildMcEvaluationContext({
        personId: r.person_id,
        domainCode: r.domain_code,
        catalogVersion: r.catalog_version,
        catalogVersionId: r.catalog_version_id,
        sourceHash,
        mappingPackCode: packCode,
        mappingPackVersion: packVersion,
        mappingHash: r.mapping_hash,
        engineRulesVersion: r.engine_rules_version,
        algorithmVersion,
        configHash: r.config_hash,
        extractionId: r.extraction_id,
        enrichmentId: r.enrichment_id,
        evidenceEvaluationId: r.evidence_evaluation_id,
      }).evaluationContextHash;
      action = 'BACKFILL';
    }

    return {
      evaluationId: r.id,
      personId: r.person_id,
      domain: r.domain_code,
      packStatus,
      sourceStatus,
      action,
      values: {
        mapping_pack_code: packCode,
        mapping_pack_version: packVersion,
        source_hash: sourceHash,
        algorithm_version: algorithmVersion,
        evaluation_context_hash: contextHash,
      },
      notes,
    };
  });

  if (!dryRun) {
    for (const p of plan.filter((x) => x.action === 'BACKFILL')) {
      await ds.query(
        `UPDATE organigrama.mc_profile_evaluation
            SET mapping_pack_code = COALESCE(mapping_pack_code, $2),
                mapping_pack_version = COALESCE(mapping_pack_version, $3),
                source_hash = COALESCE(source_hash, $4),
                algorithm_version = COALESCE(algorithm_version, $5),
                evaluation_context_hash = COALESCE(evaluation_context_hash, $6),
                updated_at = NOW()
          WHERE id = $1
            AND (
              mapping_pack_code IS NULL OR mapping_pack_version IS NULL
              OR source_hash IS NULL OR algorithm_version IS NULL
              OR evaluation_context_hash IS NULL
            )`,
        [
          p.evaluationId,
          p.values.mapping_pack_code,
          p.values.mapping_pack_version,
          p.values.source_hash,
          p.values.algorithm_version,
          p.values.evaluation_context_hash,
        ],
      );
    }
  }

  const out = {
    phase: 'MC1.6.1B.2-backfill',
    dryRun,
    plan,
    summary: {
      total: plan.length,
      backfill: plan.filter((p) => p.action === 'BACKFILL').length,
      skip: plan.filter((p) => p.action === 'SKIP').length,
      packReconstruible: plan.filter((p) => p.packStatus === 'RECONSTRUIBLE')
        .length,
      sourceReconstruible: plan.filter(
        (p) => p.sourceStatus === 'RECONSTRUIBLE',
      ).length,
    },
  };
  mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
  const path = resolve(process.cwd(), 'tmp/mc161b2-backfill.json');
  writeFileSync(path, JSON.stringify(out, null, 2), 'utf8');
  console.log(JSON.stringify(out, null, 2));
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
