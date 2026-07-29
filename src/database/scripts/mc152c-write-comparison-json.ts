/**
 * MC1.5.2C — Genera artefacto JSON de comparación (local, sin Cloud).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function load(rel: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), rel), 'utf8'));
}

function norm(n: string): string {
  return String(n)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

type Integrity = {
  skills87: string[];
  skills207: Array<{ name: string; type: string; category: string }>;
  integrity: Record<string, unknown>;
};

type Preflight = {
  drift: Record<string, unknown>;
  rows: {
    ext87: { drive_file_id: string };
    cvs: Array<{ drive_file_id: string }>;
  };
};

async function main() {
  const integrity = load(
    'tmp/cv-attributes/mc1.5.2c-integrity.json',
  ) as Integrity;
  const preflight = load(
    'tmp/cv-attributes/mc1.5.2c-preflight-drift.json',
  ) as Preflight;
  const evNew = load(
    'tmp/cv-evidence/enrichment-5-er2-20260727-124603.json',
  ) as {
    outcome: {
      metrics: Record<string, unknown>;
      result: {
        skills: Array<{
          normalizedName: string;
          evidenceLevel: string;
          evidenceStrength: number;
          evidenceConfidence: number;
          qualityFlags: string[];
          sourceBreakdown: Record<string, number>;
        }>;
      };
    };
  };
  const evOld = load(
    'tmp/cv-attributes/mc1.5.2b-1015482688-enrichment-evidence.json',
  ) as {
    skills?: Array<Record<string, unknown>>;
    metrics?: Record<string, unknown>;
    evidenceLevels?: Record<string, unknown>;
  };
  const ex = load('tmp/cv-skills/1015482688.json') as {
    model: string;
    promptVersion: string;
    extractorVersion: string;
    driveFileId: string;
  };

  const newSkills = evNew.outcome.result.skills.map((s) => ({
    name: s.normalizedName,
    level: s.evidenceLevel,
    strength: s.evidenceStrength,
    confidence: s.evidenceConfidence,
    qualityFlags: s.qualityFlags,
    sourceBreakdown: s.sourceBreakdown,
  }));

  const oldSkills = (evOld.skills ?? []).map((s) => ({
    name: String(s.name ?? s.normalizedName ?? ''),
    level: s.evidenceLevel,
    strength: s.evidenceStrength ?? s.strength,
    confidence: s.confidence ?? s.evidenceConfidence,
  }));

  const oldNames = new Set(integrity.skills87.map((n) => norm(n)));
  const newNames = integrity.skills207.map((s) => s.name);
  const changes: Array<Record<string, string>> = [];

  for (const n of integrity.skills87) {
    const nn = norm(n);
    let kind = 'REMOVED';
    if (newNames.some((x) => norm(x) === nn)) kind = 'UNCHANGED';
    else if (
      nn.includes('prompt') &&
      newNames.some((x) => norm(x).includes('prompt'))
    )
      kind = 'RENAMED_OR_NORMALIZED';
    else if (
      nn.includes('liderazgo') &&
      newNames.some((x) => norm(x).includes('liderazgo'))
    )
      kind = 'RENAMED_OR_NORMALIZED';
    else if (
      nn.includes('inteligencia') &&
      newNames.some((x) => norm(x).includes('inteligencia'))
    )
      kind = 'EVIDENCE_ENRICHED';
    else if (
      nn.includes('editorial') &&
      newNames.some((x) => norm(x).includes('editorial'))
    )
      kind = 'UNCHANGED';
    else if (
      nn.includes('instruccional') &&
      newNames.some((x) => norm(x).includes('instruccional'))
    )
      kind = 'UNCHANGED';
    changes.push({ from: n, classification: kind });
  }

  for (const s of integrity.skills207) {
    const nn = norm(s.name);
    if ([...oldNames].some((x) => x === nn)) continue;
    if (
      changes.some(
        (c) =>
          c.classification === 'RENAMED_OR_NORMALIZED' &&
          norm(c.from).includes(nn.slice(0, 8)),
      )
    ) {
      continue;
    }
    changes.push({ to: s.name, type: s.type, classification: 'ADDED' });
  }

  const out = {
    meta: {
      phase: 'MC1.5.2C',
      document: '1015482688',
      personId: 1163,
      personCvId: 7,
      generatedAt: new Date().toISOString(),
    },
    drift: {
      cause: preflight.drift.likelyCause,
      previousHash: preflight.drift.extraction87Hash,
      liveHash: preflight.drift.livePdfHash,
      driveFileIdPrevious: preflight.rows.ext87.drive_file_id,
      driveFileIdCurrent: preflight.rows.cvs[0].drive_file_id,
      driveModifiedTime: preflight.drift.driveModifiedTime,
      driveMd5Checksum: preflight.drift.driveMd5Checksum,
      personCvSyncedAt: preflight.drift.personCvSyncedAt,
      extraction87FinishedAt: preflight.drift.extractionFinishedAt,
      whyPreviousStayedActive: preflight.drift.whyExtractionStillActive,
      policy:
        'New SUCCEEDED extraction for live hash becomes active; previous kept historical (is_active=false). Enrichment/Evidence must share extraction pdf_sha256.',
    },
    historical: {
      extractionId: '87',
      enrichmentId: '4',
      evidenceId: '4',
      pdfSha256: preflight.drift.extraction87Hash,
      skillsCount: 9,
    },
    current: {
      extractionId: '207',
      enrichmentId: '5',
      evidenceId: '5',
      pdfSha256: integrity.integrity.activeExtractionHash,
      status: {
        extraction: 'SUCCEEDED+active',
        enrichment: 'SUCCEEDED+active',
        evidence: 'SUCCEEDED+active',
      },
      model: ex.model,
      promptVersion: ex.promptVersion,
      extractorVersion: ex.extractorVersion,
      driveFileId: ex.driveFileId,
      skillsCount: 37,
      sourceHashEquality: {
        extraction: true,
        enrichment: true,
        evidenceViaEnrichment: true,
      },
    },
    comparison: {
      skills87: integrity.skills87,
      skills207: integrity.skills207,
      skillChanges: changes,
      evidencePrevious: oldSkills,
      evidenceNew: newSkills,
      evidenceMetricsPrevious: evOld.metrics ?? evOld.evidenceLevels ?? null,
      evidenceMetricsNew: evNew.outcome.metrics,
    },
    documentaryClassification: {
      PROFESSIONAL_CORE: ['Diseño Gráfico'],
      PROFESSIONAL_SUPPORT: [
        'Inteligencia Artificial',
        'Prompting',
        'SCORM',
        'LMS',
        'Control de Calidad (QA)',
        'Adobe Illustrator',
        'Adobe Photoshop',
        'Adobe InDesign',
      ],
      TRANSVERSAL: integrity.skills207
        .filter((s) => s.type === 'SOFT_SKILL')
        .map((s) => s.name),
      AMBIGUOUS: ['Diseño editorial', 'Diseño instruccional'],
      INSUFFICIENT_EVIDENCE: newSkills
        .filter((s) => s.level === 'NONE')
        .map((s) => s.name),
    },
    groupings: {
      areaRecommended: 'Diseño y producción de contenidos',
      activeSpecialtyCandidate: 'Diseño gráfico',
      rejectedPreliminaryGrouping: 'Diseño editorial y gráfico',
      specialties: [
        {
          name: 'Diseño gráfico',
          status: 'SUPPORTED',
          note: 'MODERATE 66 + Adobe tools',
        },
        {
          name: 'Diseño gráfico y publicitario',
          status: 'EMERGING',
          note: 'Gráfico sí; publicitario solo nominal',
        },
        {
          name: 'Diseño editorial',
          status: 'INSUFFICIENT',
          note: 'WEAK 5',
        },
        {
          name: 'Diseño instruccional',
          status: 'EMERGING',
          note: 'Skill WEAK; SCORM/LMS MODERATE',
        },
        {
          name: 'Producción audiovisual',
          status: 'INSUFFICIENT',
          note: 'Tools NONE',
        },
        {
          name: 'Estrategia y planificación de contenidos',
          status: 'REJECTED',
          note: 'Ausente en 207',
        },
        {
          name: 'IA aplicada a contenidos',
          status: 'EMERGING',
          note: 'IA+Prompting MODERATE; no especialidad autónoma',
        },
        {
          name: 'Dirección creativa',
          status: 'REJECTED',
          note: 'Ausente',
        },
      ],
    },
    domainDecision: {
      area: 'Diseño y producción de contenidos',
      supportedSpecialties: ['Diseño gráfico'],
      emergingSpecialties: [
        'Diseño gráfico y publicitario',
        'Diseño instruccional',
        'IA aplicada a contenidos',
      ],
      insufficient: ['Diseño editorial', 'Producción audiovisual'],
      rejected: [
        'Estrategia y planificación de contenidos',
        'Dirección creativa',
      ],
      iaTreatment:
        'PROFESSIONAL_SUPPORT / EMERGING specialty — not SUPPORTED alone',
    },
    integrity: integrity.integrity,
    warnings: [
      '25 skills con Evidence NONE (listings).',
      'Diseño publicitario REMOVED respecto a extracción 87.',
      'No PA2 / mappings / catálogo / frontend en esta fase.',
      'Parte del salto 9→37 atribuible a extractor c2.1/1.1.0 además del PDF nuevo.',
    ],
  };

  const dir = resolve(process.cwd(), 'tmp', 'cv-attributes');
  mkdirSync(dir, { recursive: true });
  const outPath = resolve(dir, 'mc1.5.2c-1015482688-pipeline-comparison.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(JSON.stringify({ path: outPath, ok: true }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
