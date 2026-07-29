# MC1.11.0 — Auditoría y consolidación operativa de Diseño Visual

**Fecha:** 2026-07-28  
**Predecesor:** [MC1.10.4](mc1.10.4-creative-browser-verification-and-ginna-review.md)  
**Pack aplicado:** `visual-design-mappings@1.2.0`  
**Hash:** `5d1d1f2070a87f9b5959f481cb0a53ec593f1b020373828e37f84e2dfcb7c50c`  
**Script:** `npm run mc:audit-visual-domain`  
**Artefactos:** `tmp/mc1110-audit-visual-domain.json`, `tmp/mc1110-persist-visual.json`

---

## 1. Documentación vs implementación

| Especialidad | Madurez documental | lifecycle catálogo | Skills/mappings | PA2 | API | FE | Estado real |
|--------------|-------------------|--------------------|-----------------|-----|-----|----|-------------|
| VISUAL_GRAPHIC | CONSOLIDATED | ACTIVE | 6→+aliases | Sí | Sí | Sí | **IMPLEMENTED** |
| VISUAL_IDENTITY | STABLE | ACTIVE | 3→+aliases branding | Sí | Sí | Sí | **IMPLEMENTED** (post 1.2.0) |
| VISUAL_EDITORIAL | STABLE | ACTIVE | 5→+compuestos | Sí | Sí | Sí | **IMPLEMENTED** (post 1.2.0) |
| VISUAL_UI | RESERVED | ACTIVE (catálogo) | 0 mappings | No | HIDDEN | Excluida | **DOCUMENTED_ONLY / RESERVED** |
| VISUAL_DIGITAL_ASSETS | DEPRECATED | ACTIVE (catálogo) | 3 tool-led | Sí (anti-tool) | HIDDEN tip. | Excluida | **DEPRECATED** (aún en catálogo) |

**Hallazgo:** la madurez metodológica **no** está en `lifecycle_status` (todas `ACTIVE` en seed mc1.8). Es capa documental.

---

## 2. Catálogo activo mc1.8 — Diseño Visual

| Especialidad | Skills canónicas (pack) | Mappings 1.1.0 | Mappings 1.2.0 | Umbral ACTIVE | EMERGENT | Estado |
|--------------|-------------------------|----------------|----------------|---------------|----------|--------|
| VISUAL_GRAPHIC | núcleo + ilustración/retoque | 6 | +7 | coverage 0.45, mapped≥2, evidenced≥2, strength≥20 | resto con evidencia | CONSOLIDATED |
| VISUAL_IDENTITY | identidad + branding aliases | 3 | +11 | idem | idem | STABLE→operativo |
| VISUAL_EDITORIAL | editorial + compuestos | 5 | +5 | idem | idem | STABLE→operativo |
| VISUAL_UI | — | 0 | 0 | — | — | RESERVED |
| VISUAL_DIGITAL_ASSETS | Canva/Genially/InDesign | 3 | +indesign bare | anti-tool | — | DEPRECATED |

PA2 Visual: `pa2-visual-design-1.1.0` (sin cambio de umbrales).  
Default specialty = primera ACTIVE lexicográfica (no hardcode GRAPHIC).

---

## 3. Causa del sesgo hacia VISUAL_GRAPHIC

Combinación confirmada (no un único fallo):

1. **Vocabulario:** Identidad/Editorial tenían keys canónicas, pero CVs usan formulaciones no mapeadas (`identidad_visual`, `branding_…`, `diseno_editorial_y_diagramacion`).
2. **Cardinalidad PA2:** ACTIVE exige ≥2 skills mapeadas+evidenciadas por especialidad → una sola skill IDENTITY/EDITORIAL fuerte → EMERGENT.
3. **Fallback secundario 0.1:** el patrón identidad→GRAPHIC SECONDARY (legítimo) refuerza GRAPHIC cuando hay varias señales; no es un “fallback forzado” de dominio.
4. **Frontend:** no limita a 1 ACTIVE + 1 EMERGENT; muestra todas las no-HIDDEN. Payload Nidia: GRAPHIC ACTIVE + EDITORIAL EMERGENT (IDENTITY HIDDEN por evidencia NONE en `comunicacion_visual`).
5. **Enrichment:** conserva nombres compuestos; el gap es **alias/mapping**, no colapso genérico sistemático.
6. **Corpus:** varios perfiles solo tenían `diseno_grafico` mapeado.

**Diagnóstico dominante:** `ALIAS_GAP` / `MAPPING_GAP` + cardinalidad specialty-level (documentado como `REVIEW_DOMAIN_GATE` para Ginna, sin bajar umbrales).

---

## 4. Corpus auditado (12)

