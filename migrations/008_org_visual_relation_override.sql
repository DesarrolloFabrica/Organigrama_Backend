-- Fase 8: overrides visuales por RELACIÓN y versión del organigrama.
--
-- A diferencia de org_chart_person_override (override por persona/versión),
-- este override aplica a una arista concreta de organigrama.org_visual_relation,
-- permitiendo que la misma persona muestre rol/estado distinto según su padre.
-- No modifica core.person ni org_chart_person_override.
--
-- Caso de prueba:
--   version_id = 4
--   relación 11309 (Dana Valbuena bajo Raúl Valencia)
--     -> rol visible: COORDINADOR DE DESARROLLO PROFESIONAL
--     -> assignment_status: TEMPORAL
--   relación 8544 (Dana Valbuena bajo Andrés Prieto)
--     -> sin override: conserva su rol base (LIDER).
--
-- Idempotente y reconciliador: si la tabla ya existe con un esquema distinto
-- (p. ej. creada antes sin UNIQUE/FKs), agrega lo que falte sin destruir datos.

BEGIN;

CREATE TABLE IF NOT EXISTS organigrama.org_visual_relation_override (
  id                 BIGSERIAL    PRIMARY KEY,
  version_id         BIGINT       NOT NULL,
  relation_id        BIGINT       NOT NULL,
  role_id_override   BIGINT       NULL,
  assignment_status  VARCHAR(32)  NULL,
  assignment_label   VARCHAR(150) NULL,
  is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Reconciliación de columnas para tablas preexistentes.
ALTER TABLE organigrama.org_visual_relation_override
  ADD COLUMN IF NOT EXISTS assignment_status VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS assignment_label  VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS is_active         BOOLEAN NOT NULL DEFAULT TRUE;

-- assignment_status debe poder ser NULL (no toda relación tiene estado).
ALTER TABLE organigrama.org_visual_relation_override
  ALTER COLUMN assignment_status DROP NOT NULL;

-- UNIQUE (version_id, relation_id): requerido por el upsert (ON CONFLICT).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_org_visual_relation_override_version_relation'
  ) THEN
    ALTER TABLE organigrama.org_visual_relation_override
      ADD CONSTRAINT uq_org_visual_relation_override_version_relation
      UNIQUE (version_id, relation_id);
  END IF;
END $$;

-- FK a la versión del organigrama.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_org_visual_relation_override_version'
  ) THEN
    ALTER TABLE organigrama.org_visual_relation_override
      ADD CONSTRAINT fk_org_visual_relation_override_version
      FOREIGN KEY (version_id)
      REFERENCES organigrama.org_chart_version(id);
  END IF;
END $$;

-- FK a la relación visual (arista).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_org_visual_relation_override_relation'
  ) THEN
    ALTER TABLE organigrama.org_visual_relation_override
      ADD CONSTRAINT fk_org_visual_relation_override_relation
      FOREIGN KEY (relation_id)
      REFERENCES organigrama.org_visual_relation(id);
  END IF;
END $$;

-- FK al rol override.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_org_visual_relation_override_role'
  ) THEN
    ALTER TABLE organigrama.org_visual_relation_override
      ADD CONSTRAINT fk_org_visual_relation_override_role
      FOREIGN KEY (role_id_override)
      REFERENCES core.role(id);
  END IF;
END $$;

COMMENT ON TABLE organigrama.org_visual_relation_override IS
  'Overrides visuales por relación (arista) y versión del organigrama. No modifica core.person.';

COMMENT ON COLUMN organigrama.org_visual_relation_override.role_id_override IS
  'Cargo efectivo para esta relación. Si es NULL, se usa el rol base de la persona.';

COMMENT ON COLUMN organigrama.org_visual_relation_override.assignment_status IS
  'Estado de asignación visible para esta relación, p. ej. PERMANENT | TEMPORAL.';

COMMENT ON COLUMN organigrama.org_visual_relation_override.assignment_label IS
  'Etiqueta visible de la asignación para esta posición específica.';

CREATE INDEX IF NOT EXISTS idx_org_visual_relation_override_version
  ON organigrama.org_visual_relation_override (version_id);

CREATE INDEX IF NOT EXISTS idx_org_visual_relation_override_relation
  ON organigrama.org_visual_relation_override (relation_id);

-- Seed del caso de prueba (idempotente).
-- role_id_override se resuelve por nombre para no depender de un id fijo;
-- si el rol no existe, queda NULL y se mantiene el rol base, pero la etiqueta
-- visible y el estado de asignación igual se aplican.
INSERT INTO organigrama.org_visual_relation_override (
  version_id,
  relation_id,
  role_id_override,
  assignment_status,
  assignment_label,
  is_active
)
VALUES
  (
    4,
    11309,
    (SELECT id FROM core.role
      WHERE UPPER(name) = 'COORDINADOR DE DESARROLLO PROFESIONAL'
      ORDER BY id
      LIMIT 1),
    'TEMPORAL',
    'COORDINADOR DE DESARROLLO PROFESIONAL',
    TRUE
  )
ON CONFLICT (version_id, relation_id)
DO UPDATE SET
  role_id_override  = EXCLUDED.role_id_override,
  assignment_status = EXCLUDED.assignment_status,
  assignment_label  = EXCLUDED.assignment_label,
  is_active         = EXCLUDED.is_active,
  updated_at        = NOW();

COMMIT;
