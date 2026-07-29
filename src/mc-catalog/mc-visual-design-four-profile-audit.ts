/**
 * MC1.6 — Motor puro de auditoría Diseño Visual (cuatro perfiles).
 * Dry-run PA2 vía simulateVisualPa2WithPack. Sin writes. Sin cargo/área/jefe.
 */

import { MC_CATALOG_VERSION } from './mc-catalog.constants';
import {
  MC_VISUAL_DESIGN_SPECIALTY_CODES,
  MC1_CATALOG_DEFINITION,
} from './mc-catalog.definition-mc12';
import { MC_VISUAL_DESIGN_MAPPING_PACK_V120 } from './mc-catalog.mapping-visual-design-v120';
import { MC_VISUAL_DESIGN_MAPPING_RULES_VERSION_V120 } from './mc-catalog.mapping-visual-design-v120';
import { simulateVisualPa2WithPack } from './mc-catalog.visual-pack-simulate';
import type { McDomainMappingPack } from './mc-catalog.types';
import type {
  McVdCrossDomainKind,
  McVdFourProfileAuditReport,
  McVdGapKind,
  McVdPersonDiagnosis,
  McVdProfileSkill,
  McVdProfileSnapshot,
  McVdSharedToolNote,
  McVdSkillGapRow,
  McVdSkillSource,
  McVdSpecialtyCatalogAudit,
  McVdVerdictCode,
} from './mc-visual-design-four-profile-audit.types';
import {
  MC_VD_FOUR_AUDIT_VERSION,
  MC_VD_FOUR_TARGET_DOCUMENTS,
} from './mc-visual-design-four-profile-audit.types';

const VISUALISH_RE =
  /diseno|identidad|branding|editorial|diagram|maquet|ilustr|graf|visual|retoque|pieza|marca|catalogo|publicitar|tipograf|fotogra|indesign|photoshop|illustrator|figma|canva|premiere|after.?effects/i;

const SHARED_TOOLS: McVdSharedToolNote[] = [
  {
    skillKey: 'adobe_after_effects',
    kind: 'CONTEXT_DEPENDENT',
    distinctionHint:
      'AE + animación de piezas gráficas → Motion Graphics (Visual/AV frontera); AE + edición/composición de video → AUDIOVISUAL',
  },
  {
    skillKey: 'adobe_premiere_pro',
    kind: 'AUDIOVISUAL_ONLY',
    distinctionHint: 'NLE de video; no evidencia por sí sola de Diseño Visual',
  },
  {
    skillKey: 'adobe_photoshop',
    kind: 'SHARED',
    distinctionHint:
      'Retoque/composición estática → Visual; composición de video/frames → AV',
  },
  {
    skillKey: 'adobe_illustrator',
    kind: 'VISUAL_ONLY',
    distinctionHint: 'Herramienta gráfica vectorial típica de Diseño Visual',
  },
  {
    skillKey: 'fotografia',
    kind: 'CONTEXT_DEPENDENT',
    distinctionHint:
      'Fotografía + retoque/edición de imagen → Visual; fotografía de rodaje → AV',
  },
  {
    skillKey: 'motion_graphics',
    kind: 'CONTEXT_DEPENDENT',
    distinctionHint: 'Práctica híbrida Visual/AV; requiere evidencia de entregable',
  },
  {
    skillKey: 'figma',
    kind: 'CONTEXT_DEPENDENT',
    distinctionHint:
      'UI visual/prototipo → VISUAL_UI; sistemas + implementación front → Software',
  },
  {
    skillKey: 'diseno_ux/ui',
    kind: 'CONTEXT_DEPENDENT',
    distinctionHint:
      'Pack V120: TRANSVERSAL sin mapping UI forzado; no auto-Software',
  },
  {
    skillKey: 'prototipado_de_aplicaciones_e_interfaces_(ui/ux)',
    kind: 'CONTEXT_DEPENDENT',
    distinctionHint: 'Prototipado visual ≠ frontend técnico',
  },
];

