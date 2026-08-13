/**
 * Leidy Marcela — pipeline completo P0→Profile tras recuperación CV.
 * No reprocesa Jonh/Paula/Jeimy/Yenny.
 *
 *   npx ts-node --transpile-only scripts/mc1-leidy-complete.ts --confirm
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'tmp', 'mc1-leidy-cv-recovery');

function main() {
  if (!process.argv.includes('--confirm')) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'REQUIRES_CONFIRM',
        hint: 'npx ts-node --transpile-only scripts/mc1-leidy-complete.ts --confirm',
      }),
    );
    process.exit(2);
  }

  mkdirSync(OUT, { recursive: true });

  // Seed cohort-report with CS-validated siblings so MC1_B2B_ONLY merge stays accurate
  const cohortDir = resolve(ROOT, 'tmp', 'mc1-b2b-cohort');
  mkdirSync(cohortDir, { recursive: true });
  const csDir = resolve(ROOT, 'tmp', 'mc1-b2b-customer-success-complete');
  const siblings: Array<Record<string, unknown>> = [];

  const seed = [
    {
      personId: '1191',
      personCvId: 197,
      label: 'Jonh Cesar Cuevas Munoz',
      status: 'DONE',
      personDecision: 'VALIDATED_WITH_DRIFT',
      note: 'reused_from_prior_CS_closure; not reprocessed',
    },
    {
      personId: '1195',
      personCvId: 193,
      label: 'Paula Andrea Ortiz Andapina',
      status: 'DONE',
      personDecision: 'VALIDATED',
      note: 'reused_from_CS_complete; not reprocessed',
    },
    {
      personId: '1196',
      personCvId: 194,
      label: 'Naranjo Herrera Jeimy Johana',
      status: 'DONE',
      personDecision: 'VALIDATED',
      note: 'reused_from_CS_complete; not reprocessed',
    },
    {
      personId: '1198',
      personCvId: 196,
      label: 'Paez Castro Yenny Paola',
      status: 'DONE',
      personDecision: 'VALIDATED',
      note: 'reused_from_CS_complete; not reprocessed',
    },
  ];

  for (const s of seed) {
    const csPath = join(csDir, `person-${s.personId}`, 'completion-report.json');
    if (existsSync(csPath)) {
      const cs = JSON.parse(readFileSync(csPath, 'utf8'));
      siblings.push({
        ...s,
        snapshot: cs.snapshotId,
        packs: cs.packs,
        gate: cs.gate,
        p3: cs.p3,
      });
    } else {
      siblings.push(s);
    }
  }

  writeFileSync(
    join(cohortDir, 'cohort-report.json'),
    JSON.stringify({ results: siblings }, null, 2),
  );

  const env = {
    ...process.env,
    MC1_B2B_ONLY: '1197',
  };
  // Clear DB_* so MDE guard wins
  for (const k of Object.keys(env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete env[k];
  }

  const r = spawnSync(
    'npx',
    ['ts-node', '--transpile-only', 'scripts/mc1-b2b-cohort.ts', '--confirm'],
    {
      cwd: ROOT,
      env,
      encoding: 'utf8',
      shell: true,
    },
  );
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);

  const personPath = join(cohortDir, 'person-1197.json');
  const leidy = existsSync(personPath)
    ? JSON.parse(readFileSync(personPath, 'utf8'))
    : { status: 'ERROR', error: 'person-1197.json missing' };

  writeFileSync(join(OUT, 'leidy-pipeline-result.json'), JSON.stringify(leidy, null, 2));

  const ok =
    leidy.status === 'DONE' &&
    (leidy.personDecision === 'VALIDATED' ||
      leidy.personDecision === 'VALIDATED_WITH_DRIFT');

  // Final B2B 5/5
  const allPeople = [
    { personId: '1191', name: 'Jonh', status: 'VALIDATED_WITH_DRIFT', reused: true },
    { personId: '1195', name: 'Paula', status: 'VALIDATED', reused: true },
    { personId: '1196', name: 'Jeimy', status: 'VALIDATED', reused: true },
    {
      personId: '1197',
      name: 'Leidy',
      status: ok ? leidy.personDecision : leidy.status,
      reused: false,
      snapshot: leidy.snapshot ?? null,
      r1: leidy.r1 ?? null,
      error: leidy.error ?? null,
    },
    { personId: '1198', name: 'Yenny', status: 'VALIDATED', reused: true },
  ];

  const decision = ok
    ? 'B2B_COHORT_FULLY_VALIDATED'
    : leidy.status === 'ERROR' &&
        String(leidy.error || '').includes('EMPTY_DOCUMENT')
      ? 'LEIDY_CV_SOURCE_BLOCKED'
      : 'LEIDY_CV_SOURCE_BLOCKED';

  const finalReport = {
    decision,
    coverage: ok ? '5/5' : '4/5',
    recovery: existsSync(join(OUT, 'recovery-report.json'))
      ? JSON.parse(readFileSync(join(OUT, 'recovery-report.json'), 'utf8'))
      : null,
    people: allPeople,
    leidy,
    cloudWritesRecovery: 1,
    deploy: false,
  };
  writeFileSync(join(OUT, 'b2b-final-verdict.json'), JSON.stringify(finalReport, null, 2));
  writeFileSync(
    join(cohortDir, 'b2b-fully-validated-verdict.json'),
    JSON.stringify(finalReport, null, 2),
  );

  console.log(
    JSON.stringify({
      status: 'DONE',
      decision,
      leidyDecision: leidy.personDecision ?? leidy.status,
      snapshot: leidy.snapshot ?? null,
      out: join(OUT, 'b2b-final-verdict.json'),
      exitCode: r.status,
    }),
  );
  process.exit(r.status === 0 && ok ? 0 : 1);
}

main();