| Persona | Doc | Resultado 1.1.0 | Gap | Acción |
|---------|-----|-----------------|-----|--------|
| Nidia | 1015482688 | PRIMARY GRAPHIC | NONE | NO_CHANGE |
| Daniel | 1032488010 | PRIMARY GRAPHIC | NONE | NO_CHANGE |
| Ginna | 1030646495 | SECONDARY (3 EMERGENT) | PA2_GAP | REVIEW_DOMAIN_GATE |
| Danna | 1000254881 | SECONDARY | MAPPING_GAP | ADD_MAPPING → persistida |
| Darío | 1022356343 | SECONDARY | MAPPING_GAP | ADD_MAPPING → persistida |
| Diego | 1001294362 | OUTSIDE | MAPPING_GAP | ADD_MAPPING → persistida |
| Molano | 1000035262 | OUTSIDE | ALIAS_GAP | ADD_ALIAS → persistida |
| Alison | 1000622424 | OUTSIDE | evidencia débil | OUTSIDE |
| Hari | 1001202072 | OUTSIDE | ALIAS_GAP | mejora a SECONDARY |
| Laura Melisa | 1000366409 | SECONDARY | MAPPING_GAP | ADD_MAPPING → persistida |
| Daissy | 1031164534 | OUTSIDE | MAPPING_GAP | mejora a SECONDARY |
| Laura Patiño | 1023899594 | OUTSIDE | evidencia branding distinta | OUTSIDE |

Controles: Juan Pablo SECONDARY→SECONDARY; Santiago OUTSIDE→OUTSIDE; 0 falsos positivos.

---

## 5. Pack propuesto y aplicado — 1.2.0

Diff respecto a 1.1.0 (selección):

| Cambio | Tipo | Evidencia | Beneficiados | Riesgo |
|--------|------|-----------|--------------|--------|
| branding_* / identidad_visual / diseno_de_marca → IDENTITY (+ GRAPHIC 0.1) | alias/mapping | Diego, Danna, Laura, Molano | bajo |
| diseno_editorial_y_diagramacion → EDITORIAL (+ GRAPHIC 0.1) | alias | Danna | bajo |
| maquetacion / catálogos → EDITORIAL | mapping | Darío, Hari | medio-bajo |
| ilustracion* / retoque* / maquetacion_publicitaria → GRAPHIC | mapping | Daniel, Molano, Alison | bajo |
| diseno_ux/ui, prototipado UI → TRANSVERSAL sin mapping | policy | — | UI no forzada |
| adobe_creative_suite OUTSIDE | policy | Molano | nulo |

Simulación: **7 mejoras**, **0 FP** en controles AV.

---

## 6. Persistencia

| Persona | Eval nueva | Dominio | Especialidades visibles |
|---------|------------|---------|-------------------------|
| Danna | **#13** | VISUAL_DESIGN | GRAPHIC ACTIVE · IDENTITY EMERGENT · EDITORIAL EMERGENT |
| Darío | **#14** | VISUAL_DESIGN | GRAPHIC ACTIVE · EDITORIAL EMERGENT |
| Diego | **#15** | VISUAL_DESIGN | **IDENTITY ACTIVE** · GRAPHIC EMERGENT |
| Molano | **#16** | VISUAL_DESIGN | GRAPHIC ACTIVE · **IDENTITY ACTIVE** |
| Laura Melisa | **#17** | VISUAL_DESIGN | GRAPHIC ACTIVE · IDENTITY EMERGENT · EDITORIAL EMERGENT |

No persistidos (sin PRIMARY): Ginna, Hari, Daissy.  
Nidia #12 / Daniel #10 intactos (NO_CHANGE).  
UI no activada. DIGITAL no reactivado.

---

## 7. Frontend / API

- API expone todas las especialidades no-HIDDEN del resultado PA2.
- FE `partitionSpecialties` / `visibleSpecialties`: sin tope fijo ACTIVE/EMERGENT.
- Nidia: 1 activa · 1 emergente (Gráfico + Editorial) — coherente con payload.
- Gap frontend: **0**.

---

## 8. Pruebas

| Suite | Resultado |
|-------|-----------|
| `npm test -- mc-catalog` | PASS (tras actualizar hash default 1.2.0) |
| `npm test -- visual` | PASS |
| `npm test -- competencies` | PASS |
| `npm test -- pa2` | PASS |
| `npm test -- org-chart` | PASS |
| `npm run build` (backend) | PASS |
| Frontend `competencyFormat` + build | PASS |

---

## 9. CLI

```bash
npm run mc:audit-visual-domain -- --team-scope=vacancy --dry-run
npm run mc:audit-visual-domain -- --simulate-pack
npm run mc:audit-visual-domain -- --documents=... --reevaluate --persist
```

`--apply-pack` documenta el reseed; el default TypeScript ya apunta a 1.2.0.  
Escritura de evaluaciones: solo `--persist` y solo si ACTIVE≥1.

---

## 10. Veredicto

**GO CON AJUSTES**

Cierra la brecha operativa identidad/editorial vía pack 1.2.0 sin bajar umbrales.  
Pendiente no bloqueante: domain-level gate (Ginna), retiro DIGITAL V3, corpus UI, Laura Patiño/Alison OUTSIDE legítimos.