export function isVisualishSkillKey(key: string): boolean {
  return VISUALISH_RE.test(key);
}

export function classifySharedTool(skillKey: string): McVdCrossDomainKind {
  const hit = SHARED_TOOLS.find((t) => t.skillKey === skillKey);
  if (hit) return hit.kind;
  if (/premiere|capcut|davinci|final_cut/i.test(skillKey)) return 'AUDIOVISUAL_ONLY';
  if (/react|typescript|nodejs|java|python|sql/i.test(skillKey)) return 'SOFTWARE_ONLY';
  if (isVisualishSkillKey(skillKey)) return 'VISUAL_ONLY';
  return 'NOT_APPLICABLE';
}

function packIndexes(pack: McDomainMappingPack) {
  const classificationByKey = new Map(
    pack.classifications.map((c) => [`${c.skillKey}|${c.skillType}`, c]),
  );
  const mappingsByKey = new Map<string, typeof pack.mappings>();
  for (const m of pack.mappings) {
    const k = `${m.skillKey}|${m.skillType}`;
    const arr = mappingsByKey.get(k) ?? [];
    arr.push(m);
    mappingsByKey.set(k, arr);
  }
  const anyKey = new Set(pack.classifications.map((c) => c.skillKey));
  for (const m of pack.mappings) anyKey.add(m.skillKey);
  return { classificationByKey, mappingsByKey, anyKey };
}

