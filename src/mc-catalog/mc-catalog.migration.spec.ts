import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('migración 018_mc_competency_catalog', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../migrations/018_mc_competency_catalog.sql'),
    'utf8',
  );

  it('crea las tres tablas del catálogo MC1', () => {
    for (const table of [
      'mc_catalog_version',
      'mc_domain',
      'mc_specialty',
    ]) {
      expect(sql).toContain(`CREATE TABLE organigrama.${table}`);
    }
  });

  it('usa lifecycle_status sin EMERGENT en el CHECK', () => {
    expect(sql).toContain('lifecycle_status');
    expect(sql).toContain(
      "CHECK (lifecycle_status IN ('ACTIVE', 'EXPERIMENTAL', 'INACTIVE'))",
    );
    const checkLine = sql
      .split('\n')
      .find((l) => l.includes('CHECK (lifecycle_status'));
    expect(checkLine).toBeDefined();
    expect(checkLine).not.toContain('EMERGENT');
  });

  it('es aditiva: no altera PA1 ni el pipeline previo', () => {
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/ALTER TABLE organigrama\.cv_/i);
  });
});

describe('migración 019_mc_skill_specialty_mapping', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../migrations/019_mc_skill_specialty_mapping.sql'),
    'utf8',
  );

  it('crea clasificación y mapping versionados', () => {
    expect(sql).toContain(
      'CREATE TABLE organigrama.mc_skill_domain_classification',
    );
    expect(sql).toContain(
      'CREATE TABLE organigrama.mc_skill_specialty_mapping',
    );
  });

  it('referencia cv_skill.id como identidad canónica', () => {
    expect(sql).toContain('REFERENCES organigrama.cv_skill(id)');
  });

  it('valida pesos y tipos de mapping', () => {
    expect(sql).toContain('CHECK (weight > 0 AND weight <= 1)');
    expect(sql).toContain(
      "CHECK (mapping_type IN ('PRIMARY', 'SECONDARY'))",
    );
  });

  it('no crea Coverage/Confidence/radar', () => {
    expect(sql).not.toMatch(/coverage/i);
    expect(sql).not.toMatch(/confidence/i);
    expect(sql).not.toMatch(/presentation/i);
    expect(sql).not.toMatch(/radar/i);
  });
});

describe('migración 020_mc_profile_evaluation', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../migrations/020_mc_profile_evaluation.sql'),
    'utf8',
  );

  it('crea evaluación y resultados por especialidad', () => {
    expect(sql).toContain('CREATE TABLE organigrama.mc_profile_evaluation');
    expect(sql).toContain(
      'CREATE TABLE organigrama.mc_profile_specialty_result',
    );
  });

  it('persiste presentation_status ACTIVE|EMERGENT|HIDDEN', () => {
    expect(sql).toContain(
      "CHECK (presentation_status IN ('ACTIVE', 'EMERGENT', 'HIDDEN'))",
    );
  });

  it('garantiza una sola especialidad default por evaluación', () => {
    expect(sql).toContain('uq_mc_profile_spec_default');
  });
});
