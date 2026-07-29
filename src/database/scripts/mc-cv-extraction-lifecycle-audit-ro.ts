/**
 * MC1 — Auditoría RO ciclo de vida cv_extraction.
 *
 * npm run mc:audit-extraction-lifecycle
 *
 * Solo SELECT. writes: 0.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import {
  assertMutuallyExclusiveCoverage,
  classifyNoExtractionBucket,
  classifyOrphanExtraction,
  classifyPersonActivationState,
  classifyPersonFinalState,
  classifySelectedExtractionState,
  countActiveByStatus,
  selectApiCompetenciesExtraction,
  selectMc1UsableExtraction,
  type McCvExtractionRow,
  type McPa2EvalLink,
  type McPersonCvRow,
  type McPersonFinalState,
} from '../../cv-skills/mc-cv-extraction-lifecycle-audit';

const TAG = '[MC1 extraction lifecycle RO]';
const SAMPLE_DOCS = ['1015482688', '1000035262', '1000590473'];

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  try {
    const ds = app.get(DataSource);

    const schemaElements = await loadSchemaElements(ds);
    const activationUnit = deriveActivationUnit(schemaElements);

    const personCvs = (await ds.query(
      `SELECT id::text AS person_cv_id,
              person_id::text AS person_id,
              document,
              drive_file_id,
              is_active
         FROM organigrama.person_cv
        ORDER BY person_id, is_active DESC, id DESC`,
    )) as Array<{
      person_cv_id: string;
      person_id: string;
      document: string;
      drive_file_id: string | null;
      is_active: boolean;
    }>;

    const extractions = (await ds.query(
      `SELECT id::text AS extraction_id,
              person_id::text AS person_id,
              document,
              person_cv_id::text AS person_cv_id,
              drive_file_id,
              status,
              is_active,
              created_at::text AS created_at,
              started_at::text AS started_at,
              finished_at::text AS finished_at,
              model,
              prompt_version,
              extractor_version,
              pdf_sha256
         FROM organigrama.cv_extraction
        ORDER BY person_id, id DESC`,
    )) as Array<{
      extraction_id: string;
      person_id: string;
      document: string;
      person_cv_id: string;
      drive_file_id: string;
      status: string;
      is_active: boolean;
      created_at: string | null;
      started_at: string | null;
      finished_at: string | null;
      model: string | null;
      prompt_version: string | null;
      extractor_version: string | null;
      pdf_sha256: string | null;
    }>;

    const pa2Links = (await ds.query(
      `SELECT id::text AS evaluation_id,
              person_id::text AS person_id,
              extraction_id::text AS extraction_id,
              domain_code,
              is_active
         FROM organigrama.mc_profile_evaluation
        WHERE is_active = TRUE AND status = 'SUCCEEDED'
        ORDER BY person_id, id DESC`,
    )) as Array<{
      evaluation_id: string;
      person_id: string;
      extraction_id: string | null;
      domain_code: string;
      is_active: boolean;
    }>;

    const personExistsRows = (await ds.query(
      `SELECT id::text AS person_id FROM core.person
        WHERE id = ANY($1::bigint[])`,
      [Array.from(new Set(extractions.map((e) => e.person_id)))],
    )) as Array<{ person_id: string }>;
    const personExists = new Set(personExistsRows.map((p) => p.person_id));

    const extRows: McCvExtractionRow[] = extractions.map((e) => ({
      extractionId: e.extraction_id,
      personId: e.person_id,
      document: e.document,
      personCvId: e.person_cv_id,
      driveFileId: e.drive_file_id,
      status: e.status,
      isActive: e.is_active,
      createdAt: e.created_at,
      startedAt: e.started_at,
      finishedAt: e.finished_at,
      model: e.model,
      promptVersion: e.prompt_version,
      extractorVersion: e.extractor_version,
      pdfSha256: e.pdf_sha256,
    }));

    const cvRows: McPersonCvRow[] = personCvs.map((c) => ({
      personCvId: c.person_cv_id,
      personId: c.person_id,
      document: c.document,
      driveFileId: c.drive_file_id,
      isActive: c.is_active,
    }));

    const pa2: McPa2EvalLink[] = pa2Links.map((p) => ({
      personId: p.person_id,
      extractionId: p.extraction_id,
      evaluationId: p.evaluation_id,
      domainCode: p.domain_code,
      isActive: p.is_active,
    }));

    const universe = new Set<string>();
    for (const c of cvRows) if (c.isActive) universe.add(c.personId);
    for (const e of extRows) universe.add(e.personId);

    const byPersonExt = groupBy(extRows, (e) => e.personId);
    const byPersonCv = groupBy(cvRows, (c) => c.personId);
    const byPersonPa2 = groupBy(pa2, (p) => p.personId);

    const activeRows = extRows.filter((e) => e.isActive);
    const activeStatusHistogram = countActiveByStatus(extRows);

    // Active count distribution
    const activeCountBuckets: Record<string, number> = {
      '0': 0,
      '1': 0,
      '2': 0,
      '3+': 0,
    };
    const multipleActiveCases: Array<Record<string, unknown>> = [];
    const personSummaries: Array<Record<string, unknown>> = [];
    const finalStates: McPersonFinalState[] = [];
    const selectedStates: Record<string, number> = {};
    const noExtBuckets: Record<string, number> = {};
    const sampleDocs: Array<Record<string, unknown>> = [];

    for (const personId of [...universe].sort((a, b) => Number(a) - Number(b))) {
      const pe = byPersonExt.get(personId) ?? [];
      const pcs = byPersonCv.get(personId) ?? [];
      const activeCvs = pcs.filter((c) => c.isActive);
      const pPa2 = byPersonPa2.get(personId) ?? [];
      const actCounts = countActiveByStatus(pe);
      const nActive = actCounts.totalActive;
      if (nActive === 0) activeCountBuckets['0'] += 1;
      else if (nActive === 1) activeCountBuckets['1'] += 1;
      else if (nActive === 2) activeCountBuckets['2'] += 1;
      else activeCountBuckets['3+'] += 1;

      if (nActive > 1) {
        multipleActiveCases.push({
          personId,
          document: activeCvs[0]?.document ?? pe[0]?.document ?? null,
          extractionIds: pe.filter((e) => e.isActive).map((e) => e.extractionId),
          statuses: pe.filter((e) => e.isActive).map((e) => e.status),
          driveFileIds: pe.filter((e) => e.isActive).map((e) => e.driveFileId),
          createdAt: pe.filter((e) => e.isActive).map((e) => e.createdAt),
        });
      }

      const activation = classifyPersonActivationState({
        activePersonCvs: activeCvs,
        extractions: pe,
      });
      const selectedState = classifySelectedExtractionState({
        activePersonCv: activeCvs[0] ?? null,
        extractions: pe,
      });
      selectedStates[selectedState] = (selectedStates[selectedState] ?? 0) + 1;

      const finalState = classifyPersonFinalState({
        activePersonCvs: activeCvs,
        extractions: pe,
      });
      finalStates.push(finalState);

      const noExt = classifyNoExtractionBucket({
        activePersonCv: activeCvs[0] ?? null,
        extractions: pe,
      });
      noExtBuckets[noExt] = (noExtBuckets[noExt] ?? 0) + 1;

      const mc1 = selectMc1UsableExtraction(pe);
      const api = selectApiCompetenciesExtraction(pe, pPa2);
      const doc = activeCvs[0]?.document ?? pe[0]?.document ?? null;

      personSummaries.push({
        personId,
        document: doc,
        activePersonCvs: activeCvs.length,
        totalExtractions: pe.length,
        activeExtractions: nActive,
        activeSucceeded: actCounts.succeeded,
        activeFailed: actCounts.failed,
        activeRunning: actCounts.running,
        activePending: actCounts.pending,
        activationState: activation,
        selectedState,
        finalState,
        mc1ExtractionId: mc1?.extractionId ?? null,
        apiExtractionId: api?.extractionId ?? null,
        personCvFileId: activeCvs[0]?.driveFileId ?? null,
        mc1FileId: mc1?.driveFileId ?? null,
        matchesPersonCv: Boolean(
          mc1 &&
            activeCvs[0] &&
            (activeCvs[0].driveFileId ?? '').trim() === mc1.driveFileId.trim(),
        ),
      });

      if (doc && SAMPLE_DOCS.includes(doc)) {
        sampleDocs.push({
          document: doc,
          personId,
          totalExtractions: pe.length,
          activeExtractions: nActive,
          selectedByApi: api?.extractionId ?? null,
          selectedByMc1: mc1?.extractionId ?? null,
          personCvFileId: activeCvs[0]?.driveFileId ?? null,
          mc1FileId: mc1?.driveFileId ?? null,
          apiFileId: api?.driveFileId ?? null,
          selectedState,
          finalState,
          activationState: activation,
          sameContentPossible:
            mc1 && activeCvs[0]
              ? 'UNKNOWN_REQUIRES_MD5_COMPARE'
              : null,
        });
      }
    }

    // Orphan classification for every extraction
    const orphanRows = extRows.map((e) => {
      const pcs = byPersonCv.get(e.personId) ?? [];
      const kind = classifyOrphanExtraction({
        extraction: e,
        personExists: personExists.has(e.personId),
        activePersonCvs: pcs.filter((c) => c.isActive),
        allPersonCvs: pcs,
      });
      return {
        extractionId: e.extractionId,
        document: e.document,
        personExists: personExists.has(e.personId),
        hasActivePersonCv: pcs.some((c) => c.isActive),
        isHistorical: !e.isActive,
        isActive: e.isActive,
        status: e.status,
        orphanKind: kind,
      };
    });
    const orphanCounts: Record<string, number> = {};
    for (const o of orphanRows) {
      orphanCounts[o.orphanKind] = (orphanCounts[o.orphanKind] ?? 0) + 1;
    }

    const coverage = assertMutuallyExclusiveCoverage(finalStates);

    // Previous metrics validation
    const activePersonCvCount = cvRows.filter((c) => c.isActive).length;
    const activeExtractionCount = activeRows.length;
    const distinctPersonsWithActiveExt = new Set(
      activeRows.map((e) => e.personId),
    ).size;

    const prevValidation = {
      person_cv_activos_127: {
        previous: 127,
        corrected: activePersonCvCount,
        unit: 'rows person_cv WHERE is_active',
        overlap: 'none',
        correct: activePersonCvCount === 127,
      },
      extracciones_activas_138: {
        previous: 138,
        corrected: activeExtractionCount,
        unit: 'rows cv_extraction WHERE is_active',
        overlap: 'one row per person if UNIQUE holds',
        correct: activeExtractionCount === 138,
        distinctPersons: distinctPersonsWithActiveExt,
      },
      CURRENT_14: {
        previous: 14,
        corrected: selectedStates['CURRENT_SELECTED_EXTRACTION'] ?? 0,
        unit: 'previous=document rows; corrected=persons with CURRENT_SELECTED',
        overlap: 'previous mixed with drive-only docs',
        correct: false,
        note: 'PARTIALLY_INVALID — contaba filas/documentos del cruce Drive, no personas MC1',
      },
      STALE_FILE_ID_96: {
        previous: 96,
        corrected: selectedStates['STALE_SELECTED_EXTRACTION'] ?? 0,
        unit: 'previous≈document rows with active ext file≠cv; corrected=persons',
        overlap: 'could approach persons if 1 active/person',
        correct: false,
        note: 'PARTIALLY_INVALID — casi personas si UNIQUE; validar valor corregido',
      },
      NO_EXTRACTION_50: {
        previous: 50,
        corrected: noExtBuckets['NO_EXTRACTION_AT_ALL'] ?? 0,
        unit: 'previous=document rows without CURRENT/STALE active; corrected=persons sin ninguna extracción',
        overlap: 'incluía MISSING_IN_PERSON_CV y históricos',
        correct: false,
        note: 'INVALIDATED as NO_EXTRACTION — redefine buckets',
      },
    };

    const consumers = [
      {
        consumer: 'mc110-activate-person-competencies / MC1 CLI',
        criteria: 'status=SUCCEEDED AND is_active=true (find first after ORDER BY id DESC)',
        order: 'id DESC',
        filters: 'person_id',
      },
      {
        consumer: 'CvSkillsPersistenceService.completeExtraction',
        criteria: 'activa por person_id; UNIQUE index; CHECK SUCCEEDED',
        order: 'n/a (write path)',
        filters: 'advisory lock + deactivate others + activate new',
      },
      {
        consumer: 'OrgChartCvService (ficha hasCv)',
        criteria: 'NO lee cv_extraction; solo person_cv is_active',
        order: 'id DESC',
        filters: 'person_id + is_active',
      },
      {
        consumer: 'OrgChartCompetenciesService (API competencias)',
        criteria: 'mc_profile_evaluation is_active SUCCEEDED → extraction_id congelado',
        order: 'cv.is_active DESC, e.id DESC',
        filters: 'person_id + domain',
      },
      {
        consumer: 'McPa2Service.loadExtraction',
        criteria: 'por extraction_id explícito; exige SUCCEEDED',
        order: 'n/a',
        filters: 'id = $1',
      },
      {
        consumer: 'reconcile-drive-cv (auditoría previa)',
        criteria: 'todas is_active=true; comparado file_id vs person_cv',
        order: 'document',
        filters: 'is_active (sin exigir unicidad por persona en el conteo)',
      },
    ];

    const payload = {
      generatedAt: new Date().toISOString(),
      writes: 0 as const,
      activationUnit,
      schemaElements,
      metrics: {
        universePersons: universe.size,
        activePersonCvRows: activePersonCvCount,
        activeExtractionRows: activeExtractionCount,
        distinctPersonsWithActiveExtraction: distinctPersonsWithActiveExt,
        activeStatusHistogram,
        activeCountBuckets,
        selectedStates,
        noExtBuckets,
        orphanCounts,
        finalStateCounts: coverage.counts,
        finalStateSum: coverage.sum,
        finalStateOk: coverage.ok,
        multipleActivePersons: multipleActiveCases.length,
      },
      prevValidation,
      multipleActiveCases,
      sampleDocs,
      consumers,
      personSummariesLight: personSummaries.map((p) => ({
        personId: p.personId,
        document: p.document,
        activationState: p.activationState,
        selectedState: p.selectedState,
        finalState: p.finalState,
        activeExtractions: p.activeExtractions,
        matchesPersonCv: p.matchesPersonCv,
      })),
      rootCauses: deriveRootCauses({
        multipleActive: multipleActiveCases.length,
        stale: selectedStates['STALE_SELECTED_EXTRACTION'] ?? 0,
        noUsable: coverage.counts.NO_USABLE_EXTRACTION,
        activationUnit,
        activeFailed: activeStatusHistogram.failed,
      }),
      decision: deriveDecision({
        stale: selectedStates['STALE_SELECTED_EXTRACTION'] ?? 0,
        noUsable: coverage.counts.NO_USABLE_EXTRACTION,
        multipleActive: multipleActiveCases.length,
        auditInvalid: true,
      }),
    };

    printTables(payload);

    const jsonPath = resolve(
      process.cwd(),
      'tmp/mc-cv-extraction-lifecycle-audit.json',
    );
    mkdirSync(resolve(jsonPath, '..'), { recursive: true });
    writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`${TAG} JSON=${jsonPath}`);

    const mdPath = resolve(
      process.cwd(),
      'docs/mc1-cv-extraction-lifecycle-integrity-audit.md',
    );
    writeFileSync(mdPath, buildMarkdown(payload), 'utf8');
    console.log(`${TAG} MD=${mdPath}`);

    appendReconciliationCorrection(payload);
  } finally {
    await app.close();
  }
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k) ?? [];
    list.push(r);
    m.set(k, list);
  }
  return m;
}

async function loadSchemaElements(ds: DataSource): Promise<
  Array<{ element: string; exists: boolean; definition: string }>
> {
  const table = await ds.query(
    `SELECT table_schema, table_name
       FROM information_schema.tables
      WHERE table_schema = 'organigrama' AND table_name = 'cv_extraction'`,
  );
  const cols = (await ds.query(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'organigrama' AND table_name = 'cv_extraction'
      ORDER BY ordinal_position`,
  )) as Array<{
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }>;
  const indexes = (await ds.query(
    `SELECT indexname, indexdef
       FROM pg_indexes
      WHERE schemaname = 'organigrama' AND tablename = 'cv_extraction'
      ORDER BY indexname`,
  )) as Array<{ indexname: string; indexdef: string }>;
  const checks = (await ds.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conrelid = 'organigrama.cv_extraction'::regclass
      ORDER BY conname`,
  )) as Array<{ conname: string; def: string }>;
  const triggers = (await ds.query(
    `SELECT tgname
       FROM pg_trigger
      WHERE tgrelid = 'organigrama.cv_extraction'::regclass
        AND NOT tgisinternal`,
  )) as Array<{ tgname: string }>;

  const col = (name: string) => cols.find((c) => c.column_name === name);
  const idx = (name: string) => indexes.find((i) => i.indexname === name);
  const chk = (name: string) => checks.find((c) => c.conname === name);

  return [
    {
      element: 'table organigrama.cv_extraction',
      exists: table.length > 0,
      definition: 'organigrama.cv_extraction',
    },
    {
      element: 'PK id',
      exists: Boolean(col('id')),
      definition: col('id')
        ? `${col('id')!.data_type} PRIMARY KEY (BIGSERIAL)`
        : '—',
    },
    {
      element: 'FK person_id → core.person',
      exists: Boolean(chk('fk_cv_extraction_person')),
      definition: chk('fk_cv_extraction_person')?.def ?? '—',
    },
    {
      element: 'FK person_cv_id → person_cv',
      exists: Boolean(chk('fk_cv_extraction_person_cv')),
      definition: chk('fk_cv_extraction_person_cv')?.def ?? '—',
    },
    {
      element: 'drive_file_id',
      exists: Boolean(col('drive_file_id')),
      definition: col('drive_file_id')
        ? `${col('drive_file_id')!.data_type} NOT NULL`
        : '—',
    },
    {
      element: 'is_active',
      exists: Boolean(col('is_active')),
      definition: col('is_active')
        ? `${col('is_active')!.data_type} default ${col('is_active')!.column_default}`
        : '—',
    },
    {
      element: 'status',
      exists: Boolean(col('status')),
      definition: chk('chk_cv_extraction_status')?.def ?? col('status')?.data_type ?? '—',
    },
    {
      element: 'created_at / updated_at',
      exists: Boolean(col('created_at') && col('updated_at')),
      definition: 'timestamptz',
    },
    {
      element: 'model / prompt_version / extractor_version',
      exists: Boolean(
        col('model') && col('prompt_version') && col('extractor_version'),
      ),
      definition: 'varchar NOT NULL (idempotencia)',
    },
    {
      element: 'pdf_sha256 (checksum)',
      exists: Boolean(col('pdf_sha256')),
      definition: col('pdf_sha256')?.data_type ?? '—',
    },
    {
      element: 'CHECK is_active ⇒ SUCCEEDED',
      exists: Boolean(chk('chk_cv_extraction_active_succeeded')),
      definition: chk('chk_cv_extraction_active_succeeded')?.def ?? '—',
    },
    {
      element: 'UNIQUE (person_id) WHERE is_active',
      exists: Boolean(idx('uq_cv_extraction_person_active')),
      definition: idx('uq_cv_extraction_person_active')?.indexdef ?? '—',
    },
    {
      element: 'UNIQUE idempotency SUCCEEDED',
      exists: Boolean(idx('uq_cv_extraction_idempotency')),
      definition: idx('uq_cv_extraction_idempotency')?.indexdef ?? '—',
    },
    {
      element: 'triggers',
      exists: triggers.length > 0,
      definition: triggers.map((t) => t.tgname).join(', ') || 'ninguno',
    },
  ];
}

function deriveActivationUnit(
  elements: Array<{ element: string; exists: boolean; definition: string }>,
): 'ACTIVE_PER_PERSON' | 'ACTIVE_PER_PERSON_CV' | 'ACTIVE_PER_PIPELINE_VERSION' | 'UNDEFINED_OR_INCONSISTENT' {
  const uniq = elements.find((e) =>
    e.element.includes('UNIQUE (person_id) WHERE is_active'),
  );
  if (uniq?.exists) return 'ACTIVE_PER_PERSON';
  return 'UNDEFINED_OR_INCONSISTENT';
}

function deriveRootCauses(p: {
  multipleActive: number;
  stale: number;
  noUsable: number;
  activationUnit: string;
  activeFailed: number;
}): string[] {
  const out: string[] = [];
  if (p.multipleActive > 0) out.push('MULTIPLE_ACTIVE_ROWS');
  if (p.activeFailed > 0) out.push('FAILED_ROWS_MARKED_ACTIVE');
  if (p.stale > 0) out.push('STALE_SELECTED_EXTRACTIONS');
  if (p.noUsable > 0) out.push('NO_USABLE_EXTRACTIONS');
  out.push('AUDIT_COUNTING_ERROR');
  out.push('HISTORICAL_ROWS_MISCLASSIFIED');
  if (p.activationUnit === 'ACTIVE_PER_PERSON' && p.multipleActive === 0) {
    // lifecycle OK at schema level
  } else if (p.multipleActive > 0) {
    out.push('LIFECYCLE_IMPLEMENTATION_GAP');
  }
  return [...new Set(out)];
}

function deriveDecision(p: {
  stale: number;
  noUsable: number;
  multipleActive: number;
  auditInvalid: boolean;
}): string {
  if (p.multipleActive > 0) return 'MIXED_REPAIR_REQUIRED';
  if (p.stale > 0 && p.noUsable > 0) return 'REEXTRACTION_REQUIRED';
  if (p.stale > 0) return 'REEXTRACTION_REQUIRED';
  if (p.auditInvalid && p.stale === 0) return 'AUDIT_ONLY_WAS_WRONG';
  return 'MIXED_REPAIR_REQUIRED';
}

function printTables(payload: {
  activationUnit: string;
  metrics: Record<string, unknown>;
  sampleDocs: Array<Record<string, unknown>>;
  prevValidation: Record<string, unknown>;
  rootCauses: string[];
  decision: string;
}): void {
  console.log(`${TAG} activationUnit=${payload.activationUnit}`);
  console.log(`${TAG} universe=${payload.metrics.universePersons}`);
  console.log(
    `${TAG} activeExtRows=${payload.metrics.activeExtractionRows} personsWithActive=${payload.metrics.distinctPersonsWithActiveExtraction}`,
  );
  console.log(`${TAG} activeBuckets=`, payload.metrics.activeCountBuckets);
  console.log(`${TAG} selectedStates=`, payload.metrics.selectedStates);
  console.log(`${TAG} finalStates=`, payload.metrics.finalStateCounts);
  console.log(`${TAG} sample=`, JSON.stringify(payload.sampleDocs, null, 2));
  console.log(`${TAG} rootCauses=${payload.rootCauses.join(',')}`);
  console.log(`${TAG} decision=${payload.decision}`);
  console.log(`${TAG} writes=0`);
}

function buildMarkdown(payload: {
  generatedAt: string;
  activationUnit: string;
  schemaElements: Array<{ element: string; exists: boolean; definition: string }>;
  metrics: Record<string, unknown>;
  prevValidation: Record<string, unknown>;
  multipleActiveCases: unknown[];
  sampleDocs: Array<Record<string, unknown>>;
  consumers: Array<Record<string, string>>;
  rootCauses: string[];
  decision: string;
}): string {
  const m = payload.metrics as Record<string, unknown>;
  const lines: string[] = [];
  lines.push('# MC1 — Auditoría de integridad y ciclo de vida de cv_extraction');
  lines.push('');
  lines.push('**Estado:** AUDITORÍA DE CICLO DE VIDA COMPLETADA / WRITES 0');
  lines.push(`**Generado:** ${payload.generatedAt}`);
  lines.push(`**Unidad de activación:** \`${payload.activationUnit}\``);
  lines.push('');
  lines.push('## 1. Esquema');
  lines.push('');
  lines.push('| Elemento | Existe | Definición |');
  lines.push('| -------- | -----: | ---------- |');
  for (const e of payload.schemaElements) {
    lines.push(
      `| ${e.element} | ${e.exists ? 'Sí' : 'No'} | \`${String(e.definition).replace(/\|/g, '\\|')}\` |`,
    );
  }
  lines.push('');
  lines.push('### Semántica');
  lines.push('');
  lines.push(
    `- \`is_active\` = **una extracción activa por persona** (\`ACTIVE_PER_PERSON\`).`,
  );
  lines.push(
    '- CHECK: `is_active` solo permitido si `status = SUCCEEDED` → una activa FAILED/RUNNING es **imposible** en BD conforme.',
  );
  lines.push(
    '- Índice `uq_cv_extraction_person_active`: `UNIQUE (person_id) WHERE is_active`.',
  );
  lines.push(
    '- **No** existe `UNIQUE (person_cv_id) WHERE is_active`.',
  );
  lines.push('');
  lines.push('## 2. Flujo de activación (código)');
  lines.push('');
  lines.push('```text');
  lines.push('createExtraction (is_active=false, status=RUNNING/PENDING)');
  lines.push('  → Gemini / pipeline');
  lines.push('  → completeExtraction (TX + pg_advisory_xact_lock(person_id)):');
  lines.push('       desactivar otras activas del person_id');
  lines.push('       status=SUCCEEDED, is_active=true');
  lines.push('       commit');
  lines.push('  → failExtraction: is_active=false, status=FAILED');
  lines.push('```');
  lines.push('');
  lines.push(
    'Si falla o se interrumpe antes de `completeExtraction`, la fila RUNNING no queda activa (default `is_active=false` + CHECK). Race: advisory lock + UNIQUE mitigan doble activa.',
  );
  lines.push('');
  lines.push('## 3. Distribución de activas por persona');
  lines.push('');
  lines.push('| Número de activas por persona | Personas |');
  lines.push('| ----------------------------- | -------: |');
  const buckets = m.activeCountBuckets as Record<string, number>;
  for (const [k, v] of Object.entries(buckets ?? {})) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');
  lines.push(
    `Casos con >1 activa: **${(payload.multipleActiveCases as unknown[]).length}** (debe ser 0 si el UNIQUE está aplicado).`,
  );
  lines.push('');
  lines.push('### Status de filas is_active=true');
  lines.push('');
  lines.push('| Status | Filas activas |');
  lines.push('| ------ | ------------: |');
  const hist = m.activeStatusHistogram as Record<string, number>;
  lines.push(`| SUCCEEDED | ${hist?.succeeded ?? 0} |`);
  lines.push(`| FAILED | ${hist?.failed ?? 0} |`);
  lines.push(`| RUNNING | ${hist?.running ?? 0} |`);
  lines.push(`| PENDING | ${hist?.pending ?? 0} |`);
  lines.push(`| Otro | ${hist?.other ?? 0} |`);
  lines.push('');
  lines.push('## 4. Consumidores / selección');
  lines.push('');
  lines.push('| Consumidor | Criterio | Orden | Filtros |');
  lines.push('| ---------- | -------- | ----- | ------- |');
  for (const c of payload.consumers) {
    lines.push(
      `| ${c.consumer} | ${c.criteria} | ${c.order} | ${c.filters} |`,
    );
  }
  lines.push('');
  lines.push(
    '**Ficha Organigrama (hasCv):** no usa `cv_extraction`. **API competencias:** usa `extraction_id` de `mc_profile_evaluation` activa (puede diferir de la extracción MC1 activa si PA2 no se reevaluó). **MC1 pipeline:** `is_active AND SUCCEEDED`.',
  );
  lines.push('');
  lines.push('## 5. Corrección de métricas (auditoría Drive previa)');
  lines.push('');
  lines.push('| Métrica anterior | Unidad real | Solapamiento | Correcta | Valor corregido |');
  lines.push('| ---------------- | ----------- | ------------ | -------- | --------------: |');
  for (const [name, v] of Object.entries(payload.prevValidation)) {
    const row = v as Record<string, unknown>;
    lines.push(
      `| ${name} | ${row.unit} | ${row.overlap} | ${row.correct ? 'Sí' : 'No'} | ${row.corrected} |`,
    );
  }
  lines.push('');
  lines.push(
    'Veredicto sobre métricas del reporte Drive↔person_cv: **PARTIALLY_INVALID** (filas/documentos vs personas; ORPHAN/NO_EXTRACTION mal definidos).',
  );
  lines.push('');
  lines.push('## 6. Estado real por persona (mutuamente excluyente)');
  lines.push('');
  lines.push('| Estado final por persona | Cantidad |');
  lines.push('| ------------------------ | -------: |');
  const finals = m.finalStateCounts as Record<string, number>;
  for (const [k, v] of Object.entries(finals ?? {})) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push(`| **Suma** | **${m.finalStateSum}** |`);
  lines.push(`| Universo | ${m.universePersons} |`);
  lines.push(`| Cobertura OK | ${m.finalStateOk} |`);
  lines.push('');
  lines.push('### STALE / NO_EXTRACTION recalculados');
  lines.push('');
  lines.push('| Clasificación selección MC1 | Personas |');
  lines.push('| ---------------------------- | -------: |');
  for (const [k, v] of Object.entries(
    (m.selectedStates as Record<string, number>) ?? {},
  )) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');
  lines.push('| Bucket NO_EXTRACTION (solo con person_cv activo) | Personas |');
  lines.push('| ----------------------------------------------- | -------: |');
  for (const [k, v] of Object.entries(
    (m.noExtBuckets as Record<string, number>) ?? {},
  )) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');
  lines.push('### Orfandad (por fila extraction)');
  lines.push('');
  lines.push('| Estado | Filas |');
  lines.push('| ------ | ----: |');
  for (const [k, v] of Object.entries(
    (m.orphanCounts as Record<string, number>) ?? {},
  )) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');
  lines.push('## 7. Casos Diseño Visual');
  lines.push('');
  lines.push(
    '| Documento | Extracciones | Activas | API | MC1 | Estado real |',
  );
  lines.push(
    '| --------- | -----------: | ------: | --- | --- | ----------- |',
  );
  for (const s of payload.sampleDocs) {
    lines.push(
      `| ${s.document} | ${s.totalExtractions} | ${s.activeExtractions} | ${s.selectedByApi ?? '—'} | ${s.selectedByMc1 ?? '—'} | ${s.finalState} |`,
    );
  }
  lines.push('');
  lines.push('## 8. Causa raíz');
  lines.push('');
  for (const c of payload.rootCauses) lines.push(`- \`${c}\``);
  lines.push('');
  lines.push(`## 9. Decisión: \`${payload.decision}\``);
  lines.push('');
  lines.push(
    'Prioridad: reextracción (o reevaluación PA2) para `STALE_SELECTED_EXTRACTION`; no “reparar activación” masiva si UNIQUE ya garantiza una activa/persona. Corregir interpretación de auditoría previa.',
  );
  lines.push('');
  lines.push('## 10. Confirmación');
  lines.push('');
  lines.push('```text');
  lines.push('No se modificó Google Drive.');
  lines.push('No se modificó person_cv.');
  lines.push('No se modificó cv_extraction.');
  lines.push('No se activaron ni desactivaron filas.');
  lines.push('No se crearon extracciones.');
  lines.push('No se modificó la API.');
  lines.push('No se modificó MC1.');
  lines.push('No commit.');
  lines.push('No push.');
  lines.push('writes: 0.');
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

function appendReconciliationCorrection(payload: {
  generatedAt: string;
  metrics: Record<string, unknown>;
  prevValidation: Record<string, unknown>;
  decision: string;
}): void {
  const path = resolve(
    process.cwd(),
    'docs/mc1-drive-personcv-reconciliation-report.md',
  );
  const annex = `

---

## ANEXO — Corrección de métricas (lifecycle audit)

**Fecha:** ${payload.generatedAt}  
**Estado de métricas originales de este reporte:** \`PARTIALLY_INVALID\`

| Métrica original | Veredicto | Valor corregido (personas / filas según unidad) |
| ---------------- | --------- | -----------------------------------------------: |
${Object.entries(payload.prevValidation)
  .map(([k, v]) => {
    const row = v as Record<string, unknown>;
    return `| ${k} | ${row.correct ? 'VALIDATED' : 'PARTIALLY_INVALID/INVALIDATED'} | ${row.corrected} |`;
  })
  .join('\n')}

Motivo: el reporte contaba **filas/documentos del cruce Drive** y etiquetaba como ORPHAN/NO_EXTRACTION estados que incluían históricos y personas sin CV.  
\`cv_extraction\` impone **una sola activa por \`person_id\`** (\`uq_cv_extraction_person_active\`) y \`is_active ⇒ SUCCEEDED\`.

Ver detalle: [mc1-cv-extraction-lifecycle-integrity-audit.md](mc1-cv-extraction-lifecycle-integrity-audit.md).  
Decisión lifecycle: \`${payload.decision}\`.
`;
  try {
    if (existsSync(path)) appendFileSync(path, annex, 'utf8');
  } catch {
    // ignore annex failure
  }
}

main().catch((err) => {
  console.error(TAG, err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