export function classifySkillAgainstVisualPack(
  skill: McVdProfileSkill,
  pack: McDomainMappingPack = MC_VISUAL_DESIGN_MAPPING_PACK_V120,
): McVdSkillGapRow {
  const { classificationByKey, mappingsByKey, anyKey } = packIndexes(pack);
  const key = `${skill.skillKey}|${skill.skillType}`;
  const cls = classificationByKey.get(key);
  const maps = mappingsByKey.get(key) ?? [];
  const inPack = anyKey.has(skill.skillKey) || !!cls;
  const evidenceAvailable = skill.evidenceLevel !== 'NONE';
  const specialtyTargets = [...new Set(maps.map((m) => m.specialtyCode))];
  const cross = classifySharedTool(skill.skillKey);

  if (cross === 'AUDIOVISUAL_ONLY' || cross === 'SOFTWARE_ONLY') {
    return {
      skillKey: skill.skillKey,
      skillName: skill.skillName,
      canonicalInPack: inPack,
      evidenceAvailable,
      aliasApplied: false,
      recognizedByVisual: false,
      specialtyTargets,
      gap: 'CROSS_DOMAIN_ONLY',
      reason: `Clasificación ${cross}; no debe forzar VISUAL_DESIGN`,
      potentialAction: 'Mantener fuera de Visual salvo práctica evidenciada',
    };
  }

  if (!isVisualishSkillKey(skill.skillKey) && !inPack) {
    return {
      skillKey: skill.skillKey,
      skillName: skill.skillName,
      canonicalInPack: false,
      evidenceAvailable,
      aliasApplied: false,
      recognizedByVisual: false,
      specialtyTargets: [],
      gap: 'NOT_VISUAL',
      reason: 'No parece evidencia de Diseño Visual',
      potentialAction: 'Ignorar para dominio Visual',
    };
  }

  if (!inPack && isVisualishSkillKey(skill.skillKey)) {
    return {
      skillKey: skill.skillKey,
      skillName: skill.skillName,
      canonicalInPack: false,
      evidenceAvailable,
      aliasApplied: false,
      recognizedByVisual: false,
      specialtyTargets: [],
      gap: 'ALIAS_GAP',
      reason: 'Skill visualish ausente del pack (alias/catálogo)',
      potentialAction: 'VD-1 alias o VD-2 skill canónica',
    };
  }

  if (cls && cls.classification === 'OUTSIDE_SOFTWARE_DOMAIN' && maps.length === 0) {
    return {
      skillKey: skill.skillKey,
      skillName: skill.skillName,
      canonicalInPack: true,
      evidenceAvailable,
      aliasApplied: true,
      recognizedByVisual: false,
      specialtyTargets: [],
      gap: 'UNMAPPED_SKILL',
      reason: 'Clasificada OUTSIDE en pack (p.ej. Adobe genérico)',
      potentialAction: 'No mapear genéricos; pedir tools específicas',
    };
  }

  if (cls && cls.classification === 'TRANSVERSAL_FUTURE' && maps.length === 0) {
    return {
      skillKey: skill.skillKey,
      skillName: skill.skillName,
      canonicalInPack: true,
      evidenceAvailable,
      aliasApplied: true,
      recognizedByVisual: false,
      specialtyTargets: [],
      gap: 'MISSING_SPECIALTY',
      reason: 'TRANSVERSAL / UI reservada sin mapping a especialidad',
      potentialAction: 'VD-4 especialidad VISUAL_UI o política explícita',
    };
  }

  if (cls && maps.length === 0) {
    return {
      skillKey: skill.skillKey,
      skillName: skill.skillName,
      canonicalInPack: true,
      evidenceAvailable,
      aliasApplied: true,
      recognizedByVisual: false,
      specialtyTargets: [],
      gap: 'MAPPING_GAP',
      reason: 'Clasificación presente sin mapping a especialidad',
      potentialAction: 'VD-3 mapping',
    };
  }

  if (maps.length > 0) {
    const maxW = Math.max(...maps.map((m) => m.weight));
    if (maxW < 0.2 && evidenceAvailable) {
      return {
        skillKey: skill.skillKey,
        skillName: skill.skillName,
        canonicalInPack: true,
        evidenceAvailable,
        aliasApplied: true,
        recognizedByVisual: true,
        specialtyTargets,
        gap: 'LOW_WEIGHT_MAPPING',
        reason: `Mapping existe pero peso máximo=${maxW}`,
        potentialAction: 'Revisar peso solo con evidencia fuerte (no en esta fase)',
      };
    }
    return {
      skillKey: skill.skillKey,
      skillName: skill.skillName,
      canonicalInPack: true,
      evidenceAvailable,
      aliasApplied: true,
      recognizedByVisual: true,
      specialtyTargets,
      gap: 'NONE',
      reason: 'Reconocida por pack Visual vigente',
      potentialAction: 'Ninguna',
    };
  }

  return {
    skillKey: skill.skillKey,
    skillName: skill.skillName,
    canonicalInPack: inPack,
    evidenceAvailable,
    aliasApplied: false,
    recognizedByVisual: false,
    specialtyTargets: [],
    gap: 'UNKNOWN_ALIAS',
    reason: 'Estado de alias no determinado',
    potentialAction: 'Auditar enrichment key',
  };
}

