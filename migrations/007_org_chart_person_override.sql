-- Fase 7: overrides de persona por versión del organigrama.
--
-- Permite cambiar atributos visuales del organigrama para una versión
-- específica sin modificar core.person.
--
-- Caso inicial:
--   borrador-nueva-plantilla (id=4)
--   personas 1171, 1189, 1163
--   role_id_override = 44 (DISEÑADOR UX/UI)

BEGIN;

CREATE TABLE IF NOT EXISTS organigrama.org_chart_person_override (
  id                    BIGSERIAL   PRIMARY KEY,
  version_id            BIGINT      NOT NULL,
  person_id             BIGINT      NOT NULL,
  role_id_override      BIGINT      NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_person_id  BIGINT      NULL,

  CONSTRAINT uq_org_chart_person_override_version_person
    UNIQUE (version_id, person_id),

  CONSTRAINT fk_org_chart_person_override_version
    FOREIGN KEY (version_id)
    REFERENCES organigrama.org_chart_version(id),

  CONSTRAINT fk_org_chart_person_override_person
    FOREIGN KEY (person_id)
    REFERENCES core.person(id),

  CONSTRAINT fk_org_chart_person_override_role
    FOREIGN KEY (role_id_override)
    REFERENCES core.role(id),

  CONSTRAINT fk_org_chart_person_override_created_by
    FOREIGN KEY (created_by_person_id)
    REFERENCES core.person(id)
);

COMMENT ON TABLE organigrama.org_chart_person_override IS
  'Overrides visuales por persona y versión del organigrama. No modifica core.person.';

COMMENT ON COLUMN organigrama.org_chart_person_override.role_id_override IS
  'Cargo efectivo para esta persona en esta versión. Si es NULL, se usa core.person.role_id.';

CREATE INDEX IF NOT EXISTS idx_org_chart_person_override_version
  ON organigrama.org_chart_person_override (version_id);

CREATE INDEX IF NOT EXISTS idx_org_chart_person_override_person
  ON organigrama.org_chart_person_override (person_id);

INSERT INTO organigrama.org_chart_person_override (
  version_id,
  person_id,
  role_id_override,
  created_by_person_id
)
VALUES
  (4, 1171, 44, 1229),
  (4, 1189, 44, 1229),
  (4, 1163, 44, 1229)
ON CONFLICT (version_id, person_id)
DO UPDATE SET
  role_id_override = EXCLUDED.role_id_override,
  updated_at = NOW();

COMMIT;
