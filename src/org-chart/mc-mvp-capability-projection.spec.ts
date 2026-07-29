import { buildMvpProfessionalCapabilities } from './mc-mvp-capability-projection';

describe('mc-mvp-capability-projection', () => {
  it('consolida gestión académica con evidencia fuerte', () => {
    const mvp = buildMvpProfessionalCapabilities([
      {
        normalizedName: 'gestion academica',
        originalName: 'Gestión académica',
        skillType: 'PROFESSIONAL_KNOWLEDGE',
        evidenceLevel: 'STRONG',
        hasWorkExperience: true,
        substantiveCount: 3,
      },
      {
        normalizedName: 'planeacion academica',
        originalName: 'Planeación académica',
        skillType: 'PROFESSIONAL_KNOWLEDGE',
        evidenceLevel: 'STRONG',
        hasWorkExperience: true,
      },
      {
        normalizedName: 'photoshop',
        originalName: 'Photoshop',
        skillType: 'TOOL',
        evidenceLevel: 'WEAK',
      },
    ]);
    expect(
      mvp.consolidatedCapabilities.some((c) => c.code === 'ACADEMIC_MANAGEMENT'),
    ).toBe(true);
    expect(mvp.tools.some((t) => /photoshop/i.test(t.label))).toBe(true);
    expect(mvp.classificationPending).toBe(true);
  });

  it('no publica INFERRED_FROM_ROLE', () => {
    const mvp = buildMvpProfessionalCapabilities(
      [
        {
          normalizedName: 'coordinacion',
          originalName: 'Coordinación',
          skillType: 'SOFT_SKILL',
        },
      ],
      { hasPublishableDomain: false },
    );
    // Sin evidencia profesional clara → no STRONG consolidada forzada
    expect(
      mvp.consolidatedCapabilities.every((c) => c.evidenceLevel === 'STRONG'),
    ).toBe(true);
  });
});
