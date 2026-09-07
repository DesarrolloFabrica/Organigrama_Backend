import {
  SPECIALTY_CATALOG_DA_VERSION,
  SPECIALTY_CATALOG_VERSION,
  specialtiesForField,
} from '../catalog/specialties-visual-education';
import { buildP3SystemPrompt } from './p3-prompt-v1';
import { normalizeP3ModelOutput } from './p3-normalize';
import { P3_PROMPT_VERSION, P3_REASONING_POLICY_VERSION } from './p3.types';

function govEntry() {
  const hit = specialtiesForField('DATA_ANALYTICS').find(
    (s) => s.code === 'DATA_GOVERNANCE',
  );
  if (!hit) throw new Error('DATA_GOVERNANCE missing');
  return hit;
}

function deEntry() {
  const hit = specialtiesForField('DATA_ANALYTICS').find(
    (s) => s.code === 'DATA_ENGINEERING',
  );
  if (!hit) throw new Error('DATA_ENGINEERING missing');
  return hit;
}

describe('DATA_GOVERNANCE semantic policy (catalog 1.1.0 / P3 1.1.0)', () => {
  it('versions the DA catalog and unified fingerprint without overwriting 1.12.0 silently', () => {
    expect(SPECIALTY_CATALOG_DA_VERSION).toBe('1.1.0');
    expect(SPECIALTY_CATALOG_VERSION).toBe('1.13.0');
    expect(P3_PROMPT_VERSION).toBe('MC1.P3.PROMPT.FUNCTIONAL.1.1.0');
    expect(P3_REASONING_POLICY_VERSION).toBe('12K.1');
  });

  it('positive: technical ACTION + governance/integrity outcome is governance-eligible', () => {
    const g = govEntry();
    expect(g.definition).toMatch(/atribuci[oó]n dual/i);
    expect(g.definition).toMatch(/DATA_ENGINEERING/);
    expect(
      g.positiveSignals.some((s) =>
        /gobierno|integridad|calidad del dato|trazabilidad/i.test(s),
      ),
    ).toBe(true);
    expect(
      g.positiveSignals.some((s) =>
        /ACTION|responsabilidad|resultado|outcome/i.test(s),
      ),
    ).toBe(true);
  });

  it('positive: repository management + data-quality outcome is governance-eligible', () => {
    const g = govEntry();
    expect(
      g.positiveSignals.some((s) =>
        /calidad del dato|gobierno|trazabilidad/i.test(s),
      ),
    ).toBe(true);
    expect(g.definition).toMatch(/repositorio|pipeline|esquema/i);
  });

  it('negative: SQL / ETL / cloud repository / Power BI alone are not governance', () => {
    const g = govEntry();
    const blob = g.exclusions.join(' | ');
    expect(blob).toMatch(/SQL/);
    expect(blob).toMatch(/ETL/);
    expect(blob).toMatch(/pipelines/i);
    expect(blob).toMatch(/cloud|repositorios|arquitectura/i);
    expect(blob).toMatch(/BI|dashboards|reporting/i);
    expect(blob).toMatch(/por s[ií] solos/i);
  });

  it('negative: knowledge declaration alone is not OBSERVED', () => {
    const g = govEntry();
    expect(
      g.exclusions.some((s) =>
        /declaraci[oó]n aislada de conocimiento|nunca originarlo sola/i.test(s),
      ),
    ).toBe(true);
  });

  it('dual attribution: DE exclusion does not consume the governance outcome', () => {
    const de = deEntry();
    expect(
      de.exclusions.some((s) =>
        /DATA_GOVERNANCE|atribuci[oó]n dual|dual attribution/i.test(s),
      ),
    ).toBe(true);
  });

  it('P3 prompt encodes dual attribution and practice+outcome OBSERVED rule', () => {
    const prompt = buildP3SystemPrompt(['DATA_ANALYTICS']);
    expect(prompt).toContain('Dual attribution is allowed');
    expect(prompt).toContain('DATA_GOVERNANCE');
    expect(prompt).toMatch(/MUST NOT be the sole basis for OBSERVED/);
    expect(prompt).toMatch(/SQL, ETL, pipelines/);
    expect(prompt).toMatch(/Do not infer governance from working intensely with data/);
    expect(prompt).toContain(P3_PROMPT_VERSION);
    expect(prompt).toContain('DA 1.1.0');
  });

  it('mapper keeps dual OBSERVED when the same EUs support DE and DATA_GOVERNANCE', () => {
    const shared = ['ceu_practice_a', 'ceu_practice_b'];
    const { envelope } = normalizeP3ModelOutput({
      raw: {
        outcomeStatus: 'SPECIALTIES_OBSERVED',
        fieldResults: [
          {
            fieldCode: 'DATA_ANALYTICS',
            observedSpecialties: [
              {
                specialtyCode: 'DATA_ENGINEERING',
                parentFieldCode: 'DATA_ANALYTICS',
                status: 'OBSERVED',
                confidence: 0.9,
                supportingEvidenceUnitIds: shared,
                rationaleCode: 'COHERENT_PRACTICE_CLUSTER',
              },
              {
                specialtyCode: 'DATA_GOVERNANCE',
                parentFieldCode: 'DATA_ANALYTICS',
                status: 'OBSERVED',
                confidence: 0.85,
                supportingEvidenceUnitIds: shared,
                rationaleCode: 'COHERENT_PRACTICE_CLUSTER',
              },
            ],
          },
        ],
      },
      executionId: 'e',
      configFingerprint: 'c',
      snapshotId: '20',
      fieldsEvaluated: ['DATA_ANALYTICS'],
      r1FieldResolutionStatus: 'RESOLVED',
      unitIds: shared,
      campaignId: 'c',
      pipelineRunId: 'p',
      registryFingerprint: 'r',
      modelWarnings: [],
      r1PackDir: '/tmp/r1',
      p1ArtifactDigest: 'd',
      geminiInvoked: true,
    });
    const specs = envelope.payload.fieldResults[0].observedSpecialties;
    expect(specs.map((s) => `${s.specialtyCode}:${s.status}`).sort()).toEqual([
      'DATA_ENGINEERING:OBSERVED',
      'DATA_GOVERNANCE:OBSERVED',
    ]);
    expect(specs.every((s) => s.supportingEvidenceUnitIds.join() === shared.join())).toBe(
      true,
    );
    expect(
      envelope.warnings.some((w) => w.code === 'OBSERVED_DEMOTED_INSUFFICIENT_SUPPORT'),
    ).toBe(false);
  });
});
