/**
 * Tests puros — reglas de publicación multidominio (ficha).
 */

import {
  deriveDomainQualification,
  filterPublishableDomains,
  selectDefaultDomainCode,
  sortPublishableDomains,
  type McPublishableDomainCandidate,
} from './mc-multidomain-profile-publish';

function cand(
  partial: Partial<McPublishableDomainCandidate> &
    Pick<
      McPublishableDomainCandidate,
      'evaluationId' | 'domainCode' | 'extractionId'
    >,
): McPublishableDomainCandidate {
  return {
    domainName: partial.domainCode,
    domainSortOrder: 100,
    isActive: false,
    status: 'SUCCEEDED',
    domainQualification: null,
    activeCount: 0,
    emergentCount: 0,
    hiddenCount: 0,
    defaultSpecialtyCode: null,
    engineRulesVersion: 'pa2-x',
    completedAt: null,
    ...partial,
  };
}

describe('mc-multidomain-profile-publish', () => {
  it('filtra OUTSIDE e INSUFFICIENT; conserva PRIMARY y SECONDARY', () => {
    const rows = [
      cand({
        evaluationId: '1',
        domainCode: 'SOFTWARE',
        extractionId: '220',
        domainQualification: 'OUTSIDE',
      }),
      cand({
        evaluationId: '2',
        domainCode: 'VISUAL_DESIGN',
        extractionId: '220',
        domainQualification: 'SECONDARY_SIGNAL',
        emergentCount: 2,
        isActive: true,
      }),
      cand({
        evaluationId: '3',
        domainCode: 'AUDIOVISUAL_PRODUCTION',
        extractionId: '220',
        domainQualification: 'INSUFFICIENT_EVIDENCE',
      }),
      cand({
        evaluationId: '4',
        domainCode: 'SOFTWARE',
        extractionId: '99',
        domainQualification: 'PRIMARY_MATCH',
        activeCount: 2,
      }),
    ];
    const pub = filterPublishableDomains(rows, '220');
    expect(pub.map((p) => p.domainCode)).toEqual(['VISUAL_DESIGN']);
  });

  it('persona con dos dominios publicables — orden determinístico', () => {
    const rows = filterPublishableDomains(
      [
        cand({
          evaluationId: '10',
          domainCode: 'SOFTWARE',
          extractionId: '1',
          domainQualification: 'SECONDARY_SIGNAL',
          emergentCount: 1,
          domainSortOrder: 10,
        }),
        cand({
          evaluationId: '11',
          domainCode: 'VISUAL_DESIGN',
          extractionId: '1',
          domainQualification: 'PRIMARY_MATCH',
          activeCount: 1,
          isActive: true,
          domainSortOrder: 20,
        }),
      ],
      '1',
    );
    const sorted = sortPublishableDomains(rows);
    expect(sorted.map((s) => s.domainCode)).toEqual([
      'VISUAL_DESIGN',
      'SOFTWARE',
    ]);
    expect(selectDefaultDomainCode(sorted)).toBe('VISUAL_DESIGN');
  });

  it('un solo dominio → default ese dominio', () => {
    const sorted = sortPublishableDomains(
      filterPublishableDomains(
        [
          cand({
            evaluationId: '19',
            domainCode: 'VISUAL_DESIGN',
            extractionId: '220',
            domainQualification: 'SECONDARY_SIGNAL',
            emergentCount: 2,
            isActive: true,
          }),
        ],
        '220',
      ),
    );
    expect(selectDefaultDomainCode(sorted)).toBe('VISUAL_DESIGN');
  });

  it('deriva qualification desde conteos si es null', () => {
    expect(
      deriveDomainQualification(
        cand({
          evaluationId: '1',
          domainCode: 'X',
          extractionId: '1',
          activeCount: 1,
        }),
      ),
    ).toBe('PRIMARY_MATCH');
    expect(
      deriveDomainQualification(
        cand({
          evaluationId: '2',
          domainCode: 'X',
          extractionId: '1',
          emergentCount: 2,
        }),
      ),
    ).toBe('SECONDARY_SIGNAL');
    expect(
      deriveDomainQualification(
        cand({
          evaluationId: '3',
          domainCode: 'X',
          extractionId: '1',
          hiddenCount: 5,
        }),
      ),
    ).toBe('OUTSIDE');
  });

  it('sin CDR: default = is_active publicable', () => {
    const sorted = sortPublishableDomains(
      filterPublishableDomains(
        [
          cand({
            evaluationId: '1',
            domainCode: 'SOFTWARE',
            extractionId: '5',
            domainQualification: 'PRIMARY_MATCH',
            activeCount: 3,
            isActive: false,
          }),
          cand({
            evaluationId: '2',
            domainCode: 'VISUAL_DESIGN',
            extractionId: '5',
            domainQualification: 'SECONDARY_SIGNAL',
            emergentCount: 1,
            isActive: true,
          }),
        ],
        '5',
      ),
    );
    expect(selectDefaultDomainCode(sorted)).toBe('VISUAL_DESIGN');
  });

  it('extracción histórica no se mezcla con la activa', () => {
    const pub = filterPublishableDomains(
      [
        cand({
          evaluationId: '16',
          domainCode: 'VISUAL_DESIGN',
          extractionId: '96',
          domainQualification: 'PRIMARY_MATCH',
          activeCount: 2,
        }),
      ],
      '219',
    );
    expect(pub).toEqual([]);
  });
});
