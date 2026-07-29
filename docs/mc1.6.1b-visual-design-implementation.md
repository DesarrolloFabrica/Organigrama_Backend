# MC1.6.1B — Implementación Diseño Visual V1 (Nidia)

**Fecha:** 2026-07-27  
**Modo:** Cloud + código (idempotente / versionado)  
**Semilla:** documento `1015482688` — NIDIA MARCELA PRADA RAMIREZ (`person_id=1163`)  
**Siguiente fase:** MC1.6.1C — refinamiento con perfiles hermanos (no ejecutada)

Artefactos:

- `tmp/mc161b-nidia-dry-run.json`
- `tmp/mc161b-nidia-persisted.json`
- `tmp/mc161b-camilo-persisted.json`
- `tmp/mc161b-postcheck.json`
- `tmp/mc161b-api-summaries.json`

---

## 1. Resumen ejecutivo

Se creó el dominio **VISUAL_DESIGN** (catálogo `mc1.6-2026-07-27`), con 5 especialidades, pack de mappings basado en la cadena vigente de Nidia, regla **`pa2-visual-design-1.0.0`**, evaluación PA2 persistida (`evaluation_id=3`) y desacople API/FE del hardcode SOFTWARE.

**Resultado Nidia (PA2):** principal **Diseño gráfico** (`VISUAL_GRAPHIC`); 1 ACTIVE / 2 EMERGENT / 2 HIDDEN.  
**Rol organizacional:** sin cambios (`role_id=25`, ANALISTA DE DISEÑO DE CONTENIDOS).  
**Camilo SOFTWARE:** re-evaluado en catálogo nuevo (`evaluation_id=4`); métricas idénticas a la evaluación 1.1.0 previa (`evaluation_id=2`, ahora histórica).

---

## 2. Archivos modificados / nuevos (principales)

### Backend

| Área | Archivos |
|------|----------|
| Catálogo | `mc-catalog.constants.ts`, `mc-catalog.definition-mc12.ts`, `mc-catalog.definition.spec.ts`, `mc-catalog.visual-design.spec.ts` |
| Mappings | `mc-catalog.mapping-visual-design-mc16.ts`, `mc-catalog.mapping-registry.ts`, `mc-catalog.mapping.service.ts`, `mc-mappings-seed.ts` |
| PA2 | `mc-pa2.config.ts`, `mc-pa2.engine.ts`, `mc-pa2.service.ts` |
| API | `org-chart-competencies.service.ts` (+ specs) |
| Scripts | `mc161b-preflight-nidia.ts`, `mc161b-postcheck.ts`, `mc161b-api-dump.ts`, `mc161b-empty-person.ts`, `mc161b-fix-orphan-evals.ts` |

### Frontend

| Área | Archivos |
|------|----------|
| Radar | `radarLabels.ts` (+ specs), `CompetencyRadar.tsx` |
| Explorer | `CompetenciesExplorer.tsx` |
| Narrativa | `trajectoryNarrative.ts` (+ specs) |

---

## 3. Migraciones o seeds

No hubo migración SQL nueva. Escrituras via seeds existentes:

```text
npm run mc:catalog -- --seed --activate --i-confirm-seed
npm run mc:mappings -- --seed --i-confirm-seed --domain=SOFTWARE --catalogVersion=mc1.6-2026-07-27
npm run mc:mappings -- --seed --i-confirm-seed --domain=VISUAL_DESIGN --catalogVersion=mc1.6-2026-07-27
npm run mc:evaluate -- --extraction-id=207 --domain=VISUAL_DESIGN --rules-version=pa2-visual-design-1.0.0 --dry-run
npm run mc:evaluate -- --extraction-id=207 --domain=VISUAL_DESIGN --rules-version=pa2-visual-design-1.0.0 --i-confirm-evaluate
npm run mc:evaluate -- --extraction-id=206 --domain=SOFTWARE --rules-version=pa2-software-1.1.0 --i-confirm-evaluate
```

