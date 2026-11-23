-- QA — declara esta base como NO productiva.
--
-- El backend solo habilita el login dev (acceso por correo) si la base a la
-- que está conectado tiene organigrama.environment ∈ {qa, development, local},
-- el host es local y el servidor no es Cloud SQL (DevLoginSafetyService).
-- La base de producción NO tiene esta marca. Nunca ejecutar esto en producción.
--
-- Se aplica a las conexiones NUEVAS: reiniciar el backend QA después.

DO $$
BEGIN
  IF current_setting('cloudsql.iam_authentication', true) IS NOT NULL THEN
    RAISE EXCEPTION 'Esta base es Cloud SQL: no se marca como QA.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM core.person
     WHERE coalesce(edu_email, '') NOT LIKE 'qa_sintetico_%@cun.edu.co'
       AND NOT (id = 900199 AND edu_email = 'desarrollofabrica@cun.edu.co')
  ) THEN
    RAISE EXCEPTION 'core.person contiene datos no sintéticos: no se marca como QA.';
  END IF;
  EXECUTE format('ALTER DATABASE %I SET organigrama.environment = %L', current_database(), 'qa');
END $$;

-- Verificación (en una conexión nueva):
--   SELECT current_setting('organigrama.environment', true);   -- qa
