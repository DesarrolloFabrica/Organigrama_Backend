-- Amplía logs.login_apps.app_login para Organigrama.
-- CHECK previo: actas | orbit | nova | acervo

ALTER TABLE logs.login_apps
  DROP CONSTRAINT IF EXISTS login_apps_app_login_check;

ALTER TABLE logs.login_apps
  ADD CONSTRAINT login_apps_app_login_check
  CHECK (
    (app_login)::text = ANY (
      (ARRAY[
        'actas'::character varying,
        'orbit'::character varying,
        'nova'::character varying,
        'acervo'::character varying,
        'organigrama'::character varying
      ])::text[]
    )
  );
