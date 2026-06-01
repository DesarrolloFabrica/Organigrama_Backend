-- Contacto de emergencia en core.person (fuente de verdad Core).
-- Ejecutar en Cloud SQL (misma BD que DB_HOST del backend).

ALTER TABLE core.person
  ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(80) NULL;
