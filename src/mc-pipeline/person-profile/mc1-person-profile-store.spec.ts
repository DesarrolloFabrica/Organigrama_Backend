import {
  validateMc1PresentationPayload,
  MC1_PRESENTATION_STORE_SOURCE,
} from './mc1-person-profile-store';
import {
  importMc1PresentationRecord,
  importMc1PresentationBatch,
} from './mc1-person-profile-importer';
import { readMc1PersonProfile } from './mc1-person-profile.reader';
import type { DataSource, QueryRunner } from 'typeorm';

function validPresentation(overrides?: Record<string, unknown>) {
  return {
    status: 'AVAILABLE',
    source: 'ARTIFACT_ONLY_LOCAL',
    fields: [
      {
        code: 'VISUAL_DESIGN',
        label: 'Diseño Visual',
        role: 'PRIMARY',
        specialties: [
          {
            code: 'GRAPHIC_DESIGN',
            label: 'Diseño Gráfico',
            confidence: 0.9,
            skills: [{ code: 'layout', name: 'Layout' }],
          },
        ],
        tools: ['Illustrator'],
        competencyMap: {
          dimensions: [
            {
              code: 'VD_VISUAL_COMMUNICATION',
              label: 'Comunicación visual',
              relativeCoverage: 100,
            },
          ],
        },
        evidenceVolume: 'HIGH',
      },
    ],
    ...overrides,
  };
}

function mockDataSource(handlers: {
  personExists?: boolean;
  active?: {
    id: string;
    payload_json: unknown;
    config_fingerprint: string;
  } | null;
  onQuery?: (sql: string, params?: unknown[]) => void;
}): DataSource {
  let active = handlers.active ?? null;
  const personExists = handlers.personExists !== false;

  const qr = {
    connect: async () => undefined,
    startTransaction: async () => undefined,
    commitTransaction: async () => undefined,
    rollbackTransaction: async () => undefined,
    release: async () => undefined,
    query: async (sql: string, params?: unknown[]) => {
      handlers.onQuery?.(sql, params);
      const s = sql.replace(/\s+/g, ' ');
      if (/FROM core\.person/i.test(s)) {
        return personExists ? [{ '?column?': 1 }] : [];
      }
      if (/is_active = TRUE/i.test(s) && /SELECT/i.test(s)) {
        if (!active) return [];
        return [
          {
            id: active.id,
            payload_json: active.payload_json,
            config_fingerprint: active.config_fingerprint,
          },
        ];
      }
      if (/SET is_active = FALSE/i.test(s)) {
        active = null;
        return [];
      }
      if (/INSERT INTO organigrama\.mc1_person_profile_presentation/i.test(s)) {
        active = {
          id: '99',
          payload_json: JSON.parse(String(params?.[1])),
          config_fingerprint: String(params?.[2]),
        };
        return [];
      }
      return [];
    },
  } as unknown as QueryRunner;

  return {
    createQueryRunner: () => qr,
    query: async (sql: string, params?: unknown[]) => {
      handlers.onQuery?.(sql, params);
      const s = sql.replace(/\s+/g, ' ');
      if (/mc1_person_profile_presentation/i.test(s) && /SELECT/i.test(s)) {
        if (!active) return [];
        return [
          {
            person_id: String(params?.[0]),
            payload_json: active.payload_json,
            config_fingerprint: active.config_fingerprint,
            produced_at: new Date('2026-08-11T12:00:00.000Z'),
          },
        ];
      }
      return [];
    },
  } as unknown as DataSource;
}

describe('mc1 presentation store + importer (deploy B)', () => {
  it('rejects invalid payload', () => {
    expect(validateMc1PresentationPayload(null).ok).toBe(false);
    expect(validateMc1PresentationPayload({ status: 'AVAILABLE', fields: [] }).ok)
      .toBe(false);
    expect(
      validateMc1PresentationPayload({
        status: 'AVAILABLE',
        fields: [{ code: 'X', role: 'PRIMARY' }],
      }).ok,
    ).toBe(false);
  });

  it('accepts valid presentation and normalizes source', () => {
    const r = validateMc1PresentationPayload(validPresentation());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.presentation.source).toBe(MC1_PRESENTATION_STORE_SOURCE);
      expect(r.presentation.fields).toHaveLength(1);
    }
  });

  it('store hit → AVAILABLE via reader', async () => {
    const payload = validPresentation();
    const ds = mockDataSource({
      active: {
        id: '1',
        payload_json: payload,
        config_fingerprint: 'fp1',
      },
    });
    const r = await readMc1PersonProfile({
      personId: '1163',
      dataSource: ds,
      allowArtifactLocal: false,
    });
    expect(r.status).toBe('AVAILABLE');
    if (r.status === 'AVAILABLE') {
      expect(r.presentation.source).toBe(MC1_PRESENTATION_STORE_SOURCE);
      expect(r.presentation.fields[0].code).toBe('VISUAL_DESIGN');
    }
  });

  it('store miss → NOT_AVAILABLE when artifact local disabled (PA2 fallback path)', async () => {
    const ds = mockDataSource({ active: null });
    const r = await readMc1PersonProfile({
      personId: '1163',
      dataSource: ds,
      allowArtifactLocal: false,
    });
    expect(r.status).toBe('NOT_AVAILABLE');
  });

  it('importer rejects incomplete / missing fingerprint / missing person', async () => {
    const ds = mockDataSource({ personExists: true });
    const bad = await importMc1PresentationRecord(ds, {
      personId: '1163',
      payload: { status: 'AVAILABLE', fields: [] },
      configFingerprint: 'fp',
    });
    expect(bad).toMatchObject({ status: 'REJECTED', reason: 'EMPTY_OR_MISSING_FIELDS' });

    const noFp = await importMc1PresentationRecord(ds, {
      personId: '1163',
      payload: validPresentation(),
      configFingerprint: '',
    });
    expect(noFp).toMatchObject({ status: 'REJECTED', reason: 'FINGERPRINT_MISSING' });

    const dsMissing = mockDataSource({ personExists: false });
    const noPerson = await importMc1PresentationRecord(dsMissing, {
      personId: '1163',
      payload: validPresentation(),
      configFingerprint: 'fp',
    });
    expect(noPerson).toMatchObject({ status: 'REJECTED', reason: 'PERSON_NOT_FOUND' });
  });

  it('importer insert then reimport same payload → idempotent UNCHANGED', async () => {
    const ds = mockDataSource({ personExists: true, active: null });
    const payload = validPresentation();
    const first = await importMc1PresentationRecord(ds, {
      personId: '1163',
      payload,
      configFingerprint: 'fp-a',
      producedAt: '2026-08-11T12:00:00.000Z',
    });
    expect(first.status).toBe('INSERTED');

    const second = await importMc1PresentationRecord(ds, {
      personId: '1163',
      payload,
      configFingerprint: 'fp-a',
      producedAt: '2026-08-11T12:00:00.000Z',
    });
    expect(second.status).toBe('UNCHANGED');
  });

  it('batch import summarizes counts', async () => {
    const ds = mockDataSource({ personExists: true, active: null });
    const result = await importMc1PresentationBatch(ds, [
      {
        personId: '1',
        payload: validPresentation(),
        configFingerprint: 'fp',
      },
      {
        personId: '2',
        payload: { status: 'AVAILABLE', fields: [] },
        configFingerprint: 'fp',
      },
    ]);
    expect(result.inserted).toBe(1);
    expect(result.rejected).toBe(1);
  });
});
