# MC1 — Piloto MVP coordinadores de escuela · Fase C2 (ejecución)

**Estado:** `FASE C2 COMPLETADA`  
**Fecha:** 2026-07-29  
**Duración:** ~8.5 min · concurrencia 2  
**CLI:** `npm run mc:pilot-school-coordinators -- --execute --confirm`

Artefactos: `tmp/mc1-school-coordinators-mvp/` (`before/`, `after/`, `per-person/`, `execution-summary.json`, …)

---

## Procesamiento

| Persona | Acción | Extracción anterior | Extracción nueva | Estado |
|---------|--------|---------------------|------------------|--------|
| Viviana Cabrera (1117526801) | REEXTRACT | 10 | **231** | COMPLETED · HEALTHY |
| Maira Doncel (1023935373) | FIRST_EXTRACTION | — | **232** | COMPLETED · HEALTHY |
| Andrés Prieto (1020720408) | REEXTRACT | 11 | **234** | COMPLETED · HEALTHY |
| Carlos Rodríguez (1010174410) | REEXTRACT | 12 | **233** | COMPLETED · HEALTHY |
| Aura Royero (1042448655) | REEXTRACT | 198 | **235** | COMPLETED · HEALTHY |

Errores: **0**. Abortados: **0**.

Cada persona: PDF vigente → extracción → enrichment → evidence → PA2 (SOFTWARE / VISUAL_DESIGN / AUDIOVISUAL_PRODUCTION) → proyección MVP.

---

## Competencias MVP

| Persona | Consolidadas | Complementarias | Emergentes | Herramientas |
|---------|--------------|-----------------|------------|--------------|
| Viviana | **7** | 0 | 0 | 5 (+1 metodología) |
| Maira | **2** | 0 | 0 | 3 |
| Andrés | **5** | 0 | 0 | 5 |
| Carlos | **5** | 0 | 0 | 4 |
| Aura | **1** | **1** | 0 | 10 (+1 metodología) |

Ejemplos consolidados (proyección read-time, no forzados por cargo):

- **Viviana:** Gestión académica, Educación y pedagogía, Gestión de registros calificados, sistemas/redes, IA  
- **Maira:** Liderazgo de equipos, Registro y Control Académico  
- **Andrés:** Gestión académica, Educación y pedagogía, Acompañamiento pedagógico, Evaluación por competencias  
- **Carlos:** Gestión empresarial, Liderazgo de equipos, Dirección de Programas Académicos  
- **Aura:** Gestión académica (STRONG) · Aseguramiento de calidad (complementaria)

Alertas: `NO_TIER_DIFFERENTIATION` en 4 perfiles (casi todo STRONG; pocas complementarias/emergentes). No bloqueante.

---

## Dominios vigentes

| Persona | SOFTWARE | VISUAL_DESIGN | AUDIOVISUAL | Especialidades |
|---------|----------|---------------|-------------|----------------|
| Viviana | **SECONDARY_SIGNAL** (0 ACTIVE, 1 EMERGENT) | OUTSIDE | OUTSIDE | señal débil SW |
| Maira | OUTSIDE | OUTSIDE | OUTSIDE | — |
| Andrés | OUTSIDE | OUTSIDE | OUTSIDE | — |
| Carlos | OUTSIDE | OUTSIDE | OUTSIDE | — |
| Aura | OUTSIDE | OUTSIDE | OUTSIDE | — |

HUMAN_RESOURCES: **no evaluado** (no operativo).

**4/5** sin dominio representativo publicable → ficha muestra *«Perfil profesional en proceso de clasificación»* + competencias MVP.  
Viviana: un dominio publicable (SOFTWARE SECONDARY) → sin selector innecesario.

---

## Dominio nuevo

**Diagnóstico:** `WEAK_NEW_DOMAIN_SIGNAL`  
**Recomendación siguiente:** `KEEP_AS_CROSS_DOMAIN_CAPABILITIES` (+ `REQUIRE_MORE_PROFILES` antes de modelar)

| Clúster | Personas | Señal |
|---------|----------|-------|
| ACADEMIC_MANAGEMENT | 3 | REPEATED_CROSS_PROFILE_SIGNAL |
| EDUCATION_AND_PEDAGOGY | 2 | REPEATED_CROSS_PROFILE_SIGNAL |
| LEADERSHIP_AND_PROJECTS | 2 | REPEATED_CROSS_PROFILE_SIGNAL (tratar como transversal) |
| BUSINESS_MANAGEMENT | 1 | ISOLATED_SIGNAL |
| QUALITY_ASSURANCE | 1 | ISOLATED_SIGNAL |

No se creó ningún dominio en catálogo. La escuela no se usó como evidencia.

---

## Integración ficha

- API `GET .../competencies/professional-profile` incluye `mvpCapabilities` (proyección desde extraction/evidence).
- Frontend: competencias consolidadas/complementarias/herramientas/emergentes; mensaje de clasificación pendiente si no hay dominio publicable.
- Etiquetas: PRIMARY_MATCH → «Práctica profesional principal»; SECONDARY → «Capacidades profesionales complementarias»; etc.

Browser: plan en `browser-verification/sample-plan.json` (sesión UI manual pendiente de capturas).

---

## Auditoría posterior

| Check | Resultado |
|-------|-----------|
| Máx. 1 extracción activa / persona (cohorte) | sí · ONE_ACTIVE_SUCCEEDED |
| Activas SUCCEEDED | sí |
| 4 stale + Maira → HEALTHY_CURRENT | **sí (5/5)** |
| Extracciones anteriores conservadas | sí (10, 11, 12, 198 inactivas) |
| Evaluaciones sobre extracción nueva | sí |
| Drive reconcile writes | **0** |
| Lifecycle writes | **0** |

---

## Integridad

| Ítem | Cumple |
|------|--------|
| No dominios ficticios | sí |
| No inferencia desde cargo | sí |
| No Google Drive mutado | sí |
| No aliases/mappings/PA2/thresholds mutados | sí |
| No deploy / no push / no commit | sí |
| Migraciones | ninguna |

---

## CLI

```bash
npm run mc:pilot-school-coordinators -- --dry-run
npm run mc:pilot-school-coordinators -- --execute --confirm --concurrency=2
npm run mc:pilot-school-coordinators -- --execute --confirm --document=1117526801
npm run mc:pilot-school-coordinators -- --execute --confirm --resume
```

Idempotencia: segunda corrida con mismo PDF/hash/modelo/prompt/extractor → `NO_ACTION` (reutiliza extracción SUCCEEDED).

---

## Resumen previo a commit (cuando se autorice)

**Archivos tocados (pendiente de commit):**

- `src/database/scripts/mc-school-coordinators-mvp-pilot.ts` (C2 execute)
- `src/org-chart/mc-school-coordinators-cohort.ts` (+ spec)
- `src/org-chart/mc-mvp-capability-projection.ts`
- `src/org-chart/org-chart-competencies.service.ts` (+ DTO + spec)
- `Organigrama_Frontend/.../CompetenciesExplorer.tsx`, types, qualificationLabels
- `package.json` script
- docs preflight + execution
- tmp artefactos (no commit)

**Writes BD (pipeline elegible):** cv_extraction 231–235, enrichment, evidence, mc_profile_evaluation (3 dominios × 5).  
**Pruebas:** cohort 9 + competencies service 30 + FE labels 2.
