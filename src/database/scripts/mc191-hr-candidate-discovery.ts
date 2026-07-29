/**
 * MC1.9.1 — Candidate Discovery HUMAN_RESOURCES (solo lectura).
 *
 * npm run mc:discover-hr-candidates
 *
 * Prioriza cadena completa; también indexa extracciones SUCCEEDED activas
 * (cadena parcial) para no perder candidatos del corpus.
 * No escribe en BD. No ejecuta PA2. No completa cadenas.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';

const TAG = '[MC1.9.1 HR Discovery]';
const SEED_DOCUMENT = '1070007550';
const SEED_PERSON_ID = '1077';

const QUERY_BUCKETS: Record<string, string[]> = {
  TALENT: [
    'seleccion',
    'reclutamiento',
    'contratacion',
    'onboarding',
    'induccion',
    'capacitacion',
    'formacion',
    'talento',
    'desempeno',
    'carrera',
    'sucesion',
    'retencion',
    'bienestar',
    'clima organizacional',
    'cultura organizacional',
    'competencias',
    'gestion humana',
    'recursos humanos',
    'rrhh',
    'gestion del talento',
    'gestion humana',
    'talento humano',
  ],
  ORG_DEV: [
    'desarrollo organizacional',
    'gestion del cambio',
    'diseno organizacional',
    'estructura organizacional',
    'transformacion cultural',
    'engagement',
    'experiencia del colaborador',
    'holocracia',
  ],
  ADMIN_PERSONNEL: [
    'nomina',
    'seguridad social',
    'contratos laborales',
    'novedades de personal',
    'vacaciones',
    'incapacidades',
    'compensacion',
    'beneficios',
    'relaciones laborales',
    'disciplinario',
    'legislacion laboral',
  ],
  SST: [
    'sg-sst',
    'sg sst',
    'seguridad y salud',
    'riesgos laborales',
    'accidentalidad',
    'copasst',
    'matriz de peligros',
    'hseq',
  ],
  PEOPLE_ANALYTICS: [
    'people analytics',
    'analitica de personas',
    'analitica de talento',
    'rotacion',
    'ausentismo',
    'headcount',
    'indicadores de talento',
    'indicadores de seleccion',
    'tableros de talento',
  ],
  QUALITY_BOUNDARY: [
    'iso 9001',
    'sistema de gestion de calidad',
    'auditoria interna',
    'mejora continua',
    'gestion documental',
    'indicadores de calidad',
  ],
};

function parseArgs(argv: string[]): { out: string } {
  let out = 'tmp/mc191-hr-candidates.json';
  for (const arg of argv) {
    if (arg.startsWith('--out=')) out = arg.slice('--out='.length);
  }
  return { out };
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function matchBuckets(text: string): string[] {
  const n = normalize(text);
  const hits: string[] = [];
  for (const [bucket, terms] of Object.entries(QUERY_BUCKETS)) {
    for (const t of terms) {
      const nt = normalize(t);
      // Evitar FP: "formación" ⊂ "información"; exigir límite de palabra
      // para términos cortos o fácilmente substrings.
      const needsBoundary =
        nt.length <= 10 ||
        nt === 'formacion' ||
        nt === 'sst' ||
        nt === 'carrera' ||
        nt === 'retencion';
      const ok = needsBoundary
        ? new RegExp(
            `(^|[^a-z0-9])${nt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`,
          ).test(n)
        : n.includes(nt);
      if (ok) {
        hits.push(bucket);
        break;
      }
    }
  }
  return [...new Set(hits)];
}

type Hit = {
  source: 'EVIDENCE_SKILL' | 'EXTRACTION_SKILL' | 'EXTRACTION_TEXT' | 'ENRICHMENT_TEXT';
  text: string;
  skill_type?: string;
  evidence_level?: string;
  evidence_strength?: number;
  has_work?: boolean;
  substantive?: number;
  buckets: string[];
};

type Agg = {
  person_id: string;
  full_name: string;
  document: string;
  role_name: string | null;
  area_name: string | null;
  extraction_id: string | null;
  enrichment_id: string | null;
  evidence_id: string | null;
  source_hash: string | null;
  skills_count: number;
  chain_complete: boolean;
  chain_status: 'FULL' | 'EXTRACTION_ONLY' | 'EXTRACTION_ENRICHMENT' | 'NONE';
  bucketHits: Record<string, number>;
  hits: Hit[];
  professionalHits: number;
  moderateOrStrongHits: number;
  workExperienceHits: number;
  scoreEvidenceWeighted: number;
};

function ensureAgg(
  map: Map<string, Agg>,
  row: Record<string, unknown>,
): Agg {
  const pid = String(row.person_id);
  let agg = map.get(pid);
  if (!agg) {
    const hasExt = Boolean(row.extraction_id);
    const hasEnr = Boolean(row.enrichment_id);
    const hasEv = Boolean(row.evidence_id);
    agg = {
      person_id: pid,
      full_name: String(row.full_name),
      document: String(row.document),
      role_name: (row.role_name as string) ?? null,
      area_name: (row.area_name as string) ?? null,
      extraction_id: row.extraction_id ? String(row.extraction_id) : null,
      enrichment_id: row.enrichment_id ? String(row.enrichment_id) : null,
      evidence_id: row.evidence_id ? String(row.evidence_id) : null,
      source_hash: row.source_hash ? String(row.source_hash) : null,
      skills_count: Number(row.skills_count ?? 0),
      chain_complete: hasExt && hasEnr && hasEv,
      chain_status: hasEv
        ? 'FULL'
        : hasEnr
          ? 'EXTRACTION_ENRICHMENT'
          : hasExt
            ? 'EXTRACTION_ONLY'
            : 'NONE',
      bucketHits: {},
      hits: [],
      professionalHits: 0,
      moderateOrStrongHits: 0,
      workExperienceHits: 0,
      scoreEvidenceWeighted: 0,
    };
    map.set(pid, agg);
  } else {
    if (row.extraction_id && !agg.extraction_id) {
      agg.extraction_id = String(row.extraction_id);
    }
    if (row.enrichment_id && !agg.enrichment_id) {
      agg.enrichment_id = String(row.enrichment_id);
    }
    if (row.evidence_id && !agg.evidence_id) {
      agg.evidence_id = String(row.evidence_id);
    }
    if (row.source_hash && !agg.source_hash) {
      agg.source_hash = String(row.source_hash);
    }
    agg.chain_complete = Boolean(
      agg.extraction_id && agg.enrichment_id && agg.evidence_id,
    );
    agg.chain_status = agg.evidence_id
      ? 'FULL'
      : agg.enrichment_id
        ? 'EXTRACTION_ENRICHMENT'
        : agg.extraction_id
          ? 'EXTRACTION_ONLY'
          : 'NONE';
  }
  return agg;
}

function addHit(agg: Agg, hit: Hit): void {
  if (agg.hits.length < 40) agg.hits.push(hit);
  for (const b of hit.buckets) {
    agg.bucketHits[b] = (agg.bucketHits[b] ?? 0) + 1;
  }
  const skillType = hit.skill_type ?? '';
  if (
    skillType === 'PROFESSIONAL_KNOWLEDGE' ||
    skillType === 'METHODOLOGY'
  ) {
    agg.professionalHits += 1;
  }
  const level = hit.evidence_level ?? '';
  if (level === 'MODERATE' || level === 'STRONG') {
    agg.moderateOrStrongHits += 1;
  }
  if (hit.has_work) agg.workExperienceHits += 1;

  const levelWeight =
    level === 'STRONG'
      ? 3
      : level === 'MODERATE'
        ? 2
        : level === 'WEAK'
          ? 1
          : hit.source === 'EXTRACTION_TEXT' || hit.source === 'ENRICHMENT_TEXT'
            ? 1.2
            : hit.source === 'EXTRACTION_SKILL'
              ? 0.8
              : 0.3;
  const typeWeight =
    skillType === 'PROFESSIONAL_KNOWLEDGE'
      ? 2
      : skillType === 'METHODOLOGY'
        ? 1.5
        : skillType === 'TOOL'
          ? 0.25
          : skillType
            ? 0.5
            : 1;
  const chainBonus = agg.chain_complete ? 1.2 : 1;
  agg.scoreEvidenceWeighted +=
    levelWeight *
    typeWeight *
    (hit.has_work ? 1.25 : 1) *
    ((hit.substantive ?? 0) > 0 ? 1.15 : 1) *
    chainBonus *
    Math.max(1, hit.buckets.length * 0.5);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);

  try {
    const universe = await ds.query(
      `SELECT COUNT(DISTINCT p.id)::int AS persons_with_cv,
              COUNT(DISTINCT CASE WHEN e.id IS NOT NULL THEN p.id END)::int AS persons_active_extraction,
              COUNT(DISTINCT CASE
                WHEN e.id IS NOT NULL AND en.id IS NOT NULL AND ev.id IS NOT NULL
                THEN p.id END)::int AS persons_full_chain,
              COUNT(DISTINCT e.id)::int AS active_extractions
         FROM core.person p
         JOIN organigrama.person_cv cv
           ON cv.person_id = p.id AND cv.is_active = TRUE
         LEFT JOIN organigrama.cv_extraction e
           ON e.person_id = p.id AND e.is_active = TRUE AND e.status = 'SUCCEEDED'
         LEFT JOIN organigrama.cv_skill_enrichment en
           ON en.person_id = p.id AND en.is_active = TRUE AND en.status = 'SUCCEEDED'
          AND en.extraction_id = e.id
         LEFT JOIN organigrama.cv_evidence_evaluation ev
           ON ev.person_id = p.id AND ev.is_active = TRUE AND ev.status = 'SUCCEEDED'
          AND ev.extraction_id = e.id AND ev.enrichment_id = en.id`,
    );

    const byPerson = new Map<string, Agg>();

    // 1) Evidence items (cadena completa)
    const evidenceRows = await ds.query(
      `SELECT p.id::text AS person_id, p.full_name, p.document,
              ro.name AS role_name, a.name AS area_name,
              e.id::text AS extraction_id, e.pdf_sha256 AS source_hash, e.skills_count,
              en.id::text AS enrichment_id, ev.id::text AS evidence_id,
              s.normalized_name, s.skill_type,
              ei.evidence_level, ei.evidence_strength::float AS evidence_strength,
              ei.has_work_experience, ei.substantive_evidence_count
         FROM organigrama.cv_evidence_evaluation ev
         JOIN organigrama.cv_evidence_evaluation_item ei ON ei.evaluation_id = ev.id
         JOIN organigrama.cv_extraction_skill ces ON ces.id = ei.extraction_skill_id
         JOIN organigrama.cv_skill s ON s.id = ces.skill_id
         JOIN organigrama.cv_extraction e ON e.id = ev.extraction_id
         JOIN organigrama.cv_skill_enrichment en ON en.id = ev.enrichment_id
         JOIN core.person p ON p.id = ev.person_id
         LEFT JOIN core.role ro ON ro.id = p.role_id
         LEFT JOIN core.area a ON a.id = p.area_id
        WHERE ev.is_active = TRUE AND ev.status = 'SUCCEEDED'
          AND e.is_active = TRUE AND e.status = 'SUCCEEDED'
          AND en.is_active = TRUE AND en.status = 'SUCCEEDED'
          AND p.id::text <> $1`,
      [SEED_PERSON_ID],
    );

    for (const row of evidenceRows as Array<Record<string, unknown>>) {
      const buckets = matchBuckets(String(row.normalized_name));
      if (buckets.length === 0) continue;
      const agg = ensureAgg(byPerson, row);
      addHit(agg, {
        source: 'EVIDENCE_SKILL',
        text: String(row.normalized_name),
        skill_type: String(row.skill_type),
        evidence_level: String(row.evidence_level),
        evidence_strength: Number(row.evidence_strength ?? 0),
        has_work: Boolean(row.has_work_experience),
        substantive: Number(row.substantive_evidence_count ?? 0),
        buckets,
      });
    }

    // 2) Extracción activa: skill names + evidence text JSON
    const extractionRows = await ds.query(
      `SELECT p.id::text AS person_id, p.full_name, p.document,
              ro.name AS role_name, a.name AS area_name,
              e.id::text AS extraction_id, e.pdf_sha256 AS source_hash, e.skills_count,
              en.id::text AS enrichment_id, ev.id::text AS evidence_id,
              s.normalized_name, s.skill_type,
              ces.evidence AS evidence_text,
              ces.evidence_items
         FROM organigrama.cv_extraction e
         JOIN organigrama.cv_extraction_skill ces ON ces.extraction_id = e.id
         JOIN organigrama.cv_skill s ON s.id = ces.skill_id
         JOIN core.person p ON p.id = e.person_id
         LEFT JOIN core.role ro ON ro.id = p.role_id
         LEFT JOIN core.area a ON a.id = p.area_id
         LEFT JOIN organigrama.cv_skill_enrichment en
           ON en.extraction_id = e.id AND en.is_active = TRUE AND en.status = 'SUCCEEDED'
         LEFT JOIN organigrama.cv_evidence_evaluation ev
           ON ev.extraction_id = e.id AND ev.enrichment_id = en.id
          AND ev.is_active = TRUE AND ev.status = 'SUCCEEDED'
        WHERE e.is_active = TRUE AND e.status = 'SUCCEEDED'
          AND p.id::text <> $1`,
      [SEED_PERSON_ID],
    );

    for (const row of extractionRows as Array<Record<string, unknown>>) {
      const name = String(row.normalized_name ?? '');
      const nameBuckets = matchBuckets(name);
      const agg = ensureAgg(byPerson, row);

      if (nameBuckets.length > 0) {
        // Evitar doble conteo si ya hay evidence para misma skill en cadena FULL
        const already = agg.hits.some(
          (h) =>
            h.source === 'EVIDENCE_SKILL' &&
            normalize(h.text) === normalize(name),
        );
        if (!already) {
          addHit(agg, {
            source: 'EXTRACTION_SKILL',
            text: name,
            skill_type: String(row.skill_type),
            buckets: nameBuckets,
          });
        }
      }

      const items =
        (row.evidence_items as Array<Record<string, unknown>> | null) ?? [];
      for (const it of items) {
        const text = String(it.evidenceText ?? '');
        const sourceType = String(it.sourceType ?? '');
        if (!text) continue;
        const buckets = matchBuckets(text);
        if (buckets.length === 0) continue;
        if (
          sourceType !== 'WORK_EXPERIENCE' &&
          sourceType !== 'RESPONSIBILITY' &&
          sourceType !== 'ACHIEVEMENT' &&
          sourceType !== 'PROFILE_SUMMARY' &&
          sourceType !== 'EDUCATION'
        ) {
          continue;
        }
        addHit(agg, {
          source: 'EXTRACTION_TEXT',
          text: `${sourceType}: ${text.slice(0, 240)}`,
          skill_type: String(row.skill_type),
          has_work:
            sourceType === 'WORK_EXPERIENCE' ||
            sourceType === 'RESPONSIBILITY',
          buckets,
        });
      }

      const plain = String(row.evidence_text ?? '');
      if (plain && items.length === 0) {
        const buckets = matchBuckets(plain);
        if (buckets.length > 0) {
          addHit(agg, {
            source: 'EXTRACTION_TEXT',
            text: plain.slice(0, 240),
            skill_type: String(row.skill_type),
            buckets,
          });
        }
      }
    }

    // 3) Enrichment texts (si existe enrichment activo)
    const enrichRows = await ds.query(
      `SELECT p.id::text AS person_id, p.full_name, p.document,
              ro.name AS role_name, a.name AS area_name,
              e.id::text AS extraction_id, e.pdf_sha256 AS source_hash, e.skills_count,
              en.id::text AS enrichment_id, ev.id::text AS evidence_id,
              item.normalized_name, item.evidence_items
         FROM organigrama.cv_skill_enrichment en
         JOIN organigrama.cv_skill_enrichment_item item ON item.enrichment_id = en.id
         JOIN organigrama.cv_extraction e ON e.id = en.extraction_id
         JOIN core.person p ON p.id = en.person_id
         LEFT JOIN core.role ro ON ro.id = p.role_id
         LEFT JOIN core.area a ON a.id = p.area_id
         LEFT JOIN organigrama.cv_evidence_evaluation ev
           ON ev.enrichment_id = en.id AND ev.is_active = TRUE AND ev.status = 'SUCCEEDED'
        WHERE en.is_active = TRUE AND en.status = 'SUCCEEDED'
          AND e.is_active = TRUE AND e.status = 'SUCCEEDED'
          AND p.id::text <> $1
          AND item.evidence_count > 0`,
      [SEED_PERSON_ID],
    );

    for (const row of enrichRows as Array<Record<string, unknown>>) {
      const agg = ensureAgg(byPerson, row);
      const items = (row.evidence_items as Array<Record<string, unknown>>) ?? [];
      for (const it of items) {
        const text = String(it.evidenceText ?? '');
        const sourceType = String(it.sourceType ?? '');
        if (!text) continue;
        if (
          sourceType !== 'WORK_EXPERIENCE' &&
          sourceType !== 'RESPONSIBILITY' &&
          sourceType !== 'ACHIEVEMENT' &&
          sourceType !== 'PROFILE_SUMMARY'
        ) {
          continue;
        }
        const buckets = matchBuckets(text);
        if (buckets.length === 0) continue;
        // Dedup rough
        const key = normalize(text).slice(0, 80);
        if (agg.hits.some((h) => normalize(h.text).includes(key))) continue;
        addHit(agg, {
          source: 'ENRICHMENT_TEXT',
          text: `${sourceType}: ${text.slice(0, 240)}`,
          has_work:
            sourceType === 'WORK_EXPERIENCE' ||
            sourceType === 'RESPONSIBILITY',
          buckets,
        });
      }
    }

    const candidates = [...byPerson.values()]
      .filter((c) => Object.keys(c.bucketHits).length > 0)
      .map((c) => {
        const talent = c.bucketHits.TALENT ?? 0;
        const org = c.bucketHits.ORG_DEV ?? 0;
        const sst = c.bucketHits.SST ?? 0;
        const quality = c.bucketHits.QUALITY_BOUNDARY ?? 0;
        const analytics = c.bucketHits.PEOPLE_ANALYTICS ?? 0;
        const admin = c.bucketHits.ADMIN_PERSONNEL ?? 0;

        const talentHeavy = talent >= 2 || (talent >= 1 && c.workExperienceHits >= 1);
        const sstHeavy = sst >= 2 && talent < 2;
        const qualityHeavy = quality >= 2 && talent < 1;
        const analyticsHeavy = analytics >= 2 && talent < 1;

        let hypothesis = 'INSUFFICIENT_EVIDENCE';
        if (
          talentHeavy &&
          (c.moderateOrStrongHits >= 1 || c.workExperienceHits >= 2) &&
          c.professionalHits + c.workExperienceHits >= 2
        ) {
          hypothesis = 'POTENTIAL_MATCH';
        } else if (sstHeavy || admin >= 2) {
          hypothesis = 'POTENTIAL_COMPLEMENTARY';
        } else if (qualityHeavy || analyticsHeavy) {
          hypothesis = 'POTENTIAL_OUTSIDE';
        } else if (talent >= 1 || org >= 1) {
          hypothesis = 'POTENTIAL_BORDERLINE';
        } else if (sst >= 1 || quality >= 1) {
          hypothesis = 'POTENTIAL_COMPLEMENTARY';
        }

        return {
          person_id: c.person_id,
          full_name: c.full_name,
          document: c.document,
          role_name: c.role_name,
          area_name: c.area_name,
          extraction_id: c.extraction_id,
          enrichment_id: c.enrichment_id,
          evidence_id: c.evidence_id,
          source_hash: c.source_hash,
          skills_count: c.skills_count,
          chain_complete: c.chain_complete,
          chain_status: c.chain_status,
          bucketHits: c.bucketHits,
          bucketsPresent: Object.keys(c.bucketHits),
          professionalHits: c.professionalHits,
          moderateOrStrongHits: c.moderateOrStrongHits,
          workExperienceHits: c.workExperienceHits,
          scoreEvidenceWeighted: Number(c.scoreEvidenceWeighted.toFixed(2)),
          hypothesis_preliminary: hypothesis,
          sampleHits: c.hits.slice(0, 12),
          notes: {
            talentHeavy,
            sstHeavy,
            qualityHeavy,
            analyticsHeavy,
          },
        };
      })
      .sort(
        (a, b) =>
          b.scoreEvidenceWeighted - a.scoreEvidenceWeighted ||
          Number(b.chain_complete) - Number(a.chain_complete),
      );

    const seed = await ds.query(
      `SELECT p.id::text, p.full_name, p.document, ro.name AS role_name, a.name AS area_name
         FROM core.person p
         LEFT JOIN core.role ro ON ro.id = p.role_id
         LEFT JOIN core.area a ON a.id = p.area_id
        WHERE p.document = $1`,
      [SEED_DOCUMENT],
    );

    const report = {
      phase: 'MC1.9.1',
      generatedAt: new Date().toISOString(),
      mode: 'READ_ONLY',
      domainProvisional: 'HUMAN_RESOURCES',
      seed: {
        document: SEED_DOCUMENT,
        person_id: SEED_PERSON_ID,
        person: seed[0] ?? null,
      },
      queryBuckets: QUERY_BUCKETS,
      universe: universe[0],
      candidatesCount: candidates.length,
      candidates: candidates.slice(0, 50),
      distribution: candidates.reduce(
        (acc: Record<string, number>, c) => {
          acc[c.hypothesis_preliminary] =
            (acc[c.hypothesis_preliminary] ?? 0) + 1;
          return acc;
        },
        {},
      ),
      chainDistribution: candidates.reduce(
        (acc: Record<string, number>, c) => {
          acc[c.chain_status] = (acc[c.chain_status] ?? 0) + 1;
          return acc;
        },
        {},
      ),
      disclaimer:
        'Coincidencia léxica ≠ pertenencia. Clasificación preliminar automática; ' +
        'revisión profesional obligatoria. Cargo/área solo contexto.',
    };

    mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
    const outPath = resolve(process.cwd(), args.out);
    writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

    console.log(
      JSON.stringify(
        {
          tag: TAG,
          universe: report.universe,
          candidatesCount: report.candidatesCount,
          distribution: report.distribution,
          chainDistribution: report.chainDistribution,
          top: candidates.slice(0, 20).map((c) => ({
            document: c.document,
            name: c.full_name,
            hypothesis: c.hypothesis_preliminary,
            score: c.scoreEvidenceWeighted,
            chain: c.chain_status,
            buckets: c.bucketsPresent,
            work: c.workExperienceHits,
            modStrong: c.moderateOrStrongHits,
            role: c.role_name,
          })),
          out: outPath,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