export function runVisualDesignDryRunForProfile(
  profile: McVdProfileSnapshot,
  pack: McDomainMappingPack = MC_VISUAL_DESIGN_MAPPING_PACK_V120,
): McVdPersonDiagnosis['dryRun'] {
  if (!profile.found || profile.skills.length === 0) {
    return {
      qualification: 'NOT_AVAILABLE',
      activeCount: null,
      emergentCount: null,
      hiddenCount: null,
      coverageSummary: null,
      warnings: [
        profile.chain.cv === 'MISSING'
          ? 'CHAIN_CV_MISSING'
          : 'NO_SKILLS_FOR_DRY_RUN',
      ],
      specialties: [],
      mappedSkillKeys: [],
      unmappedDomainSpecialtyKeys: [],
    };
  }

  const sim = simulateVisualPa2WithPack({
    pack,
    packVersion: MC_VISUAL_DESIGN_MAPPING_RULES_VERSION_V120,
    skills: profile.skills.map((s, i) => ({
      skillId: String(i + 1),
      skillKey: s.skillKey,
      skillName: s.skillName,
      skillType: s.skillType,
      evidenceLevel: s.evidenceLevel,
      evidenceStrength: s.evidenceStrength,
      evidenceConfidence: s.evidenceConfidence,
    })),
  });

  const expectedBySpecialty = new Map<string, string[]>();
  for (const m of pack.mappings) {
    const arr = expectedBySpecialty.get(m.specialtyCode) ?? [];
    if (!arr.includes(m.skillKey)) arr.push(m.skillKey);
    expectedBySpecialty.set(m.specialtyCode, arr);
  }
  const profileKeys = new Set(profile.skills.map((s) => s.skillKey));

  const specialties = sim.result.specialtyResults.map((r) => {
    const expected = expectedBySpecialty.get(r.specialtyCode) ?? [];
    const found = expected.filter((k) => profileKeys.has(k));
    let reason: string = String(r.presentationStatus);
    if (r.presentationStatus === 'HIDDEN' && found.length === 0) {
      reason = 'Sin skills mapeadas presentes en perfil';
    } else if (
      r.presentationStatus === 'HIDDEN' &&
      found.length > 0 &&
      r.evidencedSkillCount === 0
    ) {
      reason = 'Skills presentes pero evidencia NONE';
    } else if (
      r.presentationStatus === 'EMERGENT' &&
      r.mappedSkillCount < 2
    ) {
      reason = 'EVALUATION_GAP: cardinalidad ACTIVE exige ≥2 skills evidenciadas';
    }
    return {
      specialtyCode: r.specialtyCode,
      specialtyName: r.specialtyName,
      status: r.presentationStatus,
      strength: r.strength,
      coverage: r.coverage,
      mappedSkillCount: r.mappedSkillCount,
      evidencedSkillCount: r.evidencedSkillCount,
      expectedSkillKeys: expected,
      foundSkillKeys: found,
      reason,
    };
  });

  const coverages = specialties
    .map((s) => s.coverage)
    .filter((n): n is number => n != null && Number.isFinite(n));
  const coverageSummary =
    coverages.length > 0
      ? coverages.reduce((a, b) => a + b, 0) / coverages.length
      : null;

  const warnings = [...sim.result.warnings];
  if (sim.unmappedDomainSpecialtyKeys.length > 0) {
    warnings.push(
      `UNMAPPED_DOMAIN_SPECIALTY_KEYS:${sim.unmappedDomainSpecialtyKeys.join(',')}`,
    );
  }

  return {
    qualification: sim.conceptualClass,
    activeCount: sim.result.activeCount,
    emergentCount: sim.result.emergentCount,
    hiddenCount: sim.result.hiddenCount,
    coverageSummary,
    warnings,
    specialties,
    mappedSkillKeys: sim.mappedSkillKeys,
    unmappedDomainSpecialtyKeys: sim.unmappedDomainSpecialtyKeys,
  };
}

