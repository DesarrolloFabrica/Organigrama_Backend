import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('migración 017_cv_attribute_engine', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../migrations/017_cv_attribute_engine.sql'),
    'utf8',
  );

  it('crea las ocho tablas del Attribute Engine', () => {
    for (const table of [
      'cv_attribute_catalog_version',
      'cv_macroattribute',
      'cv_subattribute',
      'cv_skill_attribute_mapping',
      'cv_attribute_run',
      'cv_subattribute_result',
      'cv_macroattribute_result',
      'cv_attribute_result_skill',
    ]) {
      expect(sql).toContain(`CREATE TABLE organigrama.${table}`);
    }
  });

  it('permite una sola versión de catálogo activa', () => {
    expect(sql).toContain('uq_cv_attribute_catalog_version_active');
    expect(sql).toContain(
      "CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED'))",
    );
  });

  it('mappings con weight en (0,1], tipo válido y unicidad por versión', () => {
    expect(sql).toContain('CHECK (weight > 0 AND weight <= 1)');
    expect(sql).toContain(
      "CHECK (mapping_type IN ('DIRECT', 'SUPPORTING', 'CONTEXTUAL'))",
    );
    expect(sql).toContain(
      'UNIQUE (catalog_version_id, skill_id, subattribute_id)',
    );
  });

  it('mappings referencian el catálogo cv_skill, no nombres libres', () => {
    expect(sql).toContain('REFERENCES organigrama.cv_skill(id)');
    expect(sql).not.toMatch(/normalized_name\s+VARCHAR.*cv_skill_attribute_mapping/s);
  });

  it('índice parcial de run activo por evaluación e idempotencia', () => {
    expect(sql).toContain('uq_cv_attribute_run_evaluation_active');
    expect(sql).toContain('WHERE is_active = TRUE');
    expect(sql).toContain('uq_cv_attribute_run_idempotency');
    expect(sql).toContain("WHERE status = 'SUCCEEDED'");
    expect(sql).toMatch(/evidence_evaluation_id,\s*\n\s*catalog_version_id,\s*\n\s*mapping_hash,\s*\n\s*algorithm_version,\s*\n\s*config_hash/);
  });

  it('niveles de soporte sin nombres de competencia', () => {
    expect(sql).toContain(
      "'NO_SUPPORT', 'LIMITED', 'DEVELOPING', 'ESTABLISHED', 'WELL_SUPPORTED'",
    );
    expect(sql).not.toMatch(/'EXPERT'|'ADVANCED'/);
  });

  it('rangos de score, confidence y coverage', () => {
    expect(sql).toContain('CHECK (score >= 0 AND score <= 100)');
    expect(sql).toContain('CHECK (confidence >= 0 AND confidence <= 1)');
    expect(sql).toContain('CHECK (coverage >= 0 AND coverage <= 1)');
  });

  it('unicidad de resultados y trazas', () => {
    expect(sql).toContain('UNIQUE (attribute_run_id, subattribute_id)');
    expect(sql).toContain('UNIQUE (attribute_run_id, macroattribute_id)');
    expect(sql).toContain(
      'UNIQUE (subattribute_result_id, extraction_skill_id, mapping_id)',
    );
  });

  it('es aditiva: no altera ni borra capas previas', () => {
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/ALTER TABLE organigrama\.cv_extraction/i);
    expect(sql).not.toMatch(/ALTER TABLE organigrama\.cv_skill_enrichment/i);
    expect(sql).not.toMatch(/ALTER TABLE organigrama\.cv_evidence_evaluation/i);
    expect(sql).not.toMatch(/ALTER TABLE organigrama\.cv_skill\b/i);
  });

  it('mantiene intactas las migraciones 015 y 016', () => {
    const m015 = readFileSync(
      resolve(__dirname, '../../migrations/015_cv_evidence_evaluation.sql'),
      'utf8',
    );
    const m016 = readFileSync(
      resolve(
        __dirname,
        '../../migrations/016_cv_evidence_evaluation_item_er2_metrics.sql',
      ),
      'utf8',
    );
    expect(m015).toContain('CREATE TABLE organigrama.cv_evidence_evaluation');
    expect(m016).toContain('substantive_evidence_count');
    expect(m015).not.toMatch(/cv_attribute/i);
    expect(m016).not.toMatch(/cv_attribute/i);
  });
});
