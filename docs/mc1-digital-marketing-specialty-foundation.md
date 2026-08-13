# DIGITAL_MARKETING Specialty Foundation V1

**Estado:** ACTIVE  
**Catálogo unificado:** `1.8.0` (DM V1 `1.0.0`)  
**JSON:** `src/mc-pipeline/catalog/mc1-specialties-digital-marketing-v1.json`

## Lectura de evidencia (Diana · 45 EU)

Núcleos de práctica: campañas/publicidad/posicionamiento; growth/conversión/funnels/KPIs; GTM/ciclo de vida de productos digitales; estrategia digital de marca. Educación/Moodle → EDUCATION (no specialty DM). Tools ≠ specialties.

## Specialties

| code | nombre |
| --- | --- |
| `CAMPAIGN_MARKETING` | Marketing de campañas |
| `GROWTH_MARKETING` | Marketing de crecimiento y conversión |
| `PRODUCT_MARKETING` | Product marketing / Go-to-Market |
| `BRAND_DIGITAL_MARKETING` | Marketing digital de marca |

## Radar (6)

`DM_STRATEGY_PLANNING` · `DM_CAMPAIGN_EXECUTION` · `DM_GROWTH_ACQUISITION` · `DM_CONVERSION_OPTIMIZATION` · `DM_PRODUCT_GTM` · `DM_BRAND_POSITIONING`

Mapper: `mapDigitalMarketing` (semantic blob sin tools).

## Validación piloto

Diana Marcela (personId 1207, snapshot 41): reutilizar P0–R1; P3→P4→Profile.

**Resultado:** `DIGITAL_MARKETING_OPERATIONAL_DIANA_VALIDATED`

| Capa | Resultado |
| --- | --- |
| P3 | OBSERVED: CAMPAIGN, GROWTH, PRODUCT, BRAND · WEAK: [] |
| Gate | `PRIMARY_WITH_OBSERVED_SPECIALTY` |
| Profile | 4 specialties · 4 skills · tools Google Ads/Power BI · radar 6 ejes >0 |
| WEAK público | no |

Script: `scripts/mc1-diana-digital-marketing-complete.ts`  
Artefactos: `tmp/mc1-diana-digital-marketing-complete/`
