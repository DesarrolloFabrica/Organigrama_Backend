-- Intervención exportadores — verificación de las cuentas autorizadas (SOLO LECTURA).
-- Úsese antes de conceder (permisos de exportación = 0) y después (= ambos).
-- Lista aprobada (fase 7, 23-nov-2026).

BEGIN READ ONLY;

WITH aprobadas(correo) AS (
  VALUES ('iron_fuentes@cun.edu.co'),
         ('raul_valencia@cun.edu.co'),
         ('sara_murillofo@cun.edu.co'),
         ('cindy_russi@cun.edu.co'),
         ('lorena_gomez@cun.edu.co'),
         ('maria_ballen@cun.edu.co')
)
SELECT a.correo,
       count(p.id)                                   AS personas,       -- 1
       count(p.id) FILTER (WHERE p.is_active)        AS activas,        -- 1
       string_agg(p.id::text, ',')                   AS person_id,
       coalesce((SELECT string_agg(pp.permission_code, ',' ORDER BY pp.permission_code)
                   FROM core.person_permission pp
                  WHERE pp.person_id = min(p.id)
                    AND pp.permission_code LIKE 'ORG_DIRECTORY_EXPORT_%'), '(ninguno)') AS permisos_exportacion
  FROM aprobadas a
  LEFT JOIN core.person p ON lower(trim(p.edu_email)) = a.correo
 GROUP BY a.correo
 ORDER BY a.correo;
-- Antes:   6 filas con personas=1, activas=1, permisos_exportacion=(ninguno)
-- Después: 6 filas con ORG_DIRECTORY_EXPORT_HTML,ORG_DIRECTORY_EXPORT_XLS

-- Nadie fuera de la lista tiene permisos de exportación.
SELECT count(*) AS concesiones_fuera_de_la_lista
  FROM core.person_permission pp
  JOIN core.person p ON p.id = pp.person_id
 WHERE pp.permission_code LIKE 'ORG_DIRECTORY_EXPORT_%'
   AND lower(trim(p.edu_email)) NOT IN (
     'iron_fuentes@cun.edu.co', 'raul_valencia@cun.edu.co', 'sara_murillofo@cun.edu.co',
     'cindy_russi@cun.edu.co', 'lorena_gomez@cun.edu.co', 'maria_ballen@cun.edu.co');   -- 0

SELECT count(*) AS total_concesiones_exportacion
  FROM core.person_permission
 WHERE permission_code LIKE 'ORG_DIRECTORY_EXPORT_%';             -- antes 0, después 12

ROLLBACK;
