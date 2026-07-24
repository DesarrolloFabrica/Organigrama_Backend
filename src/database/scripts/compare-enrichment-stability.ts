/**
 * Script: compara 3 artefactos enricher del documento 1000518830.
 * node dist/... or via ts-node/jest - here used as runnable via nest build path.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { compareEnrichmentArtifacts } from '../../cv-skills-enrichment/cv-skills-enrichment.compare';
import type { EnrichmentArtifact } from '../../cv-skills-enrichment/cv-skills-enrichment.types';

function load(path: string): EnrichmentArtifact {
  return JSON.parse(readFileSync(path, 'utf8')) as EnrichmentArtifact;
}

function main(): void {
  const dir = resolve('tmp/cv-skills-enrichment');
  const files = readdirSync(dir)
    .filter((f) => f.startsWith('1000518830-e1-') && f.endsWith('.json'))
    .filter((f) => !f.includes('stability'))
    .sort();

  if (files.length < 3) {
    throw new Error(
      `Se esperaban >=3 artefactos 1000518830-e1-*.json; hay ${files.length}`,
    );
  }

  // Tomar los 3 más antiguos primero (E1 original + E2-2 + E2-3)
  const selected = files.slice(0, 3);
  const runs = selected.map((f, i) => ({
    label: i === 0 ? 'E1-1' : `E2-${i + 1}`,
    path: resolve(dir, f),
    artifact: load(resolve(dir, f)),
  }));

  const report = {
    artifacts: runs.map((r) => ({ label: r.label, path: r.path })),
    ...compareEnrichmentArtifacts(
      runs.map((r) => ({ label: r.label, artifact: r.artifact })),
    ),
  };

  const out = resolve(dir, '1000518830-e1-stability-report.json');
  writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
  console.log(
    JSON.stringify(
      {
        out,
        artifacts: report.artifacts,
        global: report.global,
        perRun: report.perRun.map((p) => ({
          label: p.label,
          status: p.status,
          model: p.model,
          in: p.metrics.inputSkills,
          out: p.metrics.outputSkills,
          identity: p.metrics.exactIdentityMatches,
          fills: p.metrics.missingFilledEmpty,
          withEv: p.metrics.skillsWithEvidence,
          totalEv: p.metrics.totalEvidenceItems,
          WE: p.metrics.workExperienceCount,
          onlySS: p.metrics.onlySkillsSectionCount,
          calls: p.metrics.geminiCalls,
          retries: p.metrics.blockRetries,
          durationMs: p.durationMs,
        })),
      },
      null,
      2,
    ),
  );
}

if (require.main === module) {
  main();
}
