# MC1 — Piloto masivo Fábrica de Contenidos

**Estado:** `PILOTO MASIVO FÁBRICA DE CONTENIDOS COMPLETADO`  
**Fecha:** 2026-07-29  
**CLI:** `npm run mc:pilot-fabrica-contenidos -- --dry-run` · `--execute` · `--document=` · `--concurrency=` · `--limit=` · `--resume`

Artefactos: `tmp/mc1-fabrica-contenidos-bulk-pilot/`

---

## 1. Nodo padre resuelto

Versión activa: **4** (`periodo-agosto-2026` · «Versión actual» · Agosto 2026).

| Campo | Valor |
|-------|-------|
| Parent person_id | **1206** |
| Nombre | VACANTE — COORDINADOR FABRICA DE CONTENIDOS - DISENADORES DE CONTENIDO (ANALISTAS) Y PRESENTADORAS |
| Rol | COORDINADOR FABRICA DE CONTENIDOS - DISENADORES DE CONTENIDO (ANALISTAS) Y PRESENTADORAS |
| Documento | null (vacante) |
| Versión activa | 4 / periodo-agosto-2026 |
| Hijos directos | **28** |

Resolución: match normalizado de agujas `vacante` + `coordinador fabrica de contenidos` + `disenadores de contenido` + `presentadoras`. **1 candidato** (sin ambigüedad). No se usó el coordinador persona 1162 (Deyvis) ni la vacante GIF 1205.

Fuente: `organigrama.org_visual_relation` con `version_id` activa. Solo hijos directos.

---

## 2. Cohorte

| Grupo | Cantidad |
|-------|----------|
| Hijos directos | 28 |
| Diseñadores/analistas incluidos | 22 |
| Audiovisuales incluidos | 1 |
| Presentadoras excluidas | 4 |
| Administrativos excluidos | 1 |
| Sin CV (incluidos) | 2 |
| Errores de ejecución | 0 |

**Regla:** el rol solo define inclusión. No determina PRIMARY/SECONDARY/especialidades.

---

## 3. Presentadoras excluidas

| Documento | Nombre | Rol |
|-----------|--------|-----|
| 1013100614 | ALEJANDRA LUCIA SANABRIA RAMIREZ | PRESENTADOR DE CONTENIDO |
| 1013102120 | DANNA CAMILA FIERRO HERRERA | PRESENTADOR DE CONTENIDO |
| 1000020890 | KATHERIN JULIANA ARAQUE PINZON | PRESENTADOR DE CONTENIDO |
| 1072896519 | LINDA GISELL AGUILERA DOMINGUEZ | PRESENTADOR DE CONTENIDO |

**Conclusión:** Las presentadoras no fueron evaluadas porque su dominio profesional aún no está modelado. No fueron clasificadas artificialmente dentro de Diseño Visual ni Producción Audiovisual.

Administrativo excluido: `1000944247` SANTIAGO VANEGAS GARCIA — AUXILIAR ADMINISTRATIVO DE OPERACIONES.

---

## 4. Pipeline (antes → acción)

| Estado inicial | Personas | Resultado |
|----------------|----------|-----------|
| HEALTHY_CURRENT | 11 | EVALUATE_MISSING_DOMAINS → COMPLETED |
| STALE (DIFFERENT_CONTENT) | 10 | REEXTRACT_CURRENT_CV → COMPLETED (ext 221–230) |
| NO_CV | 2 | SKIP_NO_CV (Camilo Ramírez, Doris Ávila) |

Ejecución: `--execute --concurrency=3` · ~7.4 min · **21 COMPLETED · 2 SKIPPED · 0 ERROR**.

---

## 5. Resultados profesionales

| Dominio | PRIMARY_MATCH | SECONDARY_SIGNAL | OUTSIDE | INSUFFICIENT |
|---------|---------------|------------------|---------|--------------|
| VISUAL_DESIGN | **7** | **8** | **6** | 0 |
| AUDIOVISUAL_PRODUCTION | **3** | **3** | **15** | 0 |

Ejemplos PRIMARY:

- Visual: Daniel Pérez, Danna Michelle, Diego Pérez, Darío Navarro, Molano, Laura Melisa, Nidia  
- AV: Juan Pablo Sanabria, Oswaldo Silva (+ Molano PRIMARY en ambos)

Detalle por persona: `per-person/<documento>.json` · resumen: `execution-summary.json`.

---

## 6. Skills / señales frecuentes (inventario)

Top herramientas detectadas en extracciones activas de la cohorte (sin mutar mappings): Photoshop (20), Illustrator (18), … ver `unmatched-skills.json` y `coverage-matrix.json`.

Pendiente futuro (no implementado aquí): alias / mapping / catálogo / especialidad para señales repetidas con evidencia real.

---

## 7. CLI y pruebas

```bash
npm run mc:pilot-fabrica-contenidos -- --dry-run
npm run mc:pilot-fabrica-contenidos -- --execute --concurrency=3
```

- `src/org-chart/mc-fabrica-contenidos-cohort.ts` (+ **8 tests passed**)
- `src/database/scripts/mc-fabrica-contenidos-bulk-pilot.ts`

---

## 8. Integridad

| Ítem | Cumple |
|------|--------|
| Cohorte desde jerarquía activa | sí |
| Solo hijos directos elegibles | sí |
| No clasificación profesional por cargo | sí |
| Presentadoras excluidas | sí |
| No aliases/mappings/PA2/thresholds/Drive | sí |
| No deploy / no push / no commit | sí |
| Máx. 1 extracción activa / SUCCEEDED | ver auditoría lifecycle |

### Auditorías posteriores

- `npm run mc:audit-extraction-lifecycle` — buckets globales: HEALTHY_CURRENT **26**, STALE_SELECTED **84** (resto del universo; cohorte piloto reextraída quedó HEALTHY).
- `npm run mc:reconcile-drive-cv` — RO, `writes=0`; HEALTHY=25 CRITICAL=135 a nivel inventario global Drive↔CV (no introduce writes).

### Browser (muestra mínima sugerida)

Carpeta: `tmp/mc1-fabrica-contenidos-bulk-pilot/browser-verification/` (sesión UI pendiente).

| Perfil | Documento | Motivo muestra |
|--------|-----------|----------------|
| Visual dominante | ver PRIMARY Visual + OUTSIDE/SECONDARY AV en `execution-summary.json` | selector innecesario si 1 publicable |
| Audiovisual dominante | Juan Pablo Sanabria / Oswaldo Silva (PRIMARY AV) | ídem |
| Ambos | Molano u otros con señales en ambos | selector multidominio |
| Insuficiente | OUTSIDE en ambos (p. ej. Alison Castro) | evidencia insuficiente |

Verificación manual UI: ficha, qualification traducida, sin códigos técnicos, responsive, permisos.
