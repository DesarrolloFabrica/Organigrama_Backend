# MC1.3.4 — API del Explorador de Competencias

Contrato de lectura para el primer Explorador de Competencias.
Solo backend. No recalcula PA2. No expone el modelo físico de BD.

## Principio

La API representa el contrato funcional:

**Persona → Área → Especialidad → Skill → Evidencia**

El frontend recibe resultados ya resueltos (métricas, estados, skills, fragmentos de evidencia).
No debe conocer tablas TypeORM, joins, fórmulas del motor ni versiones internas innecesarias.

## Seguridad

Reutiliza exactamente `OrgChartVisibilityService.canViewFullProfile`:

| Caso | Resultado |
|------|-----------|
| Propio perfil | Permitido |
| Descendiente jerárquico (o `ORG_READ_ALL`) | Permitido |
| Tercero no autorizado | `403` `COMPETENCY_ACCESS_DENIED` |

No existe política paralela. Conocer un `personId` no basta.

### Datos sensibles

No se entrega: CV completo, teléfonos, direcciones, documentos ni datos privados ajenos al Explorador.
Las evidencias son fragmentos ya presentes en Enrichment (`evidenceText` truncado a 400 caracteres).

## Endpoints

Base: `/api/org-chart` (JWT global).

### 1. Resumen inicial

`GET /api/org-chart/person/:personId/competencies`

Query opcional:

- `versionId` / `versionCode` — misma resolución de versión que el resto del organigrama
- `includeHidden=true` — incluye especialidades `HIDDEN` (auditoría)
- `includeAudit=true` — metadatos de evaluación para soporte

Carga inicial: persona mínima, evaluación, áreas, especialidades resumidas (métricas/ranking/default), warnings.
**No incluye evidencias ni listas de skills.**

### 2. Detalle de área

`GET /api/org-chart/person/:personId/competencies/domains/:domainCode`

Para esta fase: `domainCode=SOFTWARE`.

Si el dominio no existe en catálogo → `404` `COMPETENCY_DOMAIN_NOT_FOUND`.

### 3. Detalle de especialidad

`GET /api/org-chart/person/:personId/competencies/domains/:domainCode/specialties/:specialtyCode`

Incluye skills, contribuciones PRIMARY/SECONDARY, métricas por skill y evidencias fragmentarias permitidas.

**No se creó endpoint por skill:** el payload del detalle de especialidad es suficiente para el primer Explorador.

## Estados de disponibilidad (API)

No son estados profesionales (`ACTIVE`/`EMERGENT`/`HIDDEN`).

| Estado | Significado | Resumen / dominio | Detalle especialidad |
|--------|-------------|-------------------|----------------------|
| `AVAILABLE` | Evaluación `SUCCEEDED` activa y coherente (extracción, catálogo, evidencia activos) | `200` con datos | `200` |
| `NOT_EVALUATED` | Sin evaluación activa | `200` sin dominios | `404` `COMPETENCY_EVALUATION_NOT_FOUND` |
| `FAILED` | Evaluación activa con `status=FAILED` | `200` sin dominios + meta | `404` `COMPETENCY_EVALUATION_FAILED` |
| `STALE` | `SUCCEEDED` pero extracción/catálogo/evidencia no activos | `200` sin dominios + warnings | `200` con datos + `availabilityStatus=STALE` |

### Decisión: persona sin evaluación

Se eligió **`200` + `availabilityStatus: NOT_EVALUATED`** en resumen y dominio (coherente con respuestas “soft” de ficha/CV que no fallan por ausencia de dato).
El detalle de especialidad usa **`404`** porque el recurso concreto no existe.

Los GET **nunca** disparan `runMcPa2Engine`.

## Selección de evaluación

Determinista, no “última fila por fecha” a ciegas:

