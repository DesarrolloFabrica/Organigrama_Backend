import {
  CURATED_PROFILE_SCHEMA_VERSION,
} from './curated-profile.constants';
import { buildSoftwareCuratedProfileFixture } from './curated-profile.fixture';
import { validateCuratedProfileStructure } from './curated-profile.validate-structure';

describe('validateCuratedProfileStructure', () => {
  it('acepta JSON válido del fixture SOFTWARE', () => {
    const result = validateCuratedProfileStructure(
      buildSoftwareCuratedProfileFixture(),
    );
    expect(result.ok).toBe(true);
    expect(result.document?.schemaVersion).toBe(CURATED_PROFILE_SCHEMA_VERSION);
    expect(result.errors).toHaveLength(0);
  });

  it('rechaza schemaVersion inválida', () => {
    const doc = buildSoftwareCuratedProfileFixture();
    const result = validateCuratedProfileStructure({
      ...doc,
      schemaVersion: 'nope',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'SCHEMA_VERSION')).toBe(true);
  });

  it('rechaza confidence fuera de rango', () => {
    const doc = buildSoftwareCuratedProfileFixture();
    doc.domain.confidence = 1.5;
    const result = validateCuratedProfileStructure(doc);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'CONFIDENCE_RANGE')).toBe(true);
  });

  it('rechaza especialidad duplicada', () => {
    const doc = buildSoftwareCuratedProfileFixture();
    doc.specialties.push({ ...doc.specialties[0] });
    const result = validateCuratedProfileStructure(doc);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'SPECIALTY_DUPLICATE')).toBe(
      true,
    );
  });

  it('rechaza skill duplicada en la misma especialidad', () => {
    const doc = buildSoftwareCuratedProfileFixture();
    const skill = { ...doc.specialties[0].skills[0] };
    doc.specialties[0].skills.push(skill);
    const result = validateCuratedProfileStructure(doc);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'SKILL_DUPLICATE')).toBe(true);
  });

  it('rechaza skill sin evidencia', () => {
    const doc = buildSoftwareCuratedProfileFixture();
    doc.specialties[0].skills[0].evidence = [];
    const result = validateCuratedProfileStructure(doc);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'EVIDENCE_REQUIRED')).toBe(
      true,
    );
  });

  it('rechaza evidencia vacía', () => {
    const doc = buildSoftwareCuratedProfileFixture();
    doc.specialties[0].skills[0].evidence = [
      {
        text: '   ',
        evidenceType: 'EXPLICIT',
        sourceSection: 'WORK_EXPERIENCE',
      },
    ];
    const result = validateCuratedProfileStructure(doc);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'EVIDENCE_EMPTY')).toBe(true);
  });

  it('advierte evidencia con heurística de cargo', () => {
    const doc = buildSoftwareCuratedProfileFixture();
    doc.specialties[0].skills[0].evidence = [
      {
        text: 'Ocupó el cargo de arquitecto de software en el área.',
        evidenceType: 'CONTEXTUAL',
        sourceSection: 'WORK_EXPERIENCE',
      },
    ];
    const result = validateCuratedProfileStructure(doc);
    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((w) => w.code === 'EVIDENCE_ROLE_HEURISTIC'),
    ).toBe(true);
  });

  it('rechaza mismatch profile.primaryDomainCode vs domain.code', () => {
    const doc = buildSoftwareCuratedProfileFixture();
    doc.profile.primaryDomainCode = 'VISUAL_DESIGN';
    const result = validateCuratedProfileStructure(doc);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === 'DOMAIN_PROFILE_MISMATCH'),
    ).toBe(true);
  });
});
