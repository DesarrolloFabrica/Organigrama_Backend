-- Quita fotos upload empaquetadas cuyo archivo no está en el despliegue.
-- Esas rutas provocaban <img> rotos (p. ej. Heidy Quiroga) y bloqueaban
-- la sincronización de la foto de Google en el siguiente login.
-- No toca profile_completed_at ni profile_updated_by_user_at.

UPDATE organigrama.person_profile_state
SET
  profile_photo_source = NULL,
  profile_photo_url = NULL,
  updated_at = NOW()
WHERE person_id IN (1141, 1154, 1118, 1129)
  AND profile_photo_source = 'upload'
  AND profile_photo_url LIKE '/public/profile-photos/%';
