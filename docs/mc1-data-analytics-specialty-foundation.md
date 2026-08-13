# DATA_ANALYTICS Specialty Foundation V1

**Estado:** ACTIVE (implementado)  
**Catálogo unificado:** `1.7.0` (DA V1 `1.0.0`)  
**JSON:** `src/mc-pipeline/catalog/mc1-specialties-data-analytics-v1.json`

## Specialties

| code | nombre |
| --- | --- |
| `BUSINESS_INTELLIGENCE` | Business Intelligence |
| `DATA_ENGINEERING` | Ingeniería de datos analíticos |
| `PREDICTIVE_ANALYTICS` | Analítica predictiva |
| `DATA_GOVERNANCE` | Gobernanza y calidad de datos |

## Radar (6)

`DA_DATA_PIPELINE`, `DA_DATA_PLATFORM`, `DA_BUSINESS_REPORTING`, `DA_PREDICTIVE_MODELING`, `DA_GOVERNANCE_QUALITY`, `DA_DECISION_ENABLEMENT`

Mapper: `mapDataAnalytics` en `profile-skill-dimension-mapper.ts` (semantic blob sin tools).

## Validación piloto

Sara Juliana (personId 52, snapshot 40): reutilizar P0–R1; ejecutar P3→P4→Profile.

**Resultado:** `DATA_ANALYTICS_OPERATIONAL_SARA_VALIDATED`

| Capa | Resultado |
| --- | --- |
| P3 | OBSERVED: BI, DATA_ENGINEERING, PREDICTIVE_ANALYTICS · WEAK: DATA_GOVERNANCE |
| Gate | `PRIMARY_WITH_OBSERVED_SPECIALTY` (sin TAXONOMY_PENDING) |
| Profile | 3 specialties · 4 skills · 11 tools · radar 6 ejes |
| WEAK público | no |
| Mapper | disponible |

Script: `scripts/mc1-sara-data-analytics-complete.ts`  
Artefactos: `tmp/mc1-sara-data-analytics-complete/`
