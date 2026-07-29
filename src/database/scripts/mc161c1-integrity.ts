/**
 * MC1.6.1C.1 — integridad RO post-pipeline (sin writes).
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';

const DOCS = [
  { label: 'Garzón', document: '1030646495' },
  { label: 'Correa', document: '1002460888' },
  { label: 'Angulo', document: '1193092980' },
  { label: 'Nidia', document: '1015482688' },
  { label: 'Juan Pablo', document: '1022445625' },
  { label: 'Camilo', document: '1000019945' },
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);
  const out: Array<Record<string, unknown>> = [];

  for (const t of DOCS) {
    const persons = await ds.query(
      `SELECT id::text, full_name FROM core.person WHERE document = $1`,
      [t.document],
    );
    if (persons.length !== 1) {
      out.push({
        label: t.label,
        document: t.document,
        error: 'PERSON_LOOKUP',
        count: persons.length,
      });
      continue;
    }
    const p = persons[0];
    const ext = await ds.query(
      `SELECT id::text, status, is_active, pdf_sha256, prompt_version, extractor_version
         FROM organigrama.cv_extraction WHERE person_id = $1 ORDER BY id DESC`,
      [p.id],
    );
    const enr = await ds.query(
      `SELECT id::text, extraction_id::text, status, is_active, pdf_sha256
         FROM organigrama.cv_skill_enrichment WHERE person_id = $1 ORDER BY id DESC`,
      [p.id],
    );
    const ev = await ds.query(
      `SELECT id::text, enrichment_id::text, extraction_id::text, status, is_active
         FROM organigrama.cv_evidence_evaluation WHERE person_id = $1 ORDER BY id DESC`,
      [p.id],
    );
    const pa2 = await ds.query(
      `SELECT id::text, domain_code, is_active, status, mapping_pack_version, source_hash,
              default_specialty_code
         FROM organigrama.mc_profile_evaluation WHERE person_id = $1 ORDER BY id`,
      [p.id],
    );
    const activeExt = ext.find(
      (e: { is_active: boolean; status: string }) =>
        e.is_active && e.status === 'SUCCEEDED',
    );
    const activeEnr = enr.find(
      (e: { is_active: boolean; status: string }) =>
        e.is_active && e.status === 'SUCCEEDED',
    );
    const activeEv = ev.find(
      (e: { is_active: boolean; status: string }) =>
        e.is_active && e.status === 'SUCCEEDED',
    );
    const running = [...ext, ...enr, ...ev].filter(
      (x: { status: string }) =>
        x.status === 'RUNNING' || x.status === 'PENDING',
    );
    const activeExtCount = ext.filter(
      (e: { is_active: boolean; status: string }) =>
        e.is_active && e.status === 'SUCCEEDED',
    ).length;
    const activeEnrCount = enr.filter(
      (e: { is_active: boolean; status: string }) =>
        e.is_active && e.status === 'SUCCEEDED',
    ).length;
    const activeEvCount = ev.filter(
      (e: { is_active: boolean; status: string }) =>
        e.is_active && e.status === 'SUCCEEDED',
    ).length;

    out.push({
      label: t.label,
      document: t.document,
      person_id: p.id,
      name: p.full_name,
      activeExt,
      activeEnr,
      activeEv,
      activeExtCount,
      activeEnrCount,
      activeEvCount,
      hashAlign:
        activeExt && activeEnr
          ? activeExt.pdf_sha256 === activeEnr.pdf_sha256
          : null,
      chainOk: Boolean(
        activeExt &&
          activeEnr &&
          activeEv &&
          String(activeEnr.extraction_id) === String(activeExt.id) &&
          String(activeEv.enrichment_id) === String(activeEnr.id) &&
          String(activeEv.extraction_id) === String(activeExt.id),
      ),
      running: running.length,
      histExt: ext.length,
      histEnr: enr.length,
      histEv: ev.length,
      pa2,
    });
  }

  mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
  const path = resolve(process.cwd(), 'tmp/mc161c1-integrity.json');
  writeFileSync(path, JSON.stringify({ generatedAt: new Date().toISOString(), out }, null, 2));
  console.log(
    JSON.stringify(
      {
        wrote: path,
        summary: out.map((o: any) => ({
          label: o.label,
          chain: o.chainOk,
          hash: o.hashAlign,
          running: o.running,
          activeCounts: [o.activeExtCount, o.activeEnrCount, o.activeEvCount],
          ext: o.activeExt?.id,
          enr: o.activeEnr?.id,
          ev: o.activeEv?.id,
          prompt: o.activeExt?.prompt_version,
          pa2: (o.pa2 ?? []).map(
            (p: any) =>
              `${p.domain_code}#${p.id}:${p.is_active ? 'A' : 'H'}:${p.default_specialty_code ?? '-'}`,
          ),
        })),
      },
      null,
      2,
    ),
  );
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