1. `mc_profile_evaluation` con `person_id`, `domain_code`, `is_active = TRUE`
2. Joins a catálogo, dominio, extracción y evidencia
3. Preferencia de fila activa (`ORDER BY id DESC LIMIT 1` entre activas)
4. Si `FAILED` → `FAILED`
5. Si `SUCCEEDED` pero extracción/catálogo/evidencia inactivos → `STALE`
6. Si todo coherente → `AVAILABLE`

## DTOs principales

### `CompetencyExplorerSummaryDto`

```json
{
  "availabilityStatus": "AVAILABLE",
  "person": { "id": "123", "fullName": "…", "role": "…" },
  "evaluation": {
    "id": "10",
    "status": "SUCCEEDED",
    "availabilityStatus": "AVAILABLE",
    "evaluatedAt": "2026-07-27T00:00:00.000Z",
    "rulesVersion": "pa2-software-1.0.0",
    "audit": { "extractionId": "206", "catalogVersion": "1.0.0" }
  },
  "domains": [
    {
      "code": "SOFTWARE",
      "name": "Desarrollo de Software",
      "defaultSpecialtyCode": "SOFTWARE_FRONTEND",
      "activeSpecialtyCount": 5,
      "emergentSpecialtyCount": 2,
      "specialties": [
        {
          "code": "SOFTWARE_FRONTEND",
          "name": "Desarrollo frontend",
          "presentationStatus": "ACTIVE",
          "isDefault": true,
          "rank": 1,
          "metrics": {
            "mappedSkillCount": 11,
            "evidencedSkillCount": 11,
            "coverage": 1,
            "confidence": 0.8307,
            "strength": 31
          },
          "warnings": []
        }
      ]
    }
  ],
  "warnings": []
}
```

Escalas: Coverage `0–1`, Strength `0–100`, Confidence según pipeline PA2.

### Skill dentro de especialidad

```json
{
  "id": "1",
  "code": "react",
  "name": "React",
  "type": "TECHNOLOGY",
  "mapping": { "role": "PRIMARY", "weight": 1 },
  "evidence": {
    "level": "STRONG",
    "strength": 85,
    "confidence": 0.91,
    "items": [{ "sourceType": "SKILLS_SECTION", "text": "…" }]
  }
}
```

## Errores funcionales

| Código | HTTP | Cuándo |
|--------|------|--------|
| `COMPETENCY_ACCESS_DENIED` | 403 | Sin `canViewFullProfile` |
| `COMPETENCY_DOMAIN_INVALID` | 404 | `domainCode` mal formado |
| `COMPETENCY_DOMAIN_NOT_FOUND` | 404 | Dominio ausente en catálogo |
| `COMPETENCY_SPECIALTY_INVALID` | 404 | `specialtyCode` mal formado |
| `COMPETENCY_SPECIALTY_NOT_FOUND` | 404 | Especialidad no en la evaluación |
| `COMPETENCY_EVALUATION_NOT_FOUND` | 404 | Detalle sin evaluación |
| `COMPETENCY_EVALUATION_FAILED` | 404 | Detalle con evaluación fallida |

## Rendimiento

| Endpoint | Consultas típicas | Notas |
|----------|-------------------|--------|
| Resumen | 3 | persona + evaluación + especialidades agregadas |
| Dominio | 4 | + existencia de dominio |
| Especialidad | 4 | dominio + evaluación + fila especialidad + evidencias en lote (`ANY(skill_ids)`) |

No hay N+1 por especialidad ni por skill. El resumen no carga evidencias.

## OpenAPI / Swagger

El backend no usa SwaggerModule hoy. El contrato canónico es este documento y los comentarios JSDoc de `OrgChartController` / DTOs en `competencies.response.dto.ts`.

## Fuera de alcance

Frontend, radar, gráficos, edición, búsqueda, evaluación masiva, disparo PA2 desde GET, nuevos dominios, MC2, seniority, recomendaciones.

No se modifican Extractor, Enrichment, Evidence Engine, PA1, catálogo, mappings ni fórmulas PA2.
