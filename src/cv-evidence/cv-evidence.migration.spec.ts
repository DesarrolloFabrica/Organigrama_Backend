import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('migración 015_cv_evidence_evaluation', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../migrations/015_cv_evidence_evaluation.sql'),
    'utf8',
  );

  it('crea tablas evaluation e item', () => {
    expect(sql).toContain('CREATE TABLE organigrama.cv_evidence_evaluation');
    expect(sql).toContain(
      'CREATE TABLE organigrama.cv_evidence_evaluation_item',
    );
  });

  it('índices parciales activo e idempotencia', () => {
    expect(sql).toContain('uq_cv_evidence_evaluation_enrichment_active');
    expect(sql).toContain('WHERE is_active = TRUE');
    expect(sql).toContain('uq_cv_evidence_evaluation_idempotency');
    expect(sql).toContain("WHERE status = 'SUCCEEDED'");
  });

  it('no altera enrichment ni inventory', () => {
    expect(sql).not.toMatch(/ALTER TABLE organigrama\.cv_skill_enrichment/i);
    expect(sql).not.toMatch(/ALTER TABLE organigrama\.cv_extraction/i);
  });
});

describe('migración 016 er2 metrics', () => {
  const sql = readFileSync(
    resolve(
      __dirname,
      '../../migrations/016_cv_evidence_evaluation_item_er2_metrics.sql',
    ),
    'utf8',
  );

  it('añade columnas aditivas sin drop de tablas', () => {
    expect(sql).toContain('substantive_evidence_count');
    expect(sql).toContain('listing_evidence_count');
    expect(sql).toContain('ambiguous_evidence_count');
    expect(sql).not.toMatch(/DROP TABLE/i);
  });
});