Catálogo previo `mc1.2-2026-07-27` → `RETIRED` / `is_active=false` (histórico intacto).

---

## 4. Dominio creado

| Campo | Valor |
|-------|-------|
| code | `VISUAL_DESIGN` |
| name | Diseño Visual |
| catalog_version | `mc1.6-2026-07-27` (`mc_catalog_version.id=2`) |
| domain_id Cloud | **3** |

No se asoció a cargo ni área organizacional.

---

## 5. Especialidades creadas

| code | name | id Cloud (approx) | Estado PA2 Nidia |
|------|------|-------------------|------------------|
| `VISUAL_GRAPHIC` | Diseño gráfico | 15 | **ACTIVE** (principal) |
| `VISUAL_IDENTITY` | Identidad visual | 16 | HIDDEN |
| `VISUAL_EDITORIAL` | Diseño editorial | 17 | EMERGENT |
| `VISUAL_DIGITAL_ASSETS` | Recursos visuales digitales | 18 | EMERGENT |
| `VISUAL_UI` | Diseño de interfaces | 19 | HIDDEN (sin mappings V1) |

---

## 6. Skills creadas o reutilizadas

No se crearon skills nuevas en `cv_skill`. Se reutilizó el catálogo canónico existente vía `normalized_key` + `skill_type` (pack Nidia, 37 clasificaciones).

---

## 7. Mappings y pesos

Pack: `mc1.6-visual-nidia-2026-07-27`  
Hash mappings VISUAL: `bc29810c191dac540ec5724a0fcf4fa7cd143a57112de8b01d2822cdeff0ed3a`  
Conteos Cloud (catálogo activo): SOFTWARE **48** mappings · VISUAL_DESIGN **11** mappings

### Clasificación (37)

| Clase | n | Ejemplos |
|-------|---|----------|
| DOMAIN_SPECIALTY | 9 | diseno_grafico, adobe_*, canva, genially, diseno_editorial, comunicacion_visual, QA |
| TRANSVERSAL_FUTURE | 15 | IA, prompting, gestión de proyectos, soft skills |
| OUTSIDE_SOFTWARE_DOMAIN | 13 | SCORM, LMS, diseño instruccional, Premiere, AE, CapCut, Midjourney… |

### Pesos DOMAIN_SPECIALTY (jerarquía: profesional > evidencia > herramienta)

| skill | specialty | type | weight |
|-------|-----------|------|--------|
| diseno_grafico | VISUAL_GRAPHIC | PRIMARY | **1.0** |
| control_de_calidad_(qa) | VISUAL_GRAPHIC | PRIMARY | 0.45 |
| adobe_illustrator | VISUAL_GRAPHIC | PRIMARY | 0.25 |
| adobe_photoshop | VISUAL_GRAPHIC | PRIMARY | 0.25 |
| canva | VISUAL_GRAPHIC | SECONDARY | 0.10 |
| diseno_editorial | VISUAL_EDITORIAL | PRIMARY | 1.0 |
| adobe_indesign | VISUAL_EDITORIAL | SECONDARY | 0.20 |
| comunicacion_visual | VISUAL_IDENTITY | PRIMARY | 1.0 |
| adobe_indesign | VISUAL_DIGITAL_ASSETS | PRIMARY | 0.55 |
| canva | VISUAL_DIGITAL_ASSETS | PRIMARY | 0.25 |
| genially | VISUAL_DIGITAL_ASSETS | PRIMARY | 0.25 |

**Sin mappings a `VISUAL_UI`** (no inventar evidencia UX/UI).

---

## 8. Regla PA2

| Campo | Valor |
|-------|-------|
| engine_rules_version | `pa2-visual-design-1.0.0` |
| rankingStrategy | `LEXICOGRAPHIC` |
| activeCoverageThreshold | 0.45 |
| minimumMappedSkills | 2 |
| minimumEvidencedSkills | 2 |
| minimumActiveStrength | **20** (evita ACTIVE por solo WEAK/tools) |
| singleSkillDominanceThreshold | 0.9 |
| config_hash | `1ed2a80a00ef3d85…` |

