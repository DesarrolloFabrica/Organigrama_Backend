-- Fase 1: estado de onboarding por persona (overlay Organigrama OP).
-- Ejecutar contra la misma BD que usa el backend (schema organigrama).

CREATE TABLE IF NOT EXISTS organigrama.person_profile_state (
  person_id BIGINT PRIMARY KEY REFERENCES core.person(id),
  profile_completed_at TIMESTAMPTZ NULL,
  profile_updated_by_user_at TIMESTAMPTZ NULL,
  profile_photo_source VARCHAR(32) NULL,
  profile_photo_url VARCHAR(500) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_person_profile_state_incomplete
  ON organigrama.person_profile_state (profile_completed_at)
  WHERE profile_completed_at IS NULL;

COMMENT ON TABLE organigrama.person_profile_state IS
  'Control de onboarding y foto (metadatos) para Organigrama OP; no reemplaza core.person';
