export type CohortMember = {
  person: string;
  personId: number;
  snapshotId: string;
  p1PackRel: string;
  p2PackRel: string;
  p3PackRel: string;
};

/**
 * Packs canónicos ligados al P2 histórico (p1RunId del contrato).
 * No se generan packs nuevos.
 */
export const COHORT: CohortMember[] = [
  {
    person: 'Sara',
    personId: 52,
    snapshotId: '20',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S20-20260813155305-eba75374',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S20-20260813155543-f048aec4',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S20-20260813172432-0af23cd8',
  },
  {
    person: 'Haider',
    personId: 49,
    snapshotId: '21',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-DGFIX-S21-20260813172450-8ce82817',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S21-20260813173222-655bc99c',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S21-20260813173235-4f5e3ed0',
  },
  {
    person: 'Diego',
    personId: 1228,
    snapshotId: '22',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-DGFIX-S22-20260813173300-00d1a4a6',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S22-20260813173529-0f43eaf2',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S22-20260813173554-e1773a4d',
  },
  {
    person: 'Johan',
    personId: 2,
    snapshotId: '12',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S12-20260813155624-bf324001',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S12-20260813155847-36b77be7',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S12-20260813155906-bd12c415',
  },
  {
    person: 'Nidia',
    personId: 1163,
    snapshotId: '1',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S1-20260813155932-06bffb65',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S1-20260813160150-2baecb53',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S1-20260813160211-c5adf067',
  },
  {
    person: 'Camilo',
    personId: 1,
    snapshotId: '8',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S8-20260810150132-32bbea26',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S8-20260810151310-e59a8ed6',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S8-20260810154010-8f86a69b',
  },
  {
    person: 'Juan Pablo',
    personId: 1176,
    snapshotId: '14',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S14-20260810194338-b5fa5399',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S14-20260810194606-d95f480f',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S14-20260810200104-f98a67fe',
  },
  {
    person: 'Santiago',
    personId: 1172,
    snapshotId: '13',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S13-20260810194100-b0efb551',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S13-20260810194321-8fb1b12a',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S13-20260810200028-d3a34ca8',
  },
  {
    person: 'Katherin',
    personId: 1212,
    snapshotId: '16',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S16-20260810203409-25092218',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S16-20260810203635-d2a48764',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S16-20260810205251-8e5a42af',
  },
  {
    person: 'Danna',
    personId: 1213,
    snapshotId: '17',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S17-20260810203640-f8f1e4fd',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S17-20260810203830-28b12115',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S17-20260810205332-f2a28fa4',
  },
];