function verdictsFor(
  profile: McVdProfileSnapshot,
  dryRun: NonNullable<McVdPersonDiagnosis['dryRun']>,
  gaps: McVdSkillGapRow[],
): { verdicts: McVdVerdictCode[]; layer: string } {
  if (!profile.found) {
    return { verdicts: ['PERSON_NOT_FOUND', 'LIVE_DATA_REQUIRED'], layer: 'Lookup' };
  }
  if (profile.chain.cv === 'MISSING') {
    return {
      verdicts: ['CHAIN_INCOMPLETE', 'INSUFFICIENT_CV_EVIDENCE'],
      layer: 'Extraction',
    };
  }
  if (profile.dataSource === 'FIXTURE_UNKNOWN') {
    return { verdicts: ['LIVE_DATA_REQUIRED'], layer: 'Lookup' };
  }

  const alias = gaps.filter((g) => g.gap === 'ALIAS_GAP' || g.gap === 'UNKNOWN_ALIAS');
  const mapping = gaps.filter((g) => g.gap === 'MAPPING_GAP' || g.gap === 'UNMAPPED_SKILL');
  const missingSpec = gaps.filter((g) => g.gap === 'MISSING_SPECIALTY');
  const verdicts: McVdVerdictCode[] = [];

  if (alias.length > 0) verdicts.push('ALIAS_GAP');
  if (mapping.length > 0) verdicts.push('MAPPING_GAP');
  if (missingSpec.length > 0) verdicts.push('DOMAIN_MODEL_GAP');

  if (dryRun.qualification === 'PRIMARY_MATCH' && alias.length === 0) {
    verdicts.push('RESULT_REASONABLE');
  } else if (dryRun.qualification === 'SECONDARY_SIGNAL') {
    if (dryRun.mappedSkillKeys.length > 0) verdicts.push('PA2_GAP');
    else verdicts.push('MAPPING_GAP');
  } else if (dryRun.qualification === 'OUTSIDE') {
    if (alias.length > 0) verdicts.push('ALIAS_GAP');
    else if (mapping.length > 0) verdicts.push('MAPPING_GAP');
    else verdicts.push('INSUFFICIENT_CV_EVIDENCE');
  } else if (dryRun.qualification === 'NOT_AVAILABLE') {
    verdicts.push('INSUFFICIENT_CV_EVIDENCE');
  }

  if (verdicts.length === 0) verdicts.push('RESULT_REASONABLE');

  const layer =
    alias.length > 0
      ? 'Aliases'
      : mapping.length > 0
        ? 'Mappings'
        : missingSpec.length > 0
          ? 'Specialties'
          : dryRun.qualification === 'SECONDARY_SIGNAL'
            ? 'PA2'
            : 'Skill catalog';

  return { verdicts: [...new Set(verdicts)], layer };
}

export function diagnoseVisualDesignProfile(
  profile: McVdProfileSnapshot,
  pack: McDomainMappingPack = MC_VISUAL_DESIGN_MAPPING_PACK_V120,
): McVdPersonDiagnosis {
  const skillGaps = profile.skills.map((s) =>
    classifySkillAgainstVisualPack(s, pack),
  );
  const unusedVisualEvidence = skillGaps.filter(
    (g) =>
      g.gap !== 'NONE' &&
      g.gap !== 'NOT_VISUAL' &&
      (g.evidenceAvailable || isVisualishSkillKey(g.skillKey)),
  );
  const dryRun = runVisualDesignDryRunForProfile(profile, pack);

  // EVALUATION_GAP: mapped + evidenced but specialty still HIDDEN/EMERGENT unexpectedly
  for (const s of dryRun?.specialties ?? []) {
    if (
      s.foundSkillKeys.length >= 2 &&
      s.evidencedSkillCount >= 1 &&
      s.status === 'HIDDEN'
    ) {
      unusedVisualEvidence.push({
        skillKey: s.specialtyCode,
        skillName: s.specialtyName,
        canonicalInPack: true,
        evidenceAvailable: true,
        aliasApplied: true,
        recognizedByVisual: true,
        specialtyTargets: [s.specialtyCode],
        gap: 'EVALUATION_GAP',
        reason: s.reason,
        potentialAction: 'VD-5 validación PA2 (sin bajar umbrales a ciegas)',
      });
    }
  }

  const { verdicts, layer } = verdictsFor(
    profile,
    dryRun ?? {
      qualification: 'NOT_AVAILABLE',
      activeCount: null,
      emergentCount: null,
      hiddenCount: null,
      coverageSummary: null,
      warnings: [],
      specialties: [],
      mappedSkillKeys: [],
      unmappedDomainSpecialtyKeys: [],
    },
    skillGaps,
  );

  return {
    document: profile.document,
    personId: profile.personId,
    found: profile.found,
    dataSource: profile.dataSource,
    chain: profile.chain,
    dryRun,
    skillGaps,
    unusedVisualEvidence,
    verdicts,
    recommendedLayer: layer,
    notes: [...profile.chain.notes],
  };
}

