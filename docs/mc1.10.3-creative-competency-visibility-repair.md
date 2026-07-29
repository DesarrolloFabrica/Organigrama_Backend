# MC1.10.3 — Reparación de visibilidad de competencias (equipo creativo)

**Fecha:** 2026-07-28  
**Síntoma:** Nidia (1015482688) dejó de mostrar competencias en DETALLE tras MC1.10.2.  
**Script:** `npm run mc:audit-creative-visibility` · `src/database/scripts/mc1103-audit-creative-visibility.ts`  
**Artefactos:** `tmp/mc1103-audit-creative-visibility.json` · `tmp/mc1103-api-dump.json`

---

## 1. Síntoma

Tras activar competencias del equipo creativo (MC1.10.2), la ficha DETALLE de **NIDIA MARCELA PRADA RAMÍREZ** ya no mostraba Diseño Visual, aunque existía una evaluación funcional previa.

## 2. Causa raíz — **Caso B (catálogo)**

| Pregunta | Respuesta |
|----------|-----------|
| ¿Nidia tiene evaluación activa? | Sí tenía **#5** `is_active=true` |
| ¿Fue desactivada por MC1.10.2? | **No** |
| ¿Fue reemplazada por el batch? | **No** (el batch no evaluó a Nidia) |
| ¿Invalidada por cambio de catálogo? | **Sí** — #5 en `mc1.6-2026-07-27` (inactivo); catálogo vigente `mc1.8-2026-07-28` |
| ¿API dejó de devolver competencias? | API devolvía `availabilityStatus=STALE` + `STALE_CATALOG_NOT_ACTIVE` y **domains=[]** |
| ¿Frontend dejó de renderizar? | Sí: con `STALE` y `domains=[]` el explorador caía a empty state (antes se confundía con `NOT_EVALUATED`) |

**No es Caso A:** `persistEvaluation` solo desactiva `person_id + domain_code` de la persona persistida. Confirmado por test `mc-pa2-team-isolation.spec.ts`.

**No es Caso D (caché):** `queryKey` ya incluye `personId` (`['org-person-competencies', personId, includeAudit]`).

## 3. Evaluación anterior de Nidia

| Campo | Valor |
|-------|-------|
| evaluation_id | **5** |
| Dominio | VISUAL_DESIGN |
| Catálogo | mc1.6-2026-07-27 (inactivo) |
| Default | VISUAL_GRAPHIC |
| Extracción | 207 |
| Estado previo al repair | `is_active=true` pero API **STALE** |

Histórica **#3** (también mc1.6) permanece inactiva.

## 4. Reparación

```bash
npm run mc:audit-creative-visibility -- --dry-run-repair
npm run mc:audit-creative-visibility -- --repair-nidia
```

Dry-run bajo catálogo activo:

- VISUAL_DESIGN → ACTIVE=1 EMERGENT=1 → PRIMARY  
- AUDIOVISUAL → OUTSIDE  
- SOFTWARE → OUTSIDE (control negativo)

Persistencia: **SEEDED evaluación #12** (mc1.8). La #5 se desactivó por política normal PA2 (misma persona+dominio). No se borró.

## 5. Evaluación activa final de Nidia

| Campo | Valor |
|-------|-------|
| evaluation_id | **12** |
| Catálogo | **mc1.8-2026-07-28** |
| Dominio | VISUAL_DESIGN |
| Especialidad default | VISUAL_GRAPHIC |
| ACTIVE / EMERGENT / HIDDEN | 1 / 1 / 3 |
| API | **AVAILABLE** |

## 6. Perfiles del lote MC1.10.2

| Persona | eval_id | Catálogo | Dominio | Default | API |
|---------|---------|----------|---------|---------|-----|
| Daniel Pérez | **10** | mc1.8 | VISUAL_DESIGN | VISUAL_GRAPHIC | AVAILABLE |
| Juan Pablo Sanabria | **11** | mc1.8 | AUDIOVISUAL_PRODUCTION | AV_MOTION | AVAILABLE |
| Santiago Vanegas | **7** | mc1.8 | AUDIOVISUAL_PRODUCTION | AV_EDITING | AVAILABLE |
| Ginna Garzón | **6** | mc1.6 (inactivo) | VISUAL_DESIGN | null (0 ACTIVE) | **STALE** |

### Ginna

Dry-run bajo mc1.8: ACTIVE=0 EMERGENT=3 → **no PRIMARY**. No se persistió (política MC1.10.2/1.10.3). Conserva #6 histórica; la ficha muestra mensaje STALE explícito (no competencias inventadas).

## 7. Endpoint DETALLE

Frontend: `GET /api/org-chart/person/:id/competencies` (+ domain/specialty).  
Panel: `PersonDetailPanel` → tab **Competencias** → `CompetenciesExplorer` → `useOrgPersonCompetencies(personId)`.

Tarjetas del organigrama: **sin competencias por diseño** (nombre, cargo, DETALLE).  
Validación de competencias: **solo en DETALLE → Competencias**.

## 8. Caché / query keys

Ya correcto:

```ts
['org-person-competencies', personId, includeAudit]
```

Test FE añadido: `competencyQueryKeys.spec.ts`.

Al cambiar de persona, `PersonDetailPanel` resetea tab y el hook usa otro `personId` → nueva query.

## 9. Ajuste FE STALE

Si API = `STALE` y no hay dominio cargable, ya no se muestra el empty de `NOT_EVALUATED`; se informa que existe evaluación histórica incompatible con el catálogo vigente (caso Ginna).

## 10. Consistencia global (post-repair)

- Sin duplicados activos por `person_id + domain_code` en el lote auditado.
- Nidia: una sola Visual activa (#12).
- Personas afectadas accidentalmente por MC1.10.2: **0** (Nidia no fue tocada por el batch; quedó STALE por catálogo).

## 11. Pruebas

```bash
# Backend
npm test -- mc-catalog
npm test -- competencies
npm test -- pa2
npm test -- org-chart
npm run build

# Frontend
npm test -- competencyQueryKeys
npm run build
```

Nuevo: `mc-pa2-team-isolation.spec.ts` — persistir persona A no desactiva persona B.

## 12. Riesgos

- Perfiles con eval en mc1.6 (p. ej. Ginna) seguirán STALE hasta PRIMARY bajo mc1.8.
- Activar un catálogo nuevo sin reevaluación masiva produce el mismo patrón STALE.

## 13. Resultado

| Gate | Estado |
|------|--------|
| Causa raíz identificada | Sí (Caso B) |
| Nidia eval activa válida | #12 mc1.8 |
| Nidia API | PASS |
| Daniel / Juan Pablo / Santiago API | PASS |
| Ginna | STALE documentado (sin forzar SECONDARY) |
| Script aislado | PASS |
| Veredicto | **GO CON AJUSTES** (verificación visual browser manual pendiente en DETALLE; contrato API+código FE verificados) |

> **Continuación:** la verificación visual real en navegador y la resolución de Ginna (STALE / Caso C) están en [`mc1.10.4-creative-browser-verification-and-ginna-review.md`](mc1.10.4-creative-browser-verification-and-ginna-review.md).
