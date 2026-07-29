/**
 * MC1.6 — tests auditoría Diseño Visual cuatro perfiles (sin I/O, sin writes).
 */

import {
  fixtureDoris103154553,
  fixtureNidia1015482688,
  fixtureSyntheticAliasGap,
  fixtureUnknown1000590473,
  loadFourProfileFixtures,
} from './mc-visual-design-four-profile-audit.fixtures';
import {
  auditVisualDesignFourProfiles,
  classifySharedTool,
  classifySkillAgainstVisualPack,
  diagnoseVisualDesignProfile,
  vdFourAuditPerformsWrites,
} from './mc-visual-design-four-profile-audit';
import { MC_VD_FOUR_TARGET_DOCUMENTS } from './mc-visual-design-four-profile-audit.types';

describe('mc-visual-design-four-profile-audit (MC1.6)', () => {
  it('carga los cuatro documentos objetivo', () => {
    const profiles = loadFourProfileFixtures([...MC_VD_FOUR_TARGET_DOCUMENTS]);
    expect(profiles).toHaveLength(4);
    expect(profiles.map((p) => p.document).sort()).toEqual(
      [...MC_VD_FOUR_TARGET_DOCUMENTS].sort(),
    );
  });

  it('persona no encontrada / unknown fixture', () => {
    const d = diagnoseVisualDesignProfile(fixtureUnknown1000590473());
    expect(d.found).toBe(false);
    expect(d.verdicts).toContain('LIVE_DATA_REQUIRED');
  });

  it('CV faltante (Doris)', () => {
    const d = diagnoseVisualDesignProfile(fixtureDoris103154553());
    expect(d.chain.cv).toBe('MISSING');
    expect(d.verdicts).toContain('CHAIN_INCOMPLETE');
    expect(d.dryRun?.qualification).toBe('NOT_AVAILABLE');
  });

  it('Nidia: dry-run Visual con pack vigente produce calificación', () => {
    const d = diagnoseVisualDesignProfile(fixtureNidia1015482688());
    expect(d.dryRun).not.toBeNull();
    expect(d.dryRun!.qualification).not.toBe('NOT_AVAILABLE');
    expect(d.dryRun!.specialties.length).toBeGreaterThan(0);
    expect(d.dryRun!.mappedSkillKeys).toContain('diseno_grafico');
  });

  it('skill visual mapeada vs no mapeada', () => {
    const mapped = classifySkillAgainstVisualPack({
      skillKey: 'diseno_grafico',
      skillName: 'Diseño Gráfico',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      evidenceLevel: 'MODERATE',
      evidenceStrength: 50,
      evidenceConfidence: 0.5,
      evidenceSnippet: null,
      source: 'EXPLICIT',
      originalName: null,
    });
    expect(mapped.gap).toBe('NONE');
    expect(mapped.recognizedByVisual).toBe(true);

    const unmapped = classifySkillAgainstVisualPack({
      skillKey: 'diseno_de_piezas_publicitarias',
      skillName: 'Diseño de piezas publicitarias',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      evidenceLevel: 'MODERATE',
      evidenceStrength: 50,
      evidenceConfidence: 0.5,
      evidenceSnippet: null,
      source: 'EXPLICIT',
      originalName: null,
    });
    expect(unmapped.gap).toBe('ALIAS_GAP');
  });

  it('alias faltante sintético y herramientas compartidas', () => {
    const d = diagnoseVisualDesignProfile(fixtureSyntheticAliasGap());
    expect(d.unusedVisualEvidence.some((g) => g.gap === 'ALIAS_GAP')).toBe(true);
    expect(classifySharedTool('adobe_premiere_pro')).toBe('AUDIOVISUAL_ONLY');
    expect(classifySharedTool('figma')).toBe('CONTEXT_DEPENDENT');
    expect(classifySharedTool('adobe_illustrator')).toBe('VISUAL_ONLY');
  });

  it('especialidad UI reservada sin forzar Software', () => {
    const report = auditVisualDesignFourProfiles({
      profiles: loadFourProfileFixtures(),
      mode: 'FIXTURE',
    });
    const ui = report.specialtyCatalog.find((s) => s.specialtyCode === 'VISUAL_UI');
    expect(ui?.maturity).toBe('RESERVED');
  });

  it('salida determinística e independiente de orden', () => {
    const a = auditVisualDesignFourProfiles({
      profiles: loadFourProfileFixtures(['103154553', '1015482688', '1000035262', '1000590473']),
      mode: 'FIXTURE',
    });
    const b = auditVisualDesignFourProfiles({
      profiles: loadFourProfileFixtures(['1015482688', '1000035262', '1000590473', '103154553']),
      mode: 'FIXTURE',
    });
    expect(a.persons.map((p) => p.document)).toEqual(b.persons.map((p) => p.document));
    expect(a.persons.map((p) => p.dryRun?.qualification)).toEqual(
      b.persons.map((p) => p.dryRun?.qualification),
    );
  });

  it('no realiza writes y no incluye PII innecesaria en contratos de skill', () => {
    expect(vdFourAuditPerformsWrites()).toBe(false);
    const report = auditVisualDesignFourProfiles({
      profiles: loadFourProfileFixtures(),
      mode: 'FIXTURE',
    });
    expect(report.writes).toBe(0);
    const json = JSON.stringify(report);
    expect(json).not.toMatch(/telefono|phone|born_date|address|emergency/i);
  });

  it('plan de fortalecimiento presente', () => {
    const report = auditVisualDesignFourProfiles({
      profiles: loadFourProfileFixtures(),
      mode: 'FIXTURE',
    });
    expect(report.strengtheningPlan.map((p) => p.phase)).toEqual([
      'VD-1',
      'VD-2',
      'VD-3',
      'VD-4',
      'VD-5',
      'VD-6',
      'VD-7',
    ]);
  });
});
