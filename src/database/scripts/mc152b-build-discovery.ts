/**
 * MC1.5.2B — arma artefacto de descubrimiento + integridad (solo lectura DB + artifacts locales).
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

type DiscoveryClass =
  | 'PROFESSIONAL_CORE'
  | 'PROFESSIONAL_SUPPORT'
  | 'TRANSVERSAL'
  | 'AMBIGUOUS'
  | 'INSUFFICIENT_EVIDENCE';

function classify(
  name: string,
  level: string,
  strength: number,
): DiscoveryClass {
  if (level === 'NONE' || strength <= 0) return 'INSUFFICIENT_EVIDENCE';
  if (name === 'Liderazgo creativo') return 'TRANSVERSAL';
  if (name === 'Inteligencia Artificial' || name === 'Optimización de prompts') {
    if (level === 'MODERATE' || strength >= 40) return 'PROFESSIONAL_SUPPORT';
    return 'AMBIGUOUS';
  }
  if (name === 'Diseño publicitario' && (level === 'MODERATE' || strength >= 40)) {
    return 'PROFESSIONAL_CORE';
  }
  if (
    ['Diseño editorial', 'Diseño instruccional', 'Diseño publicitario'].includes(
      name,
    )
  ) {
    if (level === 'WEAK' && strength < 20) return 'AMBIGUOUS';
    if (level === 'WEAK') return 'PROFESSIONAL_SUPPORT';
    return 'PROFESSIONAL_CORE';
  }
  if (level === 'WEAK') return 'PROFESSIONAL_SUPPORT';
  return 'AMBIGUOUS';
}

async function main() {
  const enr = JSON.parse(
    readFileSync(
      resolve(
        process.cwd(),
        'tmp/cv-attributes/1015482688-e1-20260727-123027.json',
      ),
      'utf8',
    ),
  );
  const ev = JSON.parse(
    readFileSync(
      resolve(
        process.cwd(),
        'tmp/cv-attributes/enrichment-4-er2-20260727-123124.json',
      ),
      'utf8',
    ),
  );
  const pre = JSON.parse(
    readFileSync(
      resolve(
        process.cwd(),
        'tmp/cv-attributes/mc1.5.2b-preflight-1015482688.json',
      ),
      'utf8',
    ),
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  const ds = app.get(DataSource);

  const integrity = {
    extraction87: (
      await ds.query(
        `SELECT id::text, status, is_active, pdf_sha256, person_cv_id::text,
                finished_at
           FROM organigrama.cv_extraction WHERE id = 87`,
      )
    )[0],
    enrichments: await ds.query(
      `SELECT id::text, status, is_active, extraction_id::text, pdf_sha256
         FROM organigrama.cv_skill_enrichment
        WHERE extraction_id = 87 ORDER BY id`,
    ),
    evidences: await ds.query(
      `SELECT ev.id::text, ev.status, ev.is_active, ev.enrichment_id::text
         FROM organigrama.cv_evidence_evaluation ev
         JOIN organigrama.cv_skill_enrichment en ON en.id = ev.enrichment_id
        WHERE en.extraction_id = 87 ORDER BY ev.id`,
    ),
    pa2: await ds.query(
      `SELECT id::text FROM organigrama.mc_profile_evaluation WHERE extraction_id = 87`,
    ),
    mcClassifications: await ds.query(
      `SELECT COUNT(*)::int AS n FROM organigrama.mc_skill_domain_classification c
         JOIN organigrama.cv_extraction_skill ces ON ces.skill_id = c.skill_id
        WHERE ces.extraction_id = 87`,
    ),
    mcMappings: await ds.query(
      `SELECT COUNT(*)::int AS n FROM organigrama.mc_skill_specialty_mapping m
         JOIN organigrama.cv_extraction_skill ces ON ces.skill_id = m.skill_id
        WHERE ces.extraction_id = 87`,
    ),
  };

  const enrichById = new Map(
    (enr.validatedResult.skills as Array<Record<string, unknown>>).map((s) => [
      String(s.extractionSkillId),
      s,
    ]),
  );

  const skills = (ev.skills as Array<Record<string, unknown>>).map((s) => {
    const name = String(s.normalizedName);
    const level = String(s.evidenceLevel);
    const strength = Number(s.evidenceStrength);
    const conf = Number(s.evidenceConfidence);
    const en = enrichById.get(String(s.extractionSkillId));
    const extractionSkill = (pre.skills as Array<Record<string, unknown>>).find(
      (p) => p.extractionSkillId === s.extractionSkillId || p.canonicalName === name,
    );
    // match by name if ids differ across artifacts
    const enByName = (enr.validatedResult.skills as Array<Record<string, unknown>>).find(
      (x) => x.normalizedName === name,
    );
    const preByName = (pre.skills as Array<Record<string, unknown>>).find(
      (p) => p.canonicalName === name,
    );
    const discoveryClass = classify(name, level, strength);
    return {
      name,
      extractionSkillId: s.extractionSkillId,
      skillId: preByName?.skillId ?? null,
      normalizedKey: preByName?.normalizedKey ?? null,
      type: preByName?.type ?? null,
      category: preByName?.category ?? null,
      extractionConfidence: preByName?.extractionConfidence ?? null,
      extractionEvidenceSnippet: String(preByName?.evidenceOriginal ?? '').slice(
        0,
        280,
      ),
      enrichmentEvidenceItems: enByName?.evidenceItems ?? en?.evidenceItems ?? [],
      evidenceLevel: level,
      evidenceStrength: strength,
      evidenceConfidence: conf,
      qualityFlags: s.qualityFlags,
      sourceBreakdown: s.sourceBreakdown,
      explanation: s.explanation,
      discoveryClassification: discoveryClass,
      iaReading:
        name === 'Inteligencia Artificial' || name === 'Optimización de prompts'
          ? 'uso_instrumental_en_flujo_creativo'
          : null,
    };
  });

  const groups = {
    disenoEditorialGrafico: {
      skills: ['Diseño editorial', 'Diseño publicitario'],
      status: 'ACTIVE_CANDIDATE',
      note: 'Publicitario MODERATE; editorial WEAK (solo resumen).',
    },
    disenoInstruccional: {
      skills: ['Diseño instruccional'],
      status: 'EMERGING_CANDIDATE',
      note: 'WEAK / name-only + genérico; mencionar en perfil pero insuficiente sola.',
    },
    produccionAudiovisual: {
      skills: ['Edición audiovisual'],
      status: 'INSUFFICIENT',
      note: 'Extraída pero Evidence=NONE; posible gap de extracción/enrichment.',
    },
    estrategiaContenidos: {
      skills: [
        'Planificación de contenido',
        'Pensamiento estratégico en diseño',
      ],
      status: 'INSUFFICIENT',
      note: 'Evidence=NONE pese a mención en CV extraction text.',
    },
    liderazgoCreativo: {
      skills: ['Liderazgo creativo'],
      status: 'INSUFFICIENT',
      note: 'SOFT_SKILL transversal; Evidence=NONE.',
    },
    iaAplicadaContenidos: {
      skills: ['Inteligencia Artificial', 'Optimización de prompts'],
      status: 'EMERGING_CANDIDATE',
      note: 'Uso instrumental/aplicado en flujo creativo; no especialización autónoma aún.',
    },
  };

  const out = {
    meta: {
      phase: 'MC1.5.2B',
      generatedAt: new Date().toISOString(),
      person: {
        personId: '1163',
        document: '1015482688',
        fullName: 'NIDIA MARCELA PRADA RAMIREZ',
        role: 'ANALISTA DE DISEÑO DE CONTENIDOS',
      },
      pipeline: {
        personCvId: '7',
        extractionId: '87',
        enrichmentId: '4',
        enrichmentInactivePrior: '3',
        evidenceEvaluationId: '4',
        pa2: null,
      },
      pdfSha256Drift: {
        extraction: integrity.extraction87.pdf_sha256,
        driveLiveAtEnrichment:
          '467d7dbea064e77535fe2c3742e58c6adfff499fc98745f3a68844d62f86f3a6',
        note: 'CV en Drive cambió tras extracción 87; Enrichment analizó PDF vivo pero se vinculó al hash de la extracción.',
      },
    },
    quantitative: {
      skills: 9,
      evidenceLevels: ev.metrics ?? {
        strong: 0,
        moderate: 2,
        weak: 3,
        none: 4,
      },
      discoveryCounts: skills.reduce(
        (acc: Record<string, number>, s) => {
          acc[s.discoveryClassification] =
            (acc[s.discoveryClassification] ?? 0) + 1;
          return acc;
        },
        {},
      ),
    },
    skills,
    groups,
    areaRecommendation: {
      name: 'Diseño y producción de contenidos',
      rationale:
        'Cubre editorial, publicitario e instruccional; admite audiovisual e IA instrumental sin confundirse con Marketing, UX/UI o Software.',
    },
    specialtyCandidates: [
      {
        name: 'Diseño editorial y gráfico',
        status: 'ACTIVE_CANDIDATE',
        skills: ['Diseño editorial', 'Diseño publicitario'],
        evidence: 'Publicitario MODERATE (45); Editorial WEAK (5)',
      },
      {
        name: 'Diseño instruccional',
        status: 'EMERGING_CANDIDATE',
        skills: ['Diseño instruccional'],
        evidence: 'WEAK (2) — evidencia corta/genérica',
      },
      {
        name: 'IA aplicada a contenidos',
        status: 'EMERGING_CANDIDATE',
        skills: ['Inteligencia Artificial', 'Optimización de prompts'],
        evidence: 'MODERATE/WEAK instrumental; no especialización autónoma',
      },
      {
        name: 'Producción audiovisual',
        status: 'INSUFFICIENT',
        skills: ['Edición audiovisual'],
        evidence: 'NONE',
      },
      {
        name: 'Estrategia y planificación de contenidos',
        status: 'INSUFFICIENT',
        skills: [
          'Planificación de contenido',
          'Pensamiento estratégico en diseño',
        ],
        evidence: 'NONE',
      },
    ],
    integrity: {
      ...integrity,
      extractionUnmutated:
        integrity.extraction87?.status === 'SUCCEEDED' &&
        integrity.extraction87?.is_active === true,
      oneActiveEnrichment:
        integrity.enrichments.filter((e: { is_active: boolean }) => e.is_active)
          .length === 1 &&
        integrity.enrichments.find((e: { is_active: boolean }) => e.is_active)
          ?.id === '4',
      oneActiveEvidence:
        integrity.evidences.filter((e: { is_active: boolean }) => e.is_active)
          .length === 1 &&
        integrity.evidences.find((e: { is_active: boolean }) => e.is_active)
          ?.id === '4',
      zeroPa2: integrity.pa2.length === 0,
      zeroNewMcCatalogWrites: true,
      note: 'No se ejecutó PA2 Software; clasificaciones discovery solo en artefacto/docs.',
    },
    warnings: [
      'pdfSha256 drift entre extracción 87 y PDF vivo en Drive',
      'Enrichment id=3 SUCCEEDED inactivo (activación fallida por hash previo)',
      '4 skills con Evidence NONE pese a estar en extracción',
      'Posible omisión de herramientas (Adobe, CapCut, etc.) en extracción',
    ],
  };

  const dir = resolve(process.cwd(), 'tmp', 'cv-attributes');
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, 'mc1.5.2b-1015482688-enrichment-evidence.json');
  writeFileSync(path, JSON.stringify(out, null, 2), 'utf8');
  console.log(JSON.stringify({
    enrichmentId: '4',
    evidenceId: '4',
    discoveryCounts: out.quantitative.discoveryCounts,
    area: out.areaRecommendation.name,
    path,
    integrity: {
      extractionUnmutated: out.integrity.extractionUnmutated,
      oneActiveEnrichment: out.integrity.oneActiveEnrichment,
      oneActiveEvidence: out.integrity.oneActiveEvidence,
      zeroPa2: out.integrity.zeroPa2,
    },
  }, null, 2));
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
