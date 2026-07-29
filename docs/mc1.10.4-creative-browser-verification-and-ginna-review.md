# MC1.10.4 — Verificación visual real y resolución de Ginna

**Fecha:** 2026-07-28  
**Predecesor:** [MC1.10.3](mc1.10.3-creative-competency-visibility-repair.md)  
**E2E:** `Organigrama_Frontend/e2e/creative-competencies-visibility.spec.ts`  
**Capturas:** `Organigrama_Frontend/e2e/artifacts/mc1104/*.png`  
**Auditoría Ginna:** `tmp/mc1104-ginna-audit.json`

---

## 1. Verificación visual (navegador real)

Login: `desarrollofabrica@cun.edu.co` (`ORG_READ_ALL`).  
Flujo: búsqueda → Abrir ficha → DETALLE → pestaña **Competencias**.  
Prueba: `npx playwright test creative-competencies-visibility` → **1 passed (28.2s)**.

| Persona | API | Ficha DETALLE | Dominio visible | Especialidad visible | Evidencia |
|---------|-----|---------------|-----------------|----------------------|-----------|
| Nidia (1163 / #12) | AVAILABLE | **VISIBLE** | Diseño Visual | Gráfico (VISUAL_GRAPHIC) | `nidia-competencias.png` |
| Daniel (#10) | AVAILABLE | **VISIBLE** | Diseño Visual | Gráfico | `daniel-competencias.png` |
| Juan Pablo (#11) | AVAILABLE | **VISIBLE** | Producción Audiovisual | Motion graphics y animación | `juan_pablo-competencias.png` |
| Santiago (#7) | AVAILABLE | **VISIBLE** | Producción Audiovisual | Edición de video | `santiago-competencias.png` |
| Ginna (#6 mc1.6) | STALE | **STALE explícito** | — | — | `ginna-competencias.png` |

Nidia: evaluado 28 jul 2026, 1 activa · 1 emergente — **sin STALE ni empty state**.  
Ginna: mensaje *«Hay una evaluación histórica, pero no es compatible con el catálogo… Requiere reevaluación bajo el catálogo activo.»* — **no** se confunde con NOT_EVALUATED.

### Caché entre perfiles

Secuencia Nidia → Daniel → Juan Pablo → Santiago → Ginna: **sin contaminación**. Cada ficha mostró nombre, dominio/estado propios. Query key incluye `personId`.

### Tarjetas

Sin cambios: nombre, cargo, estado, DETALLE. Competencias solo en ficha.

---

## 2. Diagnóstico Ginna

| Capa | Resultado |
|------|-----------|
| Documento | 1030646495 |
| person_id | 1166 |
| person_cv activo | **9** (`1030646495.pdf`) |
| extraction activa | **209** SUCCEEDED, alineada a CV 9 |
| enrichment | **7** SUCCEEDED |
| evidence | **7** SUCCEEDED |
| Cadena | alineada |
| Evaluación #6 | VISUAL_DESIGN, mc1.6, `is_active=true`, ACTIVE=0 EMERGENT=3 |
| API | STALE / STALE_CATALOG_NOT_ACTIVE |
| Frontend | aviso STALE explícito |

### Lectura profesional

Práctica principal creativa/contenidos con identidad visual y diagramación; señal AV débil (edición). Tools Adobe mayormente listing (NONE).  
Clasificación: **VISUAL_AUDIOVISUAL_HYBRID** (núcleo visual débil-moderado). Cargo ANALISTA no se usó como evidencia.

### Calidad evidencia

| | Profesional | Tools |
|--|-------------|-------|
| STRONG | 0 | 0 |
| MODERATE | 2 | 0 |
| WEAK | 2 | 1 |
| NONE | 2 | 7 |
| Tier | **LOW** | |

### Dry-run multidominio (mc1.8)

| Dominio | Resultado | Default | Active | Emergent | Hidden |
|---------|-----------|---------|--------|----------|--------|
| VISUAL_DESIGN | **SECONDARY_SIGNAL** | null | 0 | 3 | 2 |
| AUDIOVISUAL_PRODUCTION | OUTSIDE | null | 0 | 0 | 3 |
| SOFTWARE | OUTSIDE | null | 0 | 0 | 7 |

EMERGENT Visual: IDENTITY, EDITORIAL, GRAPHIC (reconocidas por el modelo).

### Causa sin PRIMARY

**REAL_OUTSIDE_OR_SECONDARY** — umbral ACTIVE no alcanzado; evidencia profesional insuficiente (0 STRONG).  
**Mapping gap: no** — el modelo sí reconoce señales; no hay evidencia fuerte ignorada.

### Decisión de persistencia — **Caso C**

Conservar #6 histórica; mantener STALE; **no** crear evaluación bajo mc1.8; frontend con mensaje explícito.  
`--persist-ginna` no aplica (no PRIMARY).

---

## 3. Script / CLI

```bash
npm run mc:audit-creative-visibility
npm run mc:audit-creative-visibility -- --reevaluate-ginna
npm run mc:audit-creative-visibility -- --persist-ginna   # solo si PRIMARY

# Frontend E2E
cd Organigrama_Frontend
npx playwright test creative-competencies-visibility
```

`--browser-check` documenta el comando E2E (no lanza browser desde backend).

---

## 4. Pruebas

| Suite | Resultado |
|-------|-----------|
| Playwright creative-competencies-visibility | **PASS** |
| Frontend competencyQueryKeys + build | PASS (fase 1.10.3; revalidar si hubo cambios) |
| Backend mc-catalog / competencies / pa2 / org-chart / build | PASS |

---

## 5. Veredicto

**GO**

Cierre de la brecha «API debería mostrarlo» vs «el usuario lo ve»: las cuatro fichas AVAILABLE se comprobaron en navegador con capturas; Ginna queda STALE documentado sin forzar dominio.