Software conserva `pa2-software-1.0.0` / `1.1.0` sin cambio de umbrales.

---

## 9. Resultado dry-run de Nidia

Tras calibrar `minimumActiveStrength=20`:

| specialty | status | coverage | strength | evidenced |
|-----------|--------|----------|----------|-----------|
| VISUAL_GRAPHIC | ACTIVE (default) | 0.80 | 45.9 | 4 |
| VISUAL_EDITORIAL | EMERGENT | 1.00 | 4.5 | 2 |
| VISUAL_DIGITAL_ASSETS | EMERGENT | 0.33 | 2.0 | 1 |
| VISUAL_IDENTITY | HIDDEN | 0 | 0 | 0 |
| VISUAL_UI | HIDDEN | 0 | 0 | 0 |

Cadena usada: person **1163**, CV **7**, extraction **207**, enrichment **5**, evidence **5**, hash `467d7dbe…f86f3a6`.

---

## 10. Resultado persistido

| Campo | Valor |
|-------|-------|
| evaluation_id | **3** |
| outcome | SEEDED |
| domain | VISUAL_DESIGN |
| default | VISUAL_GRAPHIC |
| ACTIVE / EMERGENT / HIDDEN | 1 / 2 / 2 |
| catalog_version_id | 2 |
| mapping_hash | `bc29810c191dac54…` |

---

## 11. Comparación Camilo antes/después

| | Eval 2 (histórica) | Eval 4 (activa) |
|--|--------------------|-----------------|
| rules | pa2-software-1.1.0 | pa2-software-1.1.0 |
| default | SOFTWARE_BACKEND | SOFTWARE_BACKEND |
| ACTIVE/EMERGENT | 5 / 2 | 5 / 2 |
| mapping_hash | `c58af99297ec9915…` | idéntico |
| config_hash | `c61ad54a4a93247d…` | idéntico |
| specialty diffs | — | **0** |

Eval 2 desactivada (catálogo retirado). Eval 1 (1.0.0) permanece histórica `is_active=false`.

---

## 12. Respuesta API de Nidia

`GET …/person/1163/competencies` (vía `OrgChartCompetenciesService`):

- `availabilityStatus`: **AVAILABLE**
- `person.role`: **ANALISTA DE DISEÑO DE CONTENIDOS** (sin mutación)
- `domains[0].code`: **VISUAL_DESIGN**
- `defaultSpecialtyCode`: **VISUAL_GRAPHIC**
- `evaluation.id`: **3** / `rulesVersion`: `pa2-visual-design-1.0.0`
- Radar: 5 ejes VISUAL_* (HIDDEN incluidos con `includeHidden`)

Detalle: `tmp/mc161b-api-summaries.json`

---

## 13. Respuesta API de Camilo

- `availabilityStatus`: **AVAILABLE**
- `domains[0].code`: **SOFTWARE**
- `defaultSpecialtyCode`: **SOFTWARE_BACKEND**
- `evaluation.id`: **4** / `pa2-software-1.1.0`

Persona sin evaluación (Johan `person_id=2`): `NOT_EVALUATED`, `domains=[]`, warning `COMPETENCY_EVALUATION_NOT_FOUND`.

---

## 14. Pruebas backend

```text
npx jest --testPathPatterns="mc-catalog|mc-pa2|competencies.service|org-chart-competencies"
→ 6 suites / 66 tests passed
npm run build → OK
```

Cobertura funcional validada:

- hash mappings por dominio
- summary sin hardcode SOFTWARE
- PA2 visual determinista
- abort chain (extracción/CV/persona/hash enrichment)
- Softwaare sin regresión de métricas

---

## 15. Pruebas frontend

```text
npx vitest run src/features/competencies → 8 files / 35 tests passed
npm run build → OK (tsc -b && vite build)
```

