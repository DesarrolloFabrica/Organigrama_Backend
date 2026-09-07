import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { COHORT, type CohortMember } from '../experimental/deterministic-resolver/cohort';

export type GateMember = CohortMember & {
  gateRole: 'PRIMARY' | 'EXPANSION';
  domainHint: string;
};

const EXPANSION_RAW: Array<Omit<GateMember, 'gateRole'>> = [
  {
    person: 'S2',
    personId: 9002,
    snapshotId: '2',
    domainHint: 'VISUAL_DESIGN',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-S2-20260806133814-e99b7e49',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S2-20260806200936-7e6b8c1f',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S2-20260806205414-eff266b8',
  },
  {
    person: 'S5',
    personId: 9005,
    snapshotId: '5',
    domainHint: 'EDUCATION',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S5-20260806165826-9e5033d7',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S5-20260810135501-b4fd4981',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S5-20260810140711-cf5d9819',
  },
  {
    person: 'S6',
    personId: 9006,
    snapshotId: '6',
    domainHint: 'PROJECT_PROGRAM_MGMT',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S6-20260806170021-a10593e8',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S6-20260810135621-f09225bb',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S6-20260810140542-b1f0a74d',
  },
  {
    person: 'S7',
    personId: 9007,
    snapshotId: '7',
    domainHint: 'EDUCATION/FINANCE_ADMIN',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S7-20260806170218-8ffa2f38',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S7-20260810135653-dabebe34',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S7-20260810141403-d36ff43b',
  },
  {
    person: 'S9',
    personId: 9009,
    snapshotId: '9',
    domainHint: 'SOFTWARE_ENGINEERING',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S9-20260810154742-ac98bc54',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S9-20260810154931-a3207a6a',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S9-20260810154946-025c79d0',
  },
  {
    person: 'S10',
    personId: 9010,
    snapshotId: '10',
    domainHint: 'SOFTWARE_ENGINEERING',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S10-20260810155027-dd51a347',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S10-20260810155244-62117680',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S10-20260810155256-9721a67a',
  },
  {
    person: 'S11',
    personId: 9011,
    snapshotId: '11',
    domainHint: 'SOFTWARE_ENGINEERING',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S11-20260810155315-c1fba04a',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S11-20260810155653-73fea9ef',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S11-20260810155709-5ef220fd',
  },
  {
    person: 'S15',
    personId: 9015,
    snapshotId: '15',
    domainHint: 'AUDIOVISUAL_PRODUCTION',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S15-20260810194608-0427ccd6',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S15-20260810194833-1a092cc8',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S15-20260810200135-a0c4b53d',
  },
  {
    person: 'S18',
    personId: 9018,
    snapshotId: '18',
    domainHint: 'COMMUNICATIONS',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S18-20260810203831-0eb4a36f',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S18-20260810204117-0b03021f',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S18-20260810205410-08a2541b',
  },
  {
    person: 'S19',
    personId: 9019,
    snapshotId: '19',
    domainHint: 'COMMUNICATIONS',
    p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S19-20260813145941-88b1e517',
    p2PackRel: 'tmp/mc1-p2-functional/P2F-8A2-S19-20260813145904-8887edec',
    p3PackRel: 'tmp/mc1-p3-functional/P3F-8B2-S19-20260813150003-c7b050bc',
  },
];

const PRIMARY_DOMAIN: Record<string, string> = {
  Sara: 'DATA_ANALYTICS',
  Haider: 'DATA_ANALYTICS',
  Diego: 'DATA_ANALYTICS',
  Johan: 'SOFTWARE_ENGINEERING',
  Nidia: 'DATA_ANALYTICS',
  Camilo: 'SOFTWARE_ENGINEERING',
  'Juan Pablo': 'VISUAL_DESIGN/AUDIOVISUAL',
  Santiago: 'AUDIOVISUAL_PRODUCTION',
  Katherin: 'DIGITAL_MARKETING/COMMUNICATIONS',
  Danna: 'DIGITAL_MARKETING',
};

export function primaryGateCohort(): GateMember[] {
  return COHORT.map((m) => ({
    ...m,
    gateRole: 'PRIMARY' as const,
    domainHint: PRIMARY_DOMAIN[m.person] ?? 'UNKNOWN',
  }));
}

export function expansionGateCohort(backendRoot: string): GateMember[] {
  return EXPANSION_RAW.filter((m) => {
    const p1 = resolve(backendRoot, m.p1PackRel);
    const p2 = resolve(backendRoot, m.p2PackRel);
    const p3 = resolve(backendRoot, m.p3PackRel);
    return existsSync(p1) && existsSync(p2) && existsSync(p3);
  }).map((m) => ({ ...m, gateRole: 'EXPANSION' as const }));
}

export function fullGateCohort(backendRoot: string): GateMember[] {
  return [...primaryGateCohort(), ...expansionGateCohort(backendRoot)];
}
