# Checklist de despliegue a producción (Organigrama Backend)

## 1. Variable obligatoria: legacy desactivado

En Cloud Run (o el runtime productivo), definir:

```env
ORG_CHART_LEGACY_ENABLED=false
```

| Valor | Efecto |
|-------|--------|
| `false` | `GET /api/org-chart` y `GET /api/org-chart/team/:id` → **410 Gone** |
| ausente / vacío / `true` | Legacy **habilitado** (solo aceptable en desarrollo local) |

Copiar el resto de variables desde `.env.example`. No commitear `.env` con secretos.

## 2. Verificar endpoints legacy bloqueados

Tras el deploy, con un JWT de colaborador válido:

```powershell
$API = "https://TU-SERVICIO.run.app"
$TOKEN = "<access_token>"
$H = @{ Authorization = "Bearer $TOKEN" }

# Debe ser 410, no 200
(Invoke-WebRequest -Uri "$API/api/org-chart" -Headers $H -SkipHttpErrorCheck).StatusCode
(Invoke-WebRequest -Uri "$API/api/org-chart/team/1144" -Headers $H -SkipHttpErrorCheck).StatusCode
```

Sin token, ambas rutas deben responder **401** (sigue siendo API autenticada, no pública).

Endpoints que **sí** deben responder 200 (con auth):

- `GET /api/org-chart/root`
- `GET /api/org-chart/node/:id`
- `GET /api/org-chart/children/:id`

## 3. Confirmar variable en Cloud Run

```bash
gcloud run services describe NOMBRE_SERVICIO \
  --project=ID_PROYECTO \
  --region=REGION \
  --format="value(spec.template.spec.containers[0].env)"
```

Buscar `ORG_CHART_LEGACY_ENABLED=false`.

Si el servicio usa **Variables y secretos** en la consola de Google Cloud:

1. Cloud Run → seleccionar el servicio del backend Organigrama.
2. Editar y desplegar nueva revisión → pestaña **Variables y secretos**.
3. Confirmar `ORG_CHART_LEGACY_ENABLED` = `false` en la revisión **activa** (tráfico 100 %).

Actualizar sin consola:

```bash
gcloud run services update NOMBRE_SERVICIO \
  --region=REGION \
  --update-env-vars=ORG_CHART_LEGACY_ENABLED=false
```

## 4. Token OAuth Drive (streaming de video / CV readonly)

En Cloud Run el JSON OAuth **no** va en la imagen ni como variable con el contenido completo. Se monta desde Secret Manager:

| Ítem | Valor |
|------|--------|
| Secreto Secret Manager | `organigrama-google-drive-oauth-token` |
| Montaje en el contenedor | `/secrets/google-drive-token.json` |
| Variable de entorno | `GOOGLE_DRIVE_CV_TOKEN_PATH=/secrets/google-drive-token.json` |
| Service account (accessor) | SA del servicio Cloud Run con `roles/secretmanager.secretAccessor` |

El streaming de presentación (`GET …/video` + `…/video/stream`) usa `drive_file_id` ya persistido en `organigrama.person_video`. **No** requiere Folder ID de videos en runtime.

Aplicado / verificado (2026-08-05 — redeploy con cambios locales adicionales):

- Tag: `20260805-124150`
- Backend: `organigrama-backend-00092-9rf` (100 %; imagen `…/organigrama-backend:20260805-124150`)
- Frontend: `organigrama-frontend-00044-lvf` (100 %; imagen `…/organigrama-frontend:20260805-124150`)
- Health: BE live 200 · FE home 200 · `GET …/video` sin auth → 401

Aplicado / verificado (2026-08-05 — visibilidad Presentación autenticada):

- Tag: `20260805-120914`
- Backend: `organigrama-backend-00091-5l2` (100 %; imagen `…/organigrama-backend:20260805-120914`)
- Frontend: `organigrama-frontend-00043-mdr` (100 %; imagen `…/organigrama-frontend:20260805-120914`)
- `GET …/video` sin auth → 401
- Política Presentación: cualquier autenticado; ficha/CV sin cambio

Aplicado / verificado (2026-08-04):

- Revisión Cloud Run: `organigrama-backend-00087-kfb` (tráfico 100 %; imagen `…/organigrama-backend:20260804-100041`)
- Frontend: `organigrama-frontend-00040-dzt` (tráfico 100 %)
- Smoke API previo (revisión 00086): metadatos `200` + Range `bytes=0-1023` → `206` / 1024 bytes
- Fix stream/CORS Presentación desplegado en 00087 + FE 00040
- `person_video` activos: 13 (sin cambios en ese smoke)

## 5. Visibilidad jerárquica

No requiere variable de entorno adicional. Reglas documentadas en `docs/organigrama-core.md` (sección «Visibilidad jerárquica de información»).

## 6. Referencias

- Contrato API y organigrama visual: `docs/organigrama-core.md`
- Streaming video: `docs/person-profile-video-streaming.md`
- README del backend: `README.md` (tabla de rutas)
