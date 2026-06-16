-- Fase 5: versionamiento del organigrama por periodo (schema organigrama).
-- Ejecutar contra la misma BD que usa el backend antes de desplegar la versión
-- que incluye OrgChartVersionService.
--
-- Prerequisitos: tabla organigrama.org_visual_relation con datos existentes.
-- No borra relaciones actuales: las asocia a la versión inicial "current".
--
-- Transaccional: toda la migración corre dentro de BEGIN/COMMIT.
-- Si cualquier paso falla, PostgreSQL revierte todos los cambios (ROLLBACK).
-- Recomendado al ejecutar con psql:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/005_org_chart_version.sql
-- No combinar con psql --single-transaction (esta migración ya incluye BEGIN/COMMIT).

BEGIN;

-- ─── Tabla de versiones ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organigrama.org_chart_version (
  id                    BIGSERIAL    PRIMARY KEY,
  code                  VARCHAR(100) NOT NULL,
  name                  VARCHAR(255) NOT NULL,
  description           TEXT         NULL,
  period_label          VARCHAR(255) NULL,
  is_active             BOOLEAN      NOT NULL DEFAULT false,
  is_locked             BOOLEAN      NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by_person_id  BIGINT       NULL REFERENCES core.person(id),
  updated_by_person_id  BIGINT       NULL REFERENCES core.person(id),
  CONSTRAINT uq_org_chart_version_code UNIQUE (code)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_chart_version_single_active
  ON organigrama.org_chart_version (is_active)
  WHERE is_active = true;

COMMENT ON TABLE organigrama.org_chart_version IS
  'Versiones del organigrama visual por periodo. Solo una versión activa a la vez.';

-- ─── Versión inicial ──────────────────────────────────────────────────────────

INSERT INTO organigrama.org_chart_version (
  code,
  name,
  description,
  period_label,
  is_active,
  is_locked,
  created_by_person_id
)
VALUES (
  'current',
  'Organigrama vigente',
  'Versión inicial creada a partir del organigrama existente',
  'Actual',
  true,
  false,
  1229
)
ON CONFLICT (code) DO NOTHING;

-- ─── Columna version_id en relaciones visuales ───────────────────────────────

ALTER TABLE organigrama.org_visual_relation
  ADD COLUMN IF NOT EXISTS version_id BIGINT NULL;

UPDATE organigrama.org_visual_relation r
SET version_id = v.id
FROM organigrama.org_chart_version v
WHERE v.code = 'current'
  AND r.version_id IS NULL;

ALTER TABLE organigrama.org_visual_relation
  ALTER COLUMN version_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_org_visual_relation_version'
  ) THEN
    ALTER TABLE organigrama.org_visual_relation
      ADD CONSTRAINT fk_org_visual_relation_version
      FOREIGN KEY (version_id)
      REFERENCES organigrama.org_chart_version(id);
  END IF;
END $$;

-- Reemplazar unique global padre-hijo por unique por versión
ALTER TABLE organigrama.org_visual_relation
  DROP CONSTRAINT IF EXISTS org_visual_relation_parent_person_id_child_person_id_key;

ALTER TABLE organigrama.org_visual_relation
  DROP CONSTRAINT IF EXISTS "UQ_parent_child";

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'organigrama'
      AND t.relname = 'org_visual_relation'
      AND c.contype = 'u'
      AND array_length(c.conkey, 1) = 2
      AND NOT EXISTS (
        SELECT 1
        FROM pg_attribute a
        WHERE a.attrelid = t.oid
          AND a.attnum = ANY(c.conkey)
          AND a.attname = 'version_id'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE organigrama.org_visual_relation DROP CONSTRAINT IF EXISTS %I',
      constraint_name
    );
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_org_visual_relation_version_parent_child'
  ) THEN
    ALTER TABLE organigrama.org_visual_relation
      ADD CONSTRAINT uq_org_visual_relation_version_parent_child
      UNIQUE (version_id, parent_person_id, child_person_id);
  END IF;
END $$;

-- ─── Índices ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_org_visual_relation_version_id
  ON organigrama.org_visual_relation (version_id);

CREATE INDEX IF NOT EXISTS idx_org_visual_relation_parent_person_id
  ON organigrama.org_visual_relation (parent_person_id);

CREATE INDEX IF NOT EXISTS idx_org_visual_relation_child_person_id
  ON organigrama.org_visual_relation (child_person_id);

CREATE INDEX IF NOT EXISTS idx_org_visual_relation_version_parent
  ON organigrama.org_visual_relation (version_id, parent_person_id);

CREATE INDEX IF NOT EXISTS idx_org_visual_relation_version_child
  ON organigrama.org_visual_relation (version_id, child_person_id);

COMMIT;
