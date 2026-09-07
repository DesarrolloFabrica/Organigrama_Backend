export type CriticalControl = {
  person: string;
  phase: 'P2' | 'P3';
  code: string;
  expect: 'RESOLVED' | 'NOT_RESOLVED' | 'AMBIGUOUS' | 'ABSTENTION';
  polarity: 'POSITIVE' | 'NEGATIVE' | 'THIN';
};

export const CRITICAL_CONTROLS: CriticalControl[] = [
  {
    person: 'Sara',
    phase: 'P3',
    code: 'DATA_GOVERNANCE',
    expect: 'RESOLVED',
    polarity: 'POSITIVE',
  },
  {
    person: 'Johan',
    phase: 'P3',
    code: 'FRONTEND_ENGINEERING',
    expect: 'RESOLVED',
    polarity: 'POSITIVE',
  },
  {
    person: 'Camilo',
    phase: 'P3',
    code: 'PLATFORM_DEVOPS_ENGINEERING',
    expect: 'RESOLVED',
    polarity: 'POSITIVE',
  },
  {
    person: 'Haider',
    phase: 'P3',
    code: 'DATA_GOVERNANCE',
    expect: 'NOT_RESOLVED',
    polarity: 'NEGATIVE',
  },
  {
    person: 'Diego',
    phase: 'P3',
    code: 'DATA_GOVERNANCE',
    expect: 'AMBIGUOUS',
    polarity: 'THIN',
  },
  {
    person: 'Juan Pablo',
    phase: 'P2',
    code: 'VD_VS_AV',
    expect: 'AMBIGUOUS',
    polarity: 'THIN',
  },
  {
    person: 'Katherin',
    phase: 'P2',
    code: 'DM_VS_COMM',
    expect: 'ABSTENTION',
    polarity: 'THIN',
  },
];

export const REGRESSION_GATE = {
  criticalFalsePositivesMustBe: 0,
  blockingExample: 'Haider DATA_GOVERNANCE → RESOLVED blocks the version',
} as const;
