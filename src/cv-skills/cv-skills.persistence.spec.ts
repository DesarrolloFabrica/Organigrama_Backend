import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getMetadataArgsStorage } from 'typeorm';
import {
  CV_EXTRACTION_STATUSES,
  CV_SKILLS_EXTRACTOR_VERSION,
  CV_SKILLS_PROMPT_VERSION,
} from './cv-skills.constants';
import { CV_SKILLS_ENTITIES } from './cv-skills.module';
import {
  CvExtraction,
  CvExtractionCertification,
  CvExtractionLanguage,
  CvExtractionSkill,
  CvSkill,
  CvSkillAlias,
} from './entities';

describe('cv-skills persistence structure (Fase D)', () => {
  it('define versiones de prompt y extractor (no solo model)', () => {
    expect(CV_SKILLS_PROMPT_VERSION).toMatch(/\S+/);
    expect(CV_SKILLS_EXTRACTOR_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(CV_EXTRACTION_STATUSES).toEqual([
      'PENDING',
      'RUNNING',
      'SUCCEEDED',
      'FAILED',
    ]);
  });

  it('registra las 6 entidades en schema organigrama', () => {
    expect(CV_SKILLS_ENTITIES).toHaveLength(6);

    const tables = getMetadataArgsStorage().tables.filter((t) =>
      CV_SKILLS_ENTITIES.includes(t.target as (typeof CV_SKILLS_ENTITIES)[number]),
    );

    const byName = Object.fromEntries(
      tables.map((t) => [t.name, t.schema]),
    );

    expect(byName).toMatchObject({
      cv_skill: 'organigrama',
      cv_skill_alias: 'organigrama',
      cv_extraction: 'organigrama',
      cv_extraction_skill: 'organigrama',
      cv_extraction_language: 'organigrama',
      cv_extraction_certification: 'organigrama',
    });
  });

  it('mapea columnas clave de cv_extraction (idempotencia + FK person_cv)', () => {
    const cols = getMetadataArgsStorage().columns.filter(
      (c) => c.target === CvExtraction,
    );
    const names = cols.map((c) => c.propertyName);

    expect(names).toEqual(
      expect.arrayContaining([
        'person_id',
        'person_cv_id',
        'pdf_sha256',
        'pdf_byte_size',
        'model',
        'prompt_version',
        'extractor_version',
        'status',
        'is_active',
        'started_at',
        'finished_at',
        'warnings',
        'raw_result',
      ]),
    );
  });

  it('mapea columnas de catálogo e ítems', () => {
    const skillCols = getMetadataArgsStorage()
      .columns.filter((c) => c.target === CvSkill)
      .map((c) => c.propertyName);
    expect(skillCols).toEqual(
      expect.arrayContaining([
        'normalized_name',
        'normalized_key',
        'skill_type',
        'is_active',
      ]),
    );

    const aliasCols = getMetadataArgsStorage()
      .columns.filter((c) => c.target === CvSkillAlias)
      .map((c) => c.propertyName);
    expect(aliasCols).toEqual(
      expect.arrayContaining(['skill_id', 'alias_name', 'alias_key']),
    );

    const itemCols = getMetadataArgsStorage()
      .columns.filter((c) => c.target === CvExtractionSkill)
      .map((c) => c.propertyName);
    expect(itemCols).toEqual(
      expect.arrayContaining([
        'extraction_id',
        'skill_id',
        'original_name',
        'category',
        'confidence',
        'evidence',
        'evidence_items',
        'is_explicit',
      ]),
    );

    expect(
      getMetadataArgsStorage().columns.some(
        (c) => c.target === CvExtractionLanguage && c.propertyName === 'name_key',
      ),
    ).toBe(true);
    expect(
      getMetadataArgsStorage().columns.some(
        (c) =>
          c.target === CvExtractionCertification && c.propertyName === 'issuer',
      ),
    ).toBe(true);
  });

  it('migración 011 es estricta (una sola ejecución) y declara restricciones finales', () => {
    const sqlPath = resolve(
      __dirname,
      '../../migrations/011_cv_skills_persistence.sql',
    );
    const sql = readFileSync(sqlPath, 'utf8');

    expect(sql).not.toMatch(/CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS/i);
    expect(sql).not.toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i);
    expect(sql).toContain('CREATE TABLE organigrama.cv_skill');
    expect(sql).toContain('CREATE INDEX idx_cv_skill_type');
    expect(sql).toContain('UNIQUE (normalized_key, skill_type)');
    expect(sql).toContain('UNIQUE (alias_key)');
    expect(sql).toMatch(
      /person_cv_id\s+BIGINT\s+NOT NULL/,
    );
    expect(sql).toMatch(
      /drive_file_name\s+VARCHAR\(255\)\s+NOT NULL/,
    );
    expect(sql).toMatch(
      /fk_cv_extraction_person_cv[\s\S]*?REFERENCES organigrama\.person_cv\(id\)\s+ON DELETE RESTRICT/,
    );
    expect(sql).toContain('uq_cv_extraction_person_active');
    expect(sql).toContain('uq_cv_extraction_idempotency');
    expect(sql).toContain('extractor_version');
    expect(sql).toContain('prompt_version');
    expect(sql).toContain('chk_cv_extraction_skill_confidence');
    expect(sql).toContain('chk_cv_extraction_skill_explicit');
    expect(sql).toContain('CHECK (is_explicit = TRUE)');
    expect(sql).toContain('chk_cv_extraction_pdf_byte_size');
    expect(sql).toContain('chk_cv_extraction_active_succeeded');
    expect(sql).toContain('chk_cv_extraction_skills_count');
    expect(sql).toContain('chk_cv_extraction_warnings_array');
    expect(sql).toContain('chk_cv_extraction_time_order');
    expect(sql).toContain('chk_cv_extraction_skill_sort_order');
    expect(sql).toContain('chk_cv_extraction_language_sort_order');
    expect(sql).toContain('chk_cv_extraction_certification_sort_order');
    expect(sql).toContain('UNIQUE (extraction_id, skill_id)');
    expect(sql).not.toContain('UNIQUE (extraction_id, skill_id, category)');
    expect(sql).toContain('pdf_byte_size       BIGINT');
    expect(sql).toContain('idx_cv_extraction_person');
    expect(sql).toMatch(
      /fk_cv_extraction_person[\s\S]*?REFERENCES core\.person\(id\)\s+ON DELETE RESTRICT/,
    );
    expect(sql).toContain('chk_cv_extraction_finished_at');
    expect(sql).toContain(
      "(status IN ('PENDING', 'RUNNING') AND finished_at IS NULL)",
    );
    expect(sql).toContain(
      "(status IN ('SUCCEEDED', 'FAILED') AND finished_at IS NOT NULL)",
    );
  });

  it('entidad CvExtraction marca person_cv_id y drive_file_name como NOT NULL', () => {
    const cols = getMetadataArgsStorage().columns.filter(
      (c) => c.target === CvExtraction,
    );
    const personCv = cols.find((c) => c.propertyName === 'person_cv_id');
    const fileName = cols.find((c) => c.propertyName === 'drive_file_name');

    expect(personCv).toBeDefined();
    expect(personCv?.options?.nullable).not.toBe(true);
    expect(fileName).toBeDefined();
    expect(fileName?.options?.nullable).not.toBe(true);
  });
});
