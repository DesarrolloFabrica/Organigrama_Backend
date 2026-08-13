# LEGAL — foundation V1 operacional

**Estado:** `LEGAL_OPERATIONAL` (catálogo **1.12.0**, specialties LEGAL **1.0.0**)  
**Validación:** Edwar 1126 + Johana 1130 (`scripts/mc1-legal-complete.ts --confirm`)

## Normalización sourceKey → LEGAL (sin reescribir P2/R1)

| sourceKey histórico P2 | Campo catálogo | Persona |
|---|---|---|
| `field.legal_administrative` | `LEGAL` | Edwar 1126 (primary proposed) |
| `field.legal_services` | `LEGAL` | Johana 1130 (secondary proposed) |

Resolución en capa de wiring: `r1-field-catalog-resolver.ts` + `legacyAliasesToField` en `mc1-professional-fields-v2.json`. Los artefactos R1 conservan `sourceKey` y `fieldCode` originales.

## Specialties V1

- `LEGAL_ADVISORY`
- `LEGAL_DOCUMENT_DRAFTING`
- `PUBLIC_SECTOR_CONTRACTING`
- `ADMINISTRATIVE_LAW`
- `LITIGATION_DISPUTES`

## Radar (6 dimensiones)

- `LEGAL_ADVISORY`
- `LEGAL_ANALYSIS_NORMATIVE`
- `LEGAL_DOCUMENTATION`
- `LEGAL_PROCEDURE`
- `PUBLIC_CONTRACTING_LEGAL`
- `LITIGATION_DISPUTES`

## Deuda cerrada / pendiente

- **Cerrada:** gap P2 `field.legal_administrative` + `field.legal_services` → foundation LEGAL.
- **Pendiente (fuera de alcance):** Elkin 1131 `ACADEMIC_RESEARCH` secondary pending.
- **Excluido:** Jhonatan 1217 (SECOP/skills blob) no es caso ancla LEGAL.

## Invariantes

- SECOP / Ley 80 / Ley 1150 = contexto herramienta/conocimiento, no specialty.
- Docencia jurídica permanece `EDUCATION`.
- Procurement/compras ≠ contratación jurídica (`FINANCE_ADMIN`).
