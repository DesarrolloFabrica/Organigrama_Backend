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

## 4. Visibilidad jerárquica

No requiere variable de entorno adicional. Reglas documentadas en `docs/organigrama-core.md` (sección «Visibilidad jerárquica de información»).

## 5. Referencias

- Contrato API y organigrama visual: `docs/organigrama-core.md`
- README del backend: `README.md` (tabla de rutas)
