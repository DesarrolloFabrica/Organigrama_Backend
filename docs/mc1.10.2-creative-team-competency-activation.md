# MC1.10.2 — Activación de competencias del equipo creativo de Nidia

**Fecha:** 2026-07-28  
**Fase:** Activación Visual / Audiovisual para el equipo estructural asociado a Nidia  
**Catálogo activo:** `mc1.8-2026-07-28` (id=3)  
**Script:** `npm run mc:activate-creative-team` · `src/database/scripts/mc1102-activate-creative-team.ts`  
**Artefactos:** `tmp/mc1102-activate-creative-team.json` · `tmp/mc1102-team-universe.json` · `tmp/mc1102-complete-selected-chains.json`

> **Regresión post-cierre (MC1.10.3):** tras activar el catálogo `mc1.8`, la evaluación Visual histórica de Nidia (#5 en `mc1.6`) quedó `is_active=true` pero el API la marcó `STALE_CATALOG_NOT_ACTIVE` y la ficha DETALLE dejó de mostrar competencias. **MC1.10.2 no desactivó a Nidia**; el batch no la tocó. Reparación y verificación E2E en [`mc1.10.3-creative-competency-visibility-repair.md`](mc1.10.3-creative-competency-visibility-repair.md). Estado real de MC1.10.2: **funcionalmente incompleto** hasta ese cierre.

> Principio: cada persona = su propio CV + extracción + evidencia + evaluación.  
> Cargo organizacional ≠ dominio profesional. Tools solas no activan dominio.

---

## 1. Líder

| Campo | Valor |
|-------|-------|
| Nombre | NIDIA MARCELA PRADA RAMIREZ |
| Documento | **1015482688** |
| person_id | **1163** |
| Correo | nidia_prada@cun.edu.co |
| Rol | ANALISTA DE DISEÑO DE CONTENIDOS |
| Área | FABRICA Y DESARROLLO |
| Activo | Sí |
| Eval Visual previa | #5 (VISUAL_DESIGN) — no se reutilizó como fuente para compañeros |

---

## 2. Jerarquía (fuente de verdad)

Versión activa: **4** (`periodo-agosto-2026`).

Hallazgo crítico:

- Nidia tiene **0 hijos directos** (`parent_person_id = 1163`).
- El equipo de la captura son **hermanos** bajo la vacante:

| Campo | Valor |
|-------|-------|
| parent_person_id | **1206** |
| Nombre | VACANTE — COORDINADOR FABRICA DE CONTENIDOS - DISENADORES DE CONTENIDO (ANALISTAS) Y PRESENTADORAS |

El script usa `--team-scope=auto` (default): intenta hijos directos; si 0 → fallback a hermanos bajo el padre compartido (`TEAM_SCOPE=SIBLINGS_UNDER_SHARED_PARENT`).

**Universo procesado:** 27 miembros (excluye a Nidia).

---

## 3. Universo de hijos / co-reportees

27 personas activas bajo el padre 1206 (sin Nidia). Roles mixtos: `ANALISTA DE DISEÑO DE CONTENIDOS`, `PRESENTADOR DE CONTENIDO`, `REALIZADOR AUDIOVISUAL`, `AUXILIAR ADMINISTRATIVO DE OPERACIONES`.

La captura de referencia (Daniel, Ginna, Laura Melisa, Diego, Molano, Oswaldo, Jesica, Santiago, Darío, Juan Pablo, Doris, Daissy, Alison, Cuspian, …) está contenida en el universo, pero **no** es la lista completa (hay más: Aníbal, Blanca, Camilo Ramírez, Danna Michelle, Hari, Hermida, Juliana, Laura Patiño, Yampier, presentadoras adicionales).

---

## 4. Auditoría de CV y clasificación preliminar

### Presentadoras excluidas (`PRESENTER_DEFERRED`)

| Documento | Persona | Evidencia de presentación | Estado |
|-----------|---------|---------------------------|--------|
| 1013100614 | ALEJANDRA LUCIA SANABRIA RAMIREZ | Cargo PRESENTADOR + señales CV | DEFERRED_UNMODELED_PROFESSION |
| 1013102120 | DANNA CAMILA FIERRO HERRERA | Cargo PRESENTADOR | DEFERRED_UNMODELED_PROFESSION |
| 1000020890 | KATHERIN JULIANA ARAQUE PINZON | Cargo PRESENTADOR | DEFERRED_UNMODELED_PROFESSION |
| 1072896519 | LINDA GISELL AGUILERA DOMINGUEZ | Cargo PRESENTADOR (+ señales mixtas) | DEFERRED_UNMODELED_PROFESSION |

Sin `evaluation_id` nuevo. Empty state esperado en frontend.

### Otros excluidos

| Documento | Persona | Motivo |
|-----------|---------|--------|
| 1004250526 | LUIS MIGUEL CUSPIAN ANGUCHO | OTHER_DOMAIN (sin señales visual/AV en corpus) |

### Candidatos seleccionados

22 personas `CANDIDATE_VISUAL` / `CANDIDATE_AUDIOVISUAL` / `CANDIDATE_VISUAL_AUDIOVISUAL`.

---

## 5. Cadenas CV completadas

Se completaron **11** enrichments + evidence faltantes (ext 108, 120, 107, 101, 117, 98, 116, 96, 118, 97, 113 → enrichments 25–35).

**Cadenas completas al final:** 20/22 seleccionados.

Pendientes sin CV activo (`NEED_CV`):

| Documento | Persona | Nota |
|-----------|---------|------|
| 93135969 | CAMILO ANDRES RAMIREZ VARGAS | REALIZADOR AUDIOVISUAL — sin person_cv activo |
| 103154553 | DORIS KATHERINE AVILA HERNANDEZ | Extracción huérfana sin CV activo |

---

## 6. Dry-run multidominio (Visual · AV · Software)

Software actuó como **control negativo** (OUTSIDE en todos los PRIMARY).

### PRIMARY_MATCH aprobados

| Documento | Persona | Dominio primario | Default specialty | Visual | AV | Software |
|-----------|---------|------------------|-------------------|--------|-----|----------|
| 1032488010 | DANIEL ALEJANDRO PEREZ SANCHEZ | **VISUAL_DESIGN** | VISUAL_GRAPHIC | PRIMARY | OUTSIDE | OUTSIDE |
| 1022445625 | JUAN PABLO SANABRIA DIAZ | **AUDIOVISUAL_PRODUCTION** | AV_MOTION | SECONDARY | PRIMARY | OUTSIDE |
| 1000944247 | SANTIAGO VANEGAS GARCIA | **AUDIOVISUAL_PRODUCTION** | AV_EDITING | OUTSIDE | PRIMARY (3 ACTIVE) | OUTSIDE |

### Perfiles sin persistencia (motivos)

| Motivo | Personas (ejemplos) |
|--------|---------------------|
| SECONDARY_SIGNAL | Danna Michelle, Darío, Ginna (dry-run), Laura Melisa, Jesica, Hermida, Molano, Yampier, Alison (AV) |
| OUTSIDE | Daissy, Diego, Hari, Laura Patiño, Alison (Visual) |
| INSUFFICIENT_EVIDENCE | Aníbal, Blanca, Juliana, Oswaldo |
| NEED_CV | Camilo Ramírez, Doris |
| OTHER_DOMAIN | Luis Cuspian |
| PRESENTER_DEFERRED | 4 presentadoras |

**Ginna (1030646495):** ya tenía eval Visual **#6** activa de fases previas. El dry-run actual con PA2 vigente da solo `SECONDARY_SIGNAL` → **no se creó evaluación nueva**; se conserva la histórica #6.

---

## 7. Persistencia

| Documento | Persona | Outcome | evaluation_id | Dominio | API |
|-----------|---------|---------|---------------|---------|-----|
| 1032488010 | Daniel Pérez | **SEEDED** | **10** | VISUAL_DESIGN | AVAILABLE ✓ |
| 1022445625 | Juan Pablo Sanabria | **SEEDED** | **11** | AUDIOVISUAL_PRODUCTION | AVAILABLE ✓ |
| 1000944247 | Santiago Vanegas | **REUSE** | **7** | AUDIOVISUAL_PRODUCTION | AVAILABLE ✓ |

Idempotencia Santiago: `persona + extracción + catálogo + dominio + mapping pack + PA2` → ALREADY_EXISTS / REUSE.

---

## 8. Mapping gaps / señales no modeladas

### Mapping gaps (documentados, no corregidos en esta fase)

- Varios analistas con práctica visual aparente quedan en EMERGENT/OUTSIDE (p. ej. Laura Melisa, Danna Michelle, Darío): posible vocabulario de “diseño de contenidos” / piezas no mapeado a skills Visual PRIMARY.
- Diego / Daissy / Hari / Laura Patiño: señales preliminares visuales pero PA2 OUTSIDE → revisar mappings en fase posterior (`MAPPING_GAP`).

### Señales audiovisuales no modeladas (`UNMODELED_AUDIOVISUAL_SIGNAL`)

- Camilo Ramírez: cargo REALIZADOR AUDIOVISUAL sin CV → no se forzó a AV_EDITING.
- Especialidades no activadas en esta fase: AV_PRODUCTION, AV_PHOTOGRAPHY, AV_SOUND, AV_STREAMING (por diseño).

### Presentación (dominio futuro)

- No se creó dominio Presentación / Comunicación.
- Presentadoras quedan `DEFERRED_UNMODELED_PROFESSION`.

---

## 9. API / Frontend

| Check | Resultado |
|-------|-----------|
| API Daniel Visual | PASS (`AVAILABLE`, dominio presente) |
| API Juan Pablo AV | PASS |
| API Santiago AV | PASS |
| Presentadoras / no evaluados | empty state / NOT_EVALUATED (sin eval nueva) |
| Frontend hardcode Software | no modificado en esta fase |
| Herencia de competencias de Nidia | no aplicada |
| Copia entre compañeros | no aplicada |

---

## 10. CLI

```bash
# Dry-run (default) — auto resuelve hermanos si no hay hijos
npm run mc:activate-creative-team -- --leader-document=1015482688 --dry-run

# Persistencia solo PRIMARY_MATCH
npm run mc:activate-creative-team -- --leader-document=1015482688 --persist

# Alcance explícito
npm run mc:activate-creative-team -- --leader-document=1015482688 --team-scope=siblings --dry-run
```

Opciones: `--team-scope=direct|siblings|auto`, `--documents=`, `--include-visual`, `--include-audiovisual`, `--exclude-presenters`, `--force-reextract`, `--skip-api-check`, `--out=`.

---

## 11. Pruebas

```bash
npm test -- mc-catalog
npm test -- competencies
npm test -- pa2
npm test -- org-chart
npm run build
```

(Ver ejecución en el cierre de fase.)

---

## 12. Resultado final

| Métrica | Valor |
|---------|-------|
| Hijos directos de Nidia | **0** |
| Equipo estructural (hermanos) | **27** |
| Candidatos Visual/AV | **22** |
| Presentadoras excluidas | **4** |
| Cadenas completadas en fase | **11** nuevas (+9 ya completas) |
| Eval Visual creadas | **1** (#10 Daniel) |
| Eval Audiovisual creadas | **1** (#11 Juan Pablo) |
| Eval reutilizadas | **1** (#7 Santiago) + histórica Ginna #6 conservada |
| Veredicto | **GO CON AJUSTES** |

### Ajustes abiertos

1. Nidia no es jefe formal en v4; el alcance real es hermanos bajo vacante 1206 (`team-scope=auto`).
2. Muchos diseñadores quedan SECONDARY/OUTSIDE — posible `MAPPING_GAP` / evidencia débil; no se bajaron umbrales.
3. Camilo Ramírez y Doris sin CV activo.
4. Dominio Presentación pendiente (fuera de alcance).