export function auditVisualSpecialtyCatalog(
  diagnoses: McVdPersonDiagnosis[],
  pack: McDomainMappingPack = MC_VISUAL_DESIGN_MAPPING_PACK_V120,
): McVdSpecialtyCatalogAudit[] {
  const domain = MC1_CATALOG_DEFINITION.domains.find(
    (d) => d.code === 'VISUAL_DESIGN',
  );
  const docs = diagnoses.filter((d) => d.found && (d.dryRun?.specialties.length ?? 0) > 0);

  return MC_VISUAL_DESIGN_SPECIALTY_CODES.map((code) => {
    const def = domain?.specialties.find((s) => s.code === code);
    const mappingCount = pack.mappings.filter((m) => m.specialtyCode === code).length;
    const classificationCount = pack.classifications.filter((c) =>
      pack.mappings.some(
        (m) => m.skillKey === c.skillKey && m.specialtyCode === code,
      ),
    ).length;
    const coverageInProfiles = docs.filter((d) =>
      d.dryRun?.specialties.some(
        (s) =>
          s.specialtyCode === code &&
          (s.status === 'ACTIVE' || s.status === 'EMERGENT'),
      ),
    ).length;

    let maturity: McVdSpecialtyCatalogAudit['maturity'] = 'EXISTS';
    let diagnosis = 'Operativa con mappings';
    if (code === 'VISUAL_UI') {
      maturity = 'RESERVED';
      diagnosis = 'Catálogo ACTIVE pero 0 mappings (RESERVED documental)';
    } else if (code === 'VISUAL_DIGITAL_ASSETS') {
      maturity = 'DEPRECATED_IN_DOCS';
      diagnosis = 'Tool-led / anti-tool PA2; madurez documental DEPRECATED';
    } else if (mappingCount === 0) {
      maturity = 'MISSING';
      diagnosis = 'Sin mappings';
    } else if (coverageInProfiles === 0 && docs.length > 0) {
      maturity = 'PARTIAL';
      diagnosis = 'Mappings existen pero 0 cobertura ACTIVE/EMERGENT en corpus';
    } else if (mappingCount < 4) {
      maturity = 'PARTIAL';
      diagnosis = 'Pocos mappings; cobertura frágil';
    }

    return {
      specialtyCode: code,
      specialtyName: def?.name ?? code,
      mappingCount,
      classificationCount,
      coverageInProfiles,
      maturity,
      diagnosis,
    };
  });
}

const COMPARISON_DIMENSIONS: Array<{ id: string; match: RegExp }> = [
  { id: 'diseno_grafico', match: /diseno_grafico/ },
  { id: 'identidad_branding', match: /identidad|branding|diseno_de_marca/ },
  { id: 'editorial_diagramacion', match: /editorial|diagram|maquet/ },
  { id: 'ilustracion', match: /ilustr/ },
  { id: 'adobe_illustrator', match: /illustrator/ },
  { id: 'adobe_photoshop', match: /photoshop/ },
  { id: 'adobe_indesign', match: /indesign/ },
  { id: 'after_effects', match: /after.?effects/ },
  { id: 'premiere', match: /premiere/ },
  { id: 'figma_ui', match: /figma|ux\/ui|prototip/ },
  { id: 'canva', match: /canva/ },
  { id: 'fotografia_retoque', match: /foto|retoque/ },
  { id: 'motion_graphics', match: /motion/ },
];

export function buildComparisonMatrix(
  profiles: McVdProfileSnapshot[],
): McVdFourProfileAuditReport['comparisonMatrix'] {
  return COMPARISON_DIMENSIONS.map((dim) => {
    const cells: Record<string, McVdSkillSource> = {};
    for (const p of profiles) {
      const hit = p.skills.find((s) => dim.match.test(s.skillKey));
      cells[p.document] = hit ? hit.source : 'NOT_FOUND';
    }
    return { dimension: dim.id, cells };
  });
}

