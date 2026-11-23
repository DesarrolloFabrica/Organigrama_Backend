import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Validación estática de migrations/025_person_video.sql.
 * No conecta a PostgreSQL.
 */
describe('migración 025_person_video', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../migrations/025_person_video.sql'),
    'utf8',
  );

  it('crea organigrama.person_video sin IF NOT EXISTS (fallo visible al re-ejecutar)', () => {
    expect(sql).toContain('CREATE TABLE organigrama.person_video');
    expect(sql).not.toMatch(/CREATE TABLE IF NOT EXISTS organigrama\.person_video/i);
  });

  it('incluye columnas del contrato Fase 2A', () => {
    for (const col of [
      'person_id',
      'document',
      'drive_file_id',
      'drive_file_name',
      'mime_type',
      'drive_modified_time',
      'drive_md5_checksum',
      'drive_file_size',
      'drive_parent_folder_id',
      'drive_relative_path',
      'is_active',
      'created_at',
      'updated_at',
      'synced_at',
    ]) {
      expect(sql).toContain(col);
    }
  });

  it('usa longitudes alineadas a core.person / person_cv', () => {
    expect(sql).toMatch(/document\s+VARCHAR\(80\)/i);
    expect(sql).toMatch(/drive_file_id\s+VARCHAR\(255\)/i);
    expect(sql).toMatch(/drive_file_name\s+VARCHAR\(255\)/i);
    expect(sql).toMatch(/mime_type\s+VARCHAR\(120\)/i);
    expect(sql).toMatch(/drive_md5_checksum\s+VARCHAR\(64\)/i);
    expect(sql).toMatch(/drive_parent_folder_id\s+VARCHAR\(255\)/i);
  });

  it('define FK ON DELETE RESTRICT hacia core.person', () => {
    expect(sql).toContain('CONSTRAINT fk_person_video_person');
    expect(sql).toContain('REFERENCES core.person(id)');
    expect(sql).toContain('ON DELETE RESTRICT');
  });

  it('define unique drive_file_id y unique parcial de activo', () => {
    expect(sql).toContain('CONSTRAINT uq_person_video_drive_file_id');
    expect(sql).toContain('UNIQUE (drive_file_id)');
    expect(sql).toContain('CREATE UNIQUE INDEX uq_person_video_active_person');
    expect(sql).toMatch(
      /ON organigrama\.person_video\s*\(\s*person_id\s*\)\s*WHERE is_active = TRUE/i,
    );
  });

  it('define índices document y (person_id, is_active)', () => {
    expect(sql).toContain('CREATE INDEX ix_person_video_document');
    expect(sql).toContain('CREATE INDEX ix_person_video_person_active');
    expect(sql).toMatch(
      /ix_person_video_person_active\s+ON organigrama\.person_video\s*\(\s*person_id,\s*is_active\s*\)/i,
    );
  });

  it('define CHECKs de no vacío y tamaño no negativo', () => {
    expect(sql).toContain('chk_person_video_document_nonempty');
    expect(sql).toContain('chk_person_video_drive_file_id_nonempty');
    expect(sql).toContain('chk_person_video_drive_file_name_nonempty');
    expect(sql).toContain('chk_person_video_mime_type_nonempty');
    expect(sql).toContain('chk_person_video_drive_file_size_nonneg');
    expect(sql).toContain('length(trim(document)) > 0');
    expect(sql).toContain('drive_file_size IS NULL OR drive_file_size >= 0');
  });

  it('no expone URL pública ni campos fuera de contrato', () => {
    expect(sql).not.toMatch(/drive_web_url/i);
    expect(sql).not.toMatch(/\bticket\b/i);
    expect(sql).not.toMatch(/duration/i);
    expect(sql).not.toMatch(/poster/i);
    expect(sql).not.toMatch(/transcript/i);
    expect(sql).not.toMatch(/BYTEA/i);
  });

  it('es aditiva y segura: sin DROP/TRUNCATE/DELETE/UPDATE ejecutables ni tocar CV/MC1/core.person DDL', () => {
    // Ignorar comentarios de cabecera (rollback documentado) y líneas `-- …`.
    const executable = sql
      .split('\n')
      .filter((line) => !/^\s*--/.test(line))
      .join('\n');
    expect(executable).not.toMatch(/\bDROP\s+(TABLE|INDEX|SCHEMA)\b/i);
    expect(executable).not.toMatch(/\bTRUNCATE\b/i);
    expect(executable).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(executable).not.toMatch(/\bUPDATE\s+\w+/i);
    expect(executable).not.toMatch(/ALTER TABLE\s+core\.person/i);
    expect(executable).not.toMatch(/person_cv/i);
    expect(executable).not.toMatch(
      /mc_profile_|mc_domain|mc_specialty|mc_evaluation/i,
    );
  });

  it('no impone CHECK rígido de MIME', () => {
    expect(sql).not.toMatch(/mime_type\s+IN\s*\(/i);
    expect(sql).not.toMatch(/CHECK\s*\(\s*mime_type/i);
  });
});
