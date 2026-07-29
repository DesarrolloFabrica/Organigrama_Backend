# MC1 — Piloto de visualización multidominio en la ficha

**Estado:** `PILOTO MULTIDOMINIO COMPLETADO` (con limitaciones documentadas)  
**Fecha:** 2026-07-29  
**Usuario piloto:** documento `1000590473` · extracción activa `220`  
**Commit/push:** no realizados (pendiente de revisión)

---

## 1. Auditoría previa (1000590473)

| Campo | Valor |
|-------|-------|
| person_id | 1170 |
| Extracción activa | **220** SUCCEEDED / HEALTHY_CURRENT |
| Evidence / enrichment | 37 / 37 (activos) |
| Evaluation Set | **no existe** tabla `mc_evaluation_set` en BD remota |
| CDR persistido | **no** |
| Evaluación congelada API previa | VISUAL_DESIGN `id=19` (`is_active=true`) |

### Evaluaciones reales

| Dominio | Evaluation ID | Qualification | Score | Especialidades | Activa |
|---------|---------------|---------------|-------|----------------|--------|
| VISUAL_DESIGN | **19** | SECONDARY_SIGNAL | n/a (no publicable) | EMERGENT: VISUAL_GRAPHIC, VISUAL_EDITORIAL · HIDDEN: DIGITAL_ASSETS, IDENTITY, **VISUAL_UI** | **sí** |
| SOFTWARE | **20** (creada en piloto vía `mc:evaluate` oficial) | **OUTSIDE** | n/a | 7 HIDDEN | **no** (`activateOnPersist=false`) |

**SOFTWARE:** el motor PA2 vigente sí puede evaluar la extracción 220. Resultado real = OUTSIDE (0 ACTIVE, 0 EMERGENT). Persistido con trazabilidad **sin** desactivar VISUAL_DESIGN. **No** se muestra en el selector (no publicable).

No se crearon resultados ficticios. No se asignó SOFTWARE manualmente. No se reinterpretó Figma/XD como evidencia de Software.

---

## 2. Auditoría del endpoint actual

| Componente | Archivo | Comportamiento actual | Cambio requerido |
|------------|---------|----------------------|------------------|
| Ruta | `GET /api/org-chart/person/:id/competencies` | Un dominio (`is_active`) | Conservar (compat) |
| Controller | `org-chart.controller.ts` | Summary / domain / specialty | + `.../competencies/professional-profile` |
| Service | `org-chart-competencies.service.ts` | `resolvePrimaryEvaluation` | + `getProfessionalProfile` |
| DTO | `competencies.response.dto.ts` | Sin qualification | + `CompetencyProfessionalProfileDto` |
| FE | `CompetenciesExplorer` | `domains[0]` | Consume professional-profile + selector |
| Auth | `canViewFullProfile` | Igual que ficha | Reutilizado sin cambios |

Contrato legacy **intactos** para consumidores existentes.

---

## 3. Contrato API multidominio

```
GET /api/org-chart/person/:personId/competencies/professional-profile
```

Misma auth que competencias. Query: `includeHidden`, `includeAudit`, `versionId|versionCode`.

### Respuesta (campos reales)

- `person`, `availabilityStatus`
- `extractionId` — extracción activa SUCCEEDED
- `defaultDomainCode` — determinístico
- `crossDomainClassification` — **siempre `null`** hoy (CDR no persistido; no se inventa)
- `evaluatedDomains[]`:
  - `code`, `name`, `qualification`, `evaluationId`
  - `isPublishedPrimary`, `evaluatedAt`, `rulesVersion`
  - `summary` (texto publicable)
  - `activeSpecialtyCount`, `emergentSpecialtyCount`
  - `specialties` (sin HIDDEN salvo `includeHidden`)
  - `warnings`

No expone: prompts, razonamiento interno, PII extra, evidencia completa del CV, scores inventados, posiciones CDR inventadas.

---

## 4. Regla de dominios publicables (final)

Contrastada con publicación provisional MC1.1B (solo PRIMARY se activa por CLI multidominio) y propuesta de piloto:

