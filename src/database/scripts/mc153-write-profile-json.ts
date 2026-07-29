/**
 * MC1.5.3 — Artefacto JSON del perfil 1022445625 + comparación Nidia.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

function load(rel: string): any {
  return JSON.parse(readFileSync(resolve(process.cwd(), rel), 'utf8'));
}

function latestEvidence(prefix: string): any {
  const dir = resolve(process.cwd(), 'tmp', 'cv-evidence');
  const file = readdirSync(dir)
    .filter((f) => f.startsWith(prefix))
    .sort()
    .pop();
  if (!file) throw new Error(`No evidence artifact for ${prefix}`);
  return load(`tmp/cv-evidence/${file}`);
}

async function main() {
  const audit = load('tmp/cv-attributes/mc1.5.3-1022445625-audit.json');
  const ex = load('tmp/cv-skills/1022445625.json');
  const enrich = load(
    'tmp/cv-skills-enrichment/1022445625-e1-20260727-140950.json',
  );
  const ev = latestEvidence('enrichment-6-');
  const nidia = load(
    'tmp/cv-attributes/mc1.5.2c-1015482688-pipeline-comparison.json',
  );

  const skills = (ex.result?.categories ?? []).flatMap((c: any) =>
    (c.skills ?? []).map((s: any) => ({
      category: c.category,
      name: s.normalizedName,
      type: s.skillType,
      evidenceItems: s.evidenceItems ?? [],
    })),
  );

  const evidenceSkills = (ev.outcome?.result?.skills ?? []).map((s: any) => ({
    name: s.normalizedName,
    level: s.evidenceLevel,
    strength: s.evidenceStrength,
    confidence: s.evidenceConfidence,
    sourceBreakdown: s.sourceBreakdown,
    qualityFlags: s.qualityFlags,
  }));

  const documentaryClassification = {
    PROFESSIONAL_CORE: [
      'Animación 2D/3D',
      'Fotografía comercial',
      'Manuales de identidad corporativa',
    ],
    PROFESSIONAL_SUPPORT: [
      'Adobe After Effects',
      'Adobe Premiere Pro',
      'CapCut',
      'iSpring',
      'Adobe InDesign',
      'Retoque fotográfico',
      'Masterización de audio',
    ],
    TRANSVERSAL: ['capacidad para liderar equipos creativos'],
    AMBIGUOUS: [
      'Edición de video',
      'Mockups publicitarios',
      'E-mail marketing',
      'Streaming',
    ],
    INSUFFICIENT_EVIDENCE: evidenceSkills
      .filter((s: any) => s.level === 'NONE' || (s.level === 'WEAK' && s.strength <= 1))
      .map((s: any) => s.name),
  };

  const specialtyComparison = [
    {
      specialty: 'Diseño gráfico',
      nidia: 'SUPPORTED',
      profile1022445625: 'EMERGING',
      result: 'SUPPORTED_BY_ONE_PROFILE',
    },
    {
      specialty: 'Diseño instruccional',
      nidia: 'EMERGING',
      profile1022445625: 'EMERGING',
      result: 'EMERGING',
    },
    {
      specialty: 'Producción audiovisual',
      nidia: 'INSUFFICIENT',
      profile1022445625: 'SUPPORTED',
      result: 'SUPPORTED_BY_ONE_PROFILE',
    },
    {
      specialty: 'IA aplicada',
      nidia: 'EMERGING',
      profile1022445625: 'REJECTED',
      result: 'SUPPORTED_BY_ONE_PROFILE',
    },
    {
      specialty: 'Editorial',
      nidia: 'INSUFFICIENT',
      profile1022445625: 'INSUFFICIENT',
      result: 'REJECTED',
    },
  ];

  const out = {
    meta: {
      phase: 'MC1.5.3',
      document: '1022445625',
      personId: 1176,
      personCvId: 104,
      fullName: 'JUAN PABLO SANABRIA DIAZ',
      generatedAt: new Date().toISOString(),
    },
    audit: {
      person: audit.person,
      stageTableBefore: audit.stageTable,
      drift: audit.drift,
    },
    pipeline: {
      action: 'REEXTRACT_THEN_ENRICH_EVIDENCE',
      historicalExtractionId: '104',
      historicalExtractionHash: audit.drift.activeExtractionHash,
      current: {
        extractionId: String(ex.extractionId ?? 208),
        enrichmentId: '6',
        evidenceId: '6',
        pdfSha256: ex.pdfSha256,
        driveFileId: ex.driveFileId,
        model: ex.model,
        promptVersion: ex.promptVersion,
        extractorVersion: ex.extractorVersion,
        skillsCount: skills.length,
        status: {
          extraction: 'SUCCEEDED+active',
          enrichment: 'SUCCEEDED+active',
          evidence: 'SUCCEEDED+active',
        },
        sourceHashEquality: {
          extractionHash: ex.pdfSha256,
          enrichmentHash: enrich.meta?.pdfSha256 ?? null,
          extractionEqualsEnrichment:
            String(ex.pdfSha256).toLowerCase() ===
            String(enrich.meta?.pdfSha256 ?? '').toLowerCase(),
          evidenceViaEnrichment: true,
        },
      },
      zeroPa2: true,
    },
    skills,
    enrichment: {
      enrichmentId: '6',
      extractionId: '208',
      artifact:
        'tmp/cv-skills-enrichment/1022445625-e1-20260727-140950.json',
      inputSkills: enrich.metrics?.inputSkills ?? enrich.inventory?.skills?.length ?? 22,
      outputSkills:
        enrich.metrics?.outputSkills ??
        enrich.validatedResult?.skills?.length ??
        22,
    },
    evidence: {
      evaluationId: '6',
      enrichmentId: '6',
      metrics: ev.outcome?.metrics,
      skills: evidenceSkills,
    },
    documentaryClassification,
    groupings: [
      {
        name: 'Producción y edición audiovisual',
        status: 'CORE',
        skills: [
          'Adobe Premiere Pro',
          'Adobe After Effects',
          'CapCut',
          'Edición de video',
          'Animación 2D/3D',
        ],
      },
      {
        name: 'Fotografía y retoque',
        status: 'CORE',
        skills: ['Fotografía comercial', 'Retoque fotográfico'],
      },
      {
        name: 'Identidad de marca y piezas gráficas',
        status: 'CORE_ADJACENT',
        skills: [
          'Manuales de identidad corporativa',
          'Mockups publicitarios',
          'Adobe InDesign',
        ],
      },
      {
        name: 'Contenidos educativos interactivos',
        status: 'EMERGING',
        skills: ['iSpring', 'Adobe InDesign'],
      },
      {
        name: 'Audio y streaming',
        status: 'WEAK_SUPPORT',
        skills: [
          'Masterización de audio',
          'Protools',
          'FL Studio',
          'Ableton Live',
          'Traktor',
          'OBS Studio',
          'Streaming',
        ],
      },
    ],
    comparisonWithNidia: {
      nidiaPipeline: nidia.current,
      specialtyComparison,
      domainArea: {
        proposed: 'Diseño y Producción de Contenidos',
        stillCorrect: true,
        rationale:
          'Perfiles complementarios (gráfico/e-learning/IA vs audiovisual/animación/fotografía) bajo el mismo área.',
      },
      specialtyDecisions: [
        { name: 'Diseño gráfico', decision: 'EMERGING' },
        { name: 'Producción audiovisual', decision: 'EMERGING' },
        { name: 'Diseño instruccional', decision: 'EMERGING' },
        { name: 'IA aplicada a contenidos', decision: 'EMERGING' },
        { name: 'Editorial', decision: 'REMOVE' },
        { name: 'Motion graphics', decision: 'EMERGING' },
      ],
      validatedAcrossBoth: [],
      readyForMc161: {
        domainAreaDraft: true,
        freezeSpecialtyContracts: false,
        note: 'Dominio respaldado por 2 perfiles; ninguna especialidad VALIDATED en ambos. Pilares complementarios: Diseño gráfico + Producción audiovisual.',
      },
    },
    warnings: [
      'Extracción 104 histórica con hash distinto; no reutilizar.',
      'Skill nominal Edición de video WEAK; actividad AV vía herramientas MODERATE.',
      'Sin IA ni Diseño Gráfico explícitos en este perfil.',
      'Cero PA2 / mappings / catálogo en esta fase.',
    ],
  };

  const dir = resolve(process.cwd(), 'tmp', 'cv-attributes');
  mkdirSync(dir, { recursive: true });
  const outPath = resolve(dir, 'mc1.5.3-profile-1022445625.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(JSON.stringify({ path: outPath, ok: true }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