export function detectRepeatedPatterns(
  diagnoses: McVdPersonDiagnosis[],
): McVdFourProfileAuditReport['repeatedPatterns'] {
  const byGap = new Map<string, string[]>();
  for (const d of diagnoses) {
    for (const g of d.unusedVisualEvidence) {
      if (g.gap === 'NONE' || g.gap === 'NOT_VISUAL') continue;
      const key = `${g.gap}:${g.skillKey}`;
      const docs = byGap.get(key) ?? [];
      if (!docs.includes(d.document)) docs.push(d.document);
      byGap.set(key, docs);
    }
    for (const v of d.verdicts) {
      const key = `VERDICT:${v}`;
      const docs = byGap.get(key) ?? [];
      if (!docs.includes(d.document)) docs.push(d.document);
      byGap.set(key, docs);
    }
  }

  const patterns: McVdFourProfileAuditReport['repeatedPatterns'] = [];
  for (const [pattern, documents] of [...byGap.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (documents.length < 2 && !pattern.startsWith('VERDICT:')) continue;
    const layer = pattern.includes('ALIAS')
      ? 'Aliases'
      : pattern.includes('MAPPING') || pattern.includes('UNMAPPED')
        ? 'Mappings'
        : pattern.includes('PA2') || pattern.includes('EVALUATION')
          ? 'PA2'
          : pattern.includes('SPECIALTY') || pattern.includes('DOMAIN_MODEL')
            ? 'Specialties'
            : pattern.includes('CHAIN') || pattern.includes('CV')
              ? 'Extraction'
              : 'Skill catalog';
    patterns.push({
      pattern,
      layer,
      documents,
      severity: documents.length >= 3 ? 'HIGH' : documents.length === 2 ? 'MEDIUM' : 'LOW',
    });
  }
  return patterns;
}

function globalLayers(
  diagnoses: McVdPersonDiagnosis[],
  patterns: McVdFourProfileAuditReport['repeatedPatterns'],
): McVdFourProfileAuditReport['globalLayerSummary'] {
  const layers = [
    'Extraction',
    'Enrichment',
    'Skill catalog',
    'Aliases',
    'Specialties',
    'Mappings',
    'PA2',
    'Qualification',
    'CDR',
    'Frontend',
  ];
  return layers.map((layer, i) => {
    const related = patterns.filter((p) => p.layer === layer);
    const docs = new Set(related.flatMap((p) => p.documents));
    // Frontend: no culpar si backend pobre
    const backendPoor = diagnoses.some(
      (d) =>
        d.dryRun?.qualification === 'OUTSIDE' ||
        d.dryRun?.qualification === 'SECONDARY_SIGNAL' ||
        d.dryRun?.qualification === 'NOT_AVAILABLE',
    );
    const gapCount =
      layer === 'Frontend' && backendPoor ? 0 : related.length;
    const severity: 'HIGH' | 'MEDIUM' | 'LOW' =
      layer === 'Frontend'
        ? 'LOW'
        : related.some((p) => p.severity === 'HIGH')
          ? 'HIGH'
          : related.length > 0
            ? 'MEDIUM'
            : 'LOW';
    return {
      layer,
      gapCount,
      severity,
      documentsAffected: docs.size,
      priority: gapCount === 0 ? 99 : i + 1,
    };
  }).sort((a, b) => a.priority - b.priority);
}

const STRENGTHENING_PLAN: McVdFourProfileAuditReport['strengtheningPlan'] = [
  {
    phase: 'VD-1',
    change: 'Aliases faltantes de vocabulario CV visual (sin inventar por cargo)',
    expectedResult: 'Más skills llegan a keys canónicas del pack',
    risk: 'Bajo si se ancla a keys observadas en ≥2 perfiles',
  },
  {
    phase: 'VD-2',
    change: 'Skills canónicas faltantes (publicitario, tipografía, dirección de arte)',
    expectedResult: 'Reducir ALIAS_GAP / MISSING_CATALOG_SKILL',
    risk: 'Medio: evitar duplicar GRAPHIC',
  },
  {
    phase: 'VD-3',
    change: 'Mappings incompletos a GRAPHIC/IDENTITY/EDITORIAL',
    expectedResult: 'Especialidades EMERGENT→ACTIVE con evidencia real',
    risk: 'Medio: pesos SECONDARY pueden sesgar a GRAPHIC',
  },
  {
    phase: 'VD-4',
    change: 'Especialidades pobres/faltantes (UI mappings, publicitario, foto/retoque)',
    expectedResult: 'Mejor representación profesional sin inflar DIGITAL',
    risk: 'Alto si se reactiva DIGITAL o se fuerza UI',
  },
  {
    phase: 'VD-5',
    change: 'Validación PA2 (cardinalidad ≥2) sin bajar umbrales a ciegas',
    expectedResult: 'Confirmar PA2_GAP vs mapping gap',
    risk: 'Alto si se bajan thresholds',
  },
  {
    phase: 'VD-6',
    change: 'Reevaluación comparativa de los cuatro perfiles + controles AV/Software',
    expectedResult: 'Baseline post-cambio vs mc1.6 baseline',
    risk: 'Bajo (dry-run primero)',
  },
  {
    phase: 'VD-7',
    change: 'Visualización en ficha solo si backend entrega más specialties',
    expectedResult: 'FE refleja ACTIVE/EMERGENT reales',
    risk: 'Nulo si se valida que gap no era FE',
  },
];

export function auditVisualDesignFourProfiles(params: {
  profiles: McVdProfileSnapshot[];
  mode: McVdFourProfileAuditReport['mode'];
  pack?: McDomainMappingPack;
}): McVdFourProfileAuditReport {
  const pack = params.pack ?? MC_VISUAL_DESIGN_MAPPING_PACK_V120;
  const profiles = [...params.profiles].sort((a, b) =>
    a.document.localeCompare(b.document),
  );
  const persons = profiles.map((p) => diagnoseVisualDesignProfile(p, pack));
  const specialtyCatalog = auditVisualSpecialtyCatalog(persons, pack);
  const comparisonMatrix = buildComparisonMatrix(profiles);
  const repeatedPatterns = detectRepeatedPatterns(persons);
  const globalLayerSummary = globalLayers(persons, repeatedPatterns);

  return {
    auditVersion: MC_VD_FOUR_AUDIT_VERSION,
    packVersion: MC_VISUAL_DESIGN_MAPPING_RULES_VERSION_V120,
    pa2RulesVersion: 'pa2-visual-design-1.1.0',
    catalogVersion: MC_CATALOG_VERSION,
    mode: params.mode,
    writes: 0,
    documents: profiles.map((p) => p.document),
    persons,
    specialtyCatalog,
    sharedTools: SHARED_TOOLS,
    repeatedPatterns,
    comparisonMatrix,
    globalLayerSummary,
    strengtheningPlan: STRENGTHENING_PLAN,
    openQuestions: [
      '¿Cuál es el inventario live de 1000590473?',
      '¿Doris tiene CV activo hoy o sigue NEED_CV?',
      '¿Independencia de evidencia After Effects Visual vs AV verificable?',
      '¿VISUAL_UI debe mapearse o permanecer RESERVED?',
    ],
  };
}

export function defaultTargetDocuments(): string[] {
  return [...MC_VD_FOUR_TARGET_DOCUMENTS];
}

/** Expuesto a tests: el motor no escribe. */
export function vdFourAuditPerformsWrites(): boolean {
  return false;
}