| Qualification | ¿Pestaña? | Comportamiento UI |
|---------------|-----------|-------------------|
| PRIMARY_MATCH | **Sí** | Contenido completo |
| SECONDARY_SIGNAL | **Sí** | Contenido + etiqueta «Señal secundaria» |
| OUTSIDE | **No** | Evaluable/persistible para auditoría; no selector |
| INSUFFICIENT_EVIDENCE | **No** | No hay sustento suficiente |

Módulo puro: `src/org-chart/mc-multidomain-profile-publish.ts`.

---

## 5. Dominio predeterminado

Sin CDR persistido:

1. Evaluación `is_active` entre publicables  
2. `PRIMARY_MATCH`  
3. Mayor `activeCount` / `emergentCount`  
4. `sort_order` de catálogo / orden estable `SOFTWARE → VISUAL_DESIGN → AUDIOVISUAL_PRODUCTION`

**1000590473:** default = **VISUAL_DESIGN** (única publicable + `is_active`).

---

## 6. Implementación backend

- `mc-multidomain-profile-publish.ts` (+ spec)
- `getProfessionalProfile` en `OrgChartCompetenciesService`
- Endpoint `professional-profile`
- `resolveEvaluation` ampliado: permite lectura de evaluación SUCCEEDED **inactiva** si pertenece a la extracción activa (para futuros secundarios publicables), sin mezclar extracciones históricas
- Evaluación SOFTWARE 20 persistida (`activateOnPersist=false`)

---

## 7. Implementación frontend

- `getPersonProfessionalProfile` + hook `useOrgPersonProfessionalProfile`
- `DomainSelector` (tabs accesibles, teclado ←/→)
- `CompetenciesExplorer` rediseñado: perfil profesional, selector si ≥2 dominios, estado informativo sin ACTIVE, emergentes visibles, HIDDEN ocultas
- Etiquetas: `qualificationLabels.ts` (sin códigos crudos)
- Un dominio → **selector oculto**
- Cambio de persona → resetea selección local

---

## 8. Usuario piloto — qué se ve

Documento **1000590473** · extracción **220**

| Botón | ¿Aparece? | Contenido |
|-------|-----------|-----------|
| Diseño Visual | **Sí** (único; sin selector multi) | SECONDARY_SIGNAL · resumen de señales · 0 ACTIVE · emergentes VISUAL_GRAPHIC + VISUAL_EDITORIAL · VISUAL_UI **no** como ACTIVE |
| Software | **No** | Evaluación real OUTSIDE no publicable |

---

## 9. Controles

| Documento | Resultado API |
|-----------|---------------|
| 1000590473 | Solo VISUAL SECONDARY_SIGNAL |
| 1000035262 | VISUAL PRIMARY_MATCH · VISUAL_GRAPHIC ACTIVE |
| 1015482688 | VISUAL PRIMARY_MATCH (derivado) · VISUAL_GRAPHIC ACTIVE |

---

## 10. Pruebas

| Suite | Resultado |
|-------|-----------|
| Backend `mc-multidomain-profile-publish` + `org-chart-competencies.service` | **27 passed** |
| Frontend `src/features/competencies` | **45 passed** |
| Browser real autenticado | **PENDIENTE** (requiere sesión UI; API verificada en servicio) |

---

## 11. Limitaciones / pendientes

- CDR no persistido → `crossDomainClassification: null` (correcto; no inventar).
- Ningún perfil de control tiene hoy **dos** dominios publicables simultáneos; multidominio UI validado con fixtures/tests.
- Browser real / capturas: abrir ficha tras desplegar backend+frontend locales.
- Evaluation Set (migración 023) ausente en BD remota — fuera de alcance.

---

## 12. Integridad

| Ítem | Cumple |
|------|--------|
| No Google Drive / no reextracción / no cv_extraction mutada en este piloto* | sí |
| No aliases / mappings / especialidades / PA2 rules / thresholds / Qualification / CDR | sí |
| No evaluaciones ficticias | sí (SOFTWARE=OUTSIDE real) |
| No deploy / no push / no commit | sí |

\*Se persistió evaluación SOFTWARE real inactiva (flujo oficial PA2). No se tocó extracción 220.
