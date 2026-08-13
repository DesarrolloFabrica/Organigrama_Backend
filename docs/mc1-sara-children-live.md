# MC1 — Sara Juliana + hijos directos (LIVE)

## Decisión

**`SARA_CHILDREN_VALIDATED_WITH_DRIFT`**

- Fase: `SARA_CHILDREN_LIVE` (sin inventar número 12K; post-12J / post FELIPE_TEAM)
- Fingerprint: `c4c188838d15e4b6`
- `cloudWrites = 0`
- Procesados: 5/5 · errores: 0
- Stack congelado: Gemini `gemini-3.6-flash`, mapper 12E (VD), P4 `1.1.0`, routing `12H.1`, filtro público 12I, Publication Gate vigente

## Identidad resuelta (Cloud RO → MDE)

| Persona | personId | personCvId | CV activo | Snapshot | P0 |
|---|---:|---:|---|---:|---|
| Sara Juliana Martínez López | 52 | 225 | sí | 40 | CREATE |
| Diana Marcela Vargas Camargo | 1207 | 20 | sí | 41 | CREATE |
| María Angélica Cruz Guerrero | 1210 | 32 | sí | 42 | CREATE |
| Sandra Carolina Molano Castro | 1211 | 33 | sí | 43 | CREATE |
| Jhonatan David Márquez Betancur | 1217 | 30 | sí | 44 | CREATE |

Relación org usada **solo** para selección: `parent=52` → children `1207,1210,1211,1217`.

## Hallazgo clave

La cohorte **no** colapsó a EDUCATION homogéneo:

| Persona | R1 primary | Nota |
|---|---|---|
| Sara | **DATA_ANALYTICS** | Taxonomía/P3/P4/radar pendientes |
| Diana | **DIGITAL_MARKETING** | EDU/PPM secundarios; DM sin catálogo |
| María | **EDUCATION** | Teaching + Instructional Design poblados |
| Sandra | **EDUCATION** (+ AV secundario) | Multi-field real desde CV |
| Jhonatan | **EDUCATION** (+ FINANCE_ADMIN) | Instruccional + gestión administrativa |

## P1 span health

Auditoría corregida: units validadas por `startOffset` / `endOffset` / `sourceText`.

- 5/5 → `SPANS_OK`
- Anomalía legada reclasificada: **`AUDITOR_FALSE_POSITIVE`** (no `P1_EXTRACTION_DRIFT`)

## Drift visible (no maquillado)

| Código | Conteo | Comentario |
|---|---:|---|
| `AUDITOR_FALSE_POSITIVE` | 5 | Span check legado |
| `PUBLICATION_DRIFT` | 2 | Sara (DATA_ANALYTICS vacío) · Diana (DIGITAL_MARKETING vacío) — primary taxonomy pending |
| `RADAR_MAPPER_DRIFT` | 2 | `MAPPER_NOT_AVAILABLE` para DATA_ANALYTICS / DIGITAL_MARKETING |

No se modificaron prompts, catálogos ni mappers.

## Artefactos

- `tmp/mc1-sara-children-live/cohort-report.json`
- `tmp/mc1-sara-children-live/person-results.json`
- `tmp/mc1-sara-children-live/analysis-notes.json`
- `tmp/mc1-sara-children-live/drift-summary.json`
- `tmp/mc1-sara-children-live/frozen-config.json`
- `tmp/mc1-sara-children-live/phase-verdict.json`
- `tmp/mc1-sara-children-live/bootstrap.json`

## Recomendación siguiente (sin implementar ahora)

1. Priorizar taxonomía/specialty foundation para **DIGITAL_MARKETING** y **DATA_ANALYTICS** (bloquean representación de Sara/Diana).
2. Continuar sibling LIVE siguiente sin fixes de P4.
3. No deploy / no masivo hasta cerrar más ramas con catálogo maduro.

**DETENIDO.** Sin fixes · sin deploy · sin masivo.