Radar dinámico SOFTWARE (7) y VISUAL_DESIGN (5); `domains[0]` sin preferir SOFTWARE; narrativa de trayectoria genérica (no hardcode Nidia).

---

## 16. Builds

| Proyecto | Resultado |
|----------|-----------|
| Organigrama_Backend `nest build` | OK |
| Organigrama_Frontend `tsc -b && vite build` | OK |

---

## 17. Alternativa VISUAL_UI / rol vs competencias

**Implementado (preferencia 1 del brief, sin inventar evidencia):**

1. Especialidad `VISUAL_UI` existe en catálogo.
2. V1 **sin mappings** → PA2 la deja **HIDDEN** (no EMERGENT artificial).
3. Narrativa FE (`buildTrajectoryNarrative`) se activa solo si el **cargo** es UX/UI-oriented y la especialidad principal no es UI.

**Estado Cloud del rol de Nidia (2026-07-27):** sigue siendo **ANALISTA DE DISEÑO DE CONTENIDOS**, no “Diseñadora UX/UI”.  
Por eso la narrativa UX/UI **no se muestra aún**; el organigrama v4 no se tocó. Cuando el cargo pase a UX/UI sin mappings UI, la ficha mostrará cargo + trayectoria sin inflar PA2.

---

## 18. Confirmación previa (abort guards)

Preflight Cloud (`mc161b-preflight-nidia`): `abort=false`.

| Check | OK |
|-------|----|
| person_id 1163 / doc 1015482688 | sí |
| CV activo 7 | sí |
| extracción 207 activa SUCCEEDED | sí |
| enrichment 5 / evidence 5 | sí |
| hash `467d7dbe…f86f3a6` | sí |
| cadena CV↔ext↔enr↔ev | sí |
| persona activa | sí |

Guards añadidos en `McPa2Service.assertEvaluationChainCoherent` (persona/CV/extracción activa + hash enrichment).

Fix adicional: desactivación de evals previas por `person_id + domain_code` (no `domain_id`), más limpieza de eval huérfana Camilo #2 en catálogo retirado.

---

## 19. Riesgos pendientes

1. Enum de clasificación sigue llamándose `OUTSIDE_SOFTWARE_DOMAIN` (legacy) para skills fuera de VISUAL V1.
2. Narrativa UX/UI pendiente del cambio real de cargo en organigrama.
3. Hermanos no evaluados (MC1.6.1C).
4. Figma no estaba en la cadena vigente de Nidia → no mapeada a VISUAL_UI.
5. Dos evaluaciones SOFTWARE activas podían coexistir tras cambio de catálogo; corregido, monitorear en futuros bumps de catálogo.

---

## 20. Veredicto

**APROBADO para cierre de MC1.6.1B**, con la precisión factual:

> Nidia se desempeña actualmente como **Analista de Diseño de Contenidos** (rol vigente en Cloud/v4), mientras que su evidencia profesional disponible muestra fortaleza principal en **Diseño Visual**, especialmente en **Diseño gráfico**, con especialidades emergentes en editorial y recursos digitales. **Diseño de interfaces** queda contemplado en catálogo sin inflar PA2 (HIDDEN / sin mappings). Cuando el cargo organizacional pase a UX/UI, la UI podrá narrar trayectoria sin alterar scores.

Criterios:

| Criterio | Estado |
|----------|--------|
| Rol v4 intacto | Sí (`role_id=25`) |
| Dominio Diseño Visual independiente | Sí |
| UI sin inflación artificial | Sí (HIDDEN, sin mappings) |
| Evaluación trazable Nidia | Sí (`id=3`) |
| Radar dinámico | Sí |
| Software sin regresión | Sí (diff 0 vs eval 2) |
| FE no mono-dominio | Sí |
| Sin selector multidominio | Sí |
| Cargo ≠ competencias evidenciadas | Sí |

**Listo para MC1.6.1C** (hermanos).
