-- Fase 9: hijos por POSICIÓN visual (no por persona) del organigrama.
--
-- org_visual_relation conecta hijos por parent_person_id, lo que falla cuando la
-- misma persona aparece dos veces en una versión con posiciones/roles distintos.
-- Esta tabla permite que cada posición (arista org_visual_relation.id) tenga su
-- propio equipo, sin modificar core.person ni eliminar org_visual_relation.
--
-- Caso real (Dana Valentina Valbuena Nemocón, person_id=1111):
--   version_id=4
--     relation_id=8544  (Andrés Prieto -> Dana, LIDER)        -> equipo LIDER (actual)
--     relation_id=11309 (Raúl Valencia -> Dana, COORDINADORA TEMPORAL) -> equipo del cargo temporal
--   version_id=3
--     relation_id=8467  (Dana temporal)                       -> mismo criterio
--
-- Regla de lectura del backend:
--   1. Si el nodo tiene relation_id y hay hijos activos aquí para
--      (version_id, parent_relation_id = node.relation_id) -> usar esos.
--   2. Si no hay -> comportamiento actual por org_visual_relation.parent_person_id.
--
-- IMPORTANTE: esta migración SOLO crea la estructura. NO carga los hijos de Dana;
-- esos 10 hijos se insertarán manualmente por SQL más adelante.
--
-- Idempotente y reconciliador: si la tabla ya existe con un esquema distinto,
-- agrega lo que falte sin destruir datos.
--
-- Recomendado al ejecutar con psql:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/009_org_visual_relation_position_child.sql

BEGIN;

CREATE TABLE IF NOT EXISTS organigrama.org_visual_relation_position_child (
  id                 BIGSERIAL    PRIMARY KEY,
  version_id         BIGINT       NOT NULL,
  parent_relation_id BIGINT       NOT NULL,
  child_person_id    BIGINT       NOT NULL,
  relation_type      VARCHAR(50)  NOT NULL DEFAULT 'DIRECT_REPORT',
  visual_level       INTEGER      NULL,
  is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMP    WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at         TIMESTAMP    WITHOUT TIME ZONE DEFAULT NOW()
);

-- Reconciliación de columnas para tablas preexistentes.
ALTER TABLE organigrama.org_visual_relation_position_child
  ADD COLUMN IF NOT EXISTS relation_type VARCHAR(50)  NOT NULL DEFAULT 'DIRECT_REPORT',
  ADD COLUMN IF NOT EXISTS visual_level  INTEGER      NULL,
  ADD COLUMN IF NOT EXISTS is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at    TIMESTAMP    WITHOUT TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMP    WITHOUT TIME ZONE DEFAULT NOW();

-- UNIQUE (version_id, parent_relation_id, child_person_id).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_org_visual_relation_position_child'
  ) THEN
    ALTER TABLE organigrama.org_visual_relation_position_child
      ADD CONSTRAINT uq_org_visual_relation_position_child
      UNIQUE (version_id, parent_relation_id, child_person_id);
  END IF;
END $$;

-- FK a la versión del organigrama.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_org_visual_relation_position_child_version'
  ) THEN
    ALTER TABLE organigrama.org_visual_relation_position_child
      ADD CONSTRAINT fk_org_visual_relation_position_child_version
      FOREIGN KEY (version_id)
      REFERENCES organigrama.org_chart_version(id);
  END IF;
END $$;

-- FK a la posición padre (arista visual).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_org_visual_relation_position_child_relation'
  ) THEN
    ALTER TABLE organigrama.org_visual_relation_position_child
      ADD CONSTRAINT fk_org_visual_relation_position_child_relation
      FOREIGN KEY (parent_relation_id)
      REFERENCES organigrama.org_visual_relation(id);
  END IF;
END $$;

-- FK a la persona hija.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_org_visual_relation_position_child_person'
  ) THEN
    ALTER TABLE organigrama.org_visual_relation_position_child
      ADD CONSTRAINT fk_org_visual_relation_position_child_person
      FOREIGN KEY (child_person_id)
      REFERENCES core.person(id);
  END IF;
END $$;

COMMENT ON TABLE organigrama.org_visual_relation_position_child IS
  'Hijos colgados de una POSICIÓN visual (org_visual_relation.id), no de una persona. No modifica core.person.';

COMMENT ON COLUMN organigrama.org_visual_relation_position_child.parent_relation_id IS
  'Posición padre: org_visual_relation.id. Permite equipos distintos para la misma persona según la posición.';

COMMENT ON COLUMN organigrama.org_visual_relation_position_child.child_person_id IS
  'core.person.id del hijo que cuelga de esta posición.';

-- Índices de lectura por (version_id, parent_relation_id).
CREATE INDEX IF NOT EXISTS idx_org_visual_relation_position_child_version
  ON organigrama.org_visual_relation_position_child (version_id);

CREATE INDEX IF NOT EXISTS idx_org_visual_relation_position_child_parent_relation
  ON organigrama.org_visual_relation_position_child (parent_relation_id);

CREATE INDEX IF NOT EXISTS idx_org_visual_relation_position_child_version_parent
  ON organigrama.org_visual_relation_position_child (version_id, parent_relation_id);

CREATE INDEX IF NOT EXISTS idx_org_visual_relation_position_child_child_person
  ON organigrama.org_visual_relation_position_child (child_person_id);

-- NOTA: no se insertan filas. Los hijos de Dana se cargarán manualmente luego.

COMMIT;
