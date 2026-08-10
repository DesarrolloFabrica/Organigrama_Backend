/**
 * ObservatoryArtifactWriter — escribe artefactos locales Git-safe + checksums.
 */
import { createHash } from 'node:crypto';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { finished } from 'node:stream/promises';
import type {
  CohortSpec,
  DryRunPlan,
  ObservatoryAggregateMetrics,
  ObservatoryReport,
  ObservatoryRunManifest,
  ObservatoryRunMemberResult,
  EvidenceSignature,
} from './observatory.types';

export type ArtifactBundle = {
  cohortSpec: CohortSpec;
  dryRunPlan?: DryRunPlan | null;
  runManifest: ObservatoryRunManifest;
  memberResults: ObservatoryRunMemberResult[];
  signatures: EvidenceSignature[];
  aggregateMetrics: ObservatoryAggregateMetrics;
  reports: ObservatoryReport[];
  executionSummary: Record<string, unknown>;
};

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
}

async function fileSha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(path);
  stream.on('data', (chunk) => hash.update(chunk));
  await finished(stream);
  return hash.digest('hex');
}

export class ObservatoryArtifactWriter {
  constructor(private readonly rootDir: string) {}

  ensureRoot(): string {
    mkdirSync(this.rootDir, { recursive: true });
    mkdirSync(join(this.rootDir, 'reports'), { recursive: true });
    mkdirSync(join(this.rootDir, 'confidential'), { recursive: true });
    return this.rootDir;
  }

  writeDryRunPlan(plan: DryRunPlan): string {
    this.ensureRoot();
    const path = join(this.rootDir, 'dry-run-plan.json');
    writeJson(path, plan);
    writeJson(join(this.rootDir, 'cohort-spec.json'), plan.cohortSpec);
    return path;
  }

  async writeRunBundle(bundle: ArtifactBundle): Promise<{
    artifactRoot: string;
    checksumPath: string;
  }> {
    this.ensureRoot();
    writeJson(join(this.rootDir, 'cohort-spec.json'), bundle.cohortSpec);
    if (bundle.dryRunPlan) {
      writeJson(join(this.rootDir, 'dry-run-plan.json'), bundle.dryRunPlan);
    }
    writeJson(join(this.rootDir, 'run-manifest.json'), bundle.runManifest);
    writeJson(join(this.rootDir, 'member-results.json'), {
      gitSafe: true,
      members: bundle.memberResults,
    });
    writeJson(join(this.rootDir, 'signatures.json'), {
      gitSafe: true,
      signatures: bundle.signatures,
    });
    writeJson(
      join(this.rootDir, 'aggregate-metrics.json'),
      bundle.aggregateMetrics,
    );
    writeJson(
      join(this.rootDir, 'execution-summary.json'),
      bundle.executionSummary,
    );

    for (const r of bundle.reports) {
      writeJson(join(this.rootDir, 'reports', `${r.reportId}.json`), r);
    }

    const checksumPath = join(this.rootDir, 'checksums.sha256');
    const lines: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
          if (name === 'confidential') continue; // checksums omit raw P1 text
          walk(full);
        } else if (name !== 'checksums.sha256') {
          lines.push(full);
        }
      }
    };
    walk(this.rootDir);

    const out: string[] = [];
    for (const full of lines.sort()) {
      const digest = await fileSha256(full);
      out.push(`${digest}  ${relative(this.rootDir, full).replace(/\\/g, '/')}`);
    }
    writeFileSync(checksumPath, out.join('\n') + '\n', 'utf8');

    return { artifactRoot: this.rootDir, checksumPath };
  }

  static resolveRunRoot(backendRoot: string, runId: string): string {
    return resolve(backendRoot, 'tmp', 'mc1-evidence-observatory', runId);
  }

  static resolveDryRunRoot(backendRoot: string): string {
    return resolve(backendRoot, 'tmp', 'mc1-evidence-observatory', '_dry-run');
  }

  static latestDryRunExists(backendRoot: string): boolean {
    return existsSync(
      join(ObservatoryArtifactWriter.resolveDryRunRoot(backendRoot), 'dry-run-plan.json'),
    );
  }
}
