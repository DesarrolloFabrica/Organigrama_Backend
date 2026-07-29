/**
 * Genera artefacto dry-run PA2 Camilo sin BD (fixture snapshot + mappings).
 * node dist/... after build, or invoked from tests.
 */
const { readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');
const {
  getDefaultMcPa2EngineConfig,
  computeMcPa2ConfigHash,
} = require('../../mc-catalog/mc-pa2.config');
const { runMcPa2Engine } = require('../../mc-catalog/mc-pa2.engine');
const {
  MC_SOFTWARE_SPECIALTY_CODES,
} = require('../../mc-catalog/mc-catalog.definition-mc12');

const snap = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../tmp/cv-attributes/mc1-camilo-source-snapshot.json'),
    'utf8',
  ),
);
const art = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      '../../../tmp/cv-attributes/mc1.3.2-camilo-skill-mappings.json',
    ),
    'utf8',
  ),
);

const config = getDefaultMcPa2EngineConfig();
const specialties = MC_SOFTWARE_SPECIALTY_CODES.map((code, i) => ({
  specialtyId: String(i + 1),
  specialtyCode: code,
  specialtyName: code,
  lifecycleStatus: 'ACTIVE',
  sortOrder: i + 1,
}));
const codeToId = Object.fromEntries(
  specialties.map((s) => [s.specialtyCode, s.specialtyId]),
);

const skills = snap.skills.map((s) => ({
  skillId: s.skill_id,
  skillKey: s.normalized_key,
  skillName: s.normalized_name,
  skillType: s.skill_type,
  evidenceLevel: s.evidence_level,
  evidenceStrength: Number(s.evidence_strength),
  evidenceConfidence: Number(s.evidence_confidence),
}));

const mappings: Array<{
  skillId: string;
  specialtyCode: string;
  specialtyId: string;
  weight: number;
  mappingType: 'PRIMARY' | 'SECONDARY';
}> = [];
for (const row of art.skills) {
  if (row.classification !== 'DOMAIN_SPECIALTY') continue;
  const skill = snap.skills.find(
    (s) =>
      s.normalized_key === row.skillKey && s.skill_type === row.skillType,
  );
  mappings.push({
    skillId: skill.skill_id,
    specialtyCode: row.primary,
    specialtyId: codeToId[row.primary],
    weight: row.primaryWeight,
    mappingType: 'PRIMARY',
  });
  if (row.secondary) {
    mappings.push({
      skillId: skill.skill_id,
      specialtyCode: row.secondary,
      specialtyId: codeToId[row.secondary],
      weight: row.secondaryWeight,
      mappingType: 'SECONDARY',
    });
  }
}

const result = runMcPa2Engine({
  domainCode: 'SOFTWARE',
  config,
  specialties,
  mappings,
  skills,
});

const artifact = {
  meta: {
    phase: 'MC1.3.3',
    mode: 'FIXTURE_DRY_RUN',
    generatedAt: new Date().toISOString(),
    personCvId: '187',
    extractionId: '206',
    enrichmentId: '2',
    evaluationId: '3',
    engineRulesVersion: result.engineRulesVersion,
    configHash: result.configHash,
    config: getDefaultMcPa2EngineConfig(),
  },
  summary: {
    defaultSpecialtyCode: result.defaultSpecialtyCode,
    activeCount: result.activeCount,
    emergentCount: result.emergentCount,
    hiddenCount: result.hiddenCount,
    warnings: result.warnings,
  },
  specialties: result.specialtyResults.map((r) => ({
    specialtyCode: r.specialtyCode,
    presentationStatus: r.presentationStatus,
    mappedSkillCount: r.mappedSkillCount,
    evidencedSkillCount: r.evidencedSkillCount,
    coverage: r.coverage,
    confidence: r.confidence,
    strength: r.strength,
    rank: r.rank,
    isDefault: r.isDefault,
    overrideApplied: r.overrideApplied,
    reasons: r.reasons,
    warnings: r.warnings,
  })),
};

const out = resolve(
  __dirname,
  '../../../tmp/cv-attributes/mc1.3.3-camilo-pa2-evaluation.json',
);
writeFileSync(out, JSON.stringify(artifact, null, 2));
console.log('wrote', out);
console.log(JSON.stringify(artifact.summary, null, 2));
console.log(
  artifact.specialties.map((s) => ({
    code: s.specialtyCode,
    status: s.presentationStatus,
    cov: s.coverage,
    str: s.strength,
    def: s.isDefault,
  })),
);
