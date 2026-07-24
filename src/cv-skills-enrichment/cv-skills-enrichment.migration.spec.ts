/**
 * Tests de migración E3 (estructura esperada del SQL 014).
 * No ejecuta psql; valida el archivo de migración.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('migración 014_cv_skill_enrichment', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../migrations/014_cv_skill_enrichment.sql'),
    'utf8',
  );

  it('crea las tres tablas del dominio enrichment', () => {
    expect(sql).toContain('CREATE TABLE organigrama.cv_skill_enrichment');
    expect(sql).toContain('CREATE TABLE organigrama.cv_skill_enrichment_block');
    expect(sql).toContain('CREATE TABLE organigrama.cv_skill_enrichment_item');
  });

  it('define unique parcial activo e idempotencia SUCCEEDED', () => {
    expect(sql).toContain('uq_cv_skill_enrichment_extraction_active');
    expect(sql).toContain('WHERE is_active = TRUE');
    expect(sql).toContain('uq_cv_skill_enrichment_idempotency');
    expect(sql).toContain("WHERE status = 'SUCCEEDED'");
  });

  it('tiene FKs a extracción/persona/person_cv y cascade en block/item', () => {
    expect(sql).toContain('REFERENCES organigrama.cv_extraction(id)');
    expect(sql).toContain('REFERENCES core.person(id)');
    expect(sql).toContain('REFERENCES organigrama.person_cv(id)');
    expect(sql).toContain('ON DELETE CASCADE');
  });

  it('checks de status y evidence_items array', () => {
    expect(sql).toContain("'PENDING'");
    expect(sql).toContain("'PARTIAL'");
    expect(sql).toContain("jsonb_typeof(evidence_items) = 'array'");
    expect(sql).toContain('is_active = FALSE OR status = \'SUCCEEDED\'');
  });

  it('no toca columnas de inventario legacy', () => {
    expect(sql).not.toMatch(/ALTER TABLE organigrama\.cv_extraction_skill/i);
    expect(sql).not.toMatch(/ALTER TABLE organigrama\.cv_extraction\b/i);
  });
});
