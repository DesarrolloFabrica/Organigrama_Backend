# CUSTOMER_SUCCESS Specialty Foundation V1

**Estado:** ACTIVE  
**Catálogo unificado:** `1.9.0` (CS V1 `1.0.0`)  
**JSON:** `src/mc-pipeline/catalog/mc1-specialties-customer-success-v1.json`

## Lectura de evidencia (Paula · Jeimy · Yenny; Jonh CS secondary)

Núcleos de práctica recurrentes: vinculación/admisión/captación; seguimiento/ciclo de cliente; retención/fidelización/postventa; servicio/atención/PQRS; conversión comercial consultiva. CRM/Zoho/Salesforce/SINU/Five9 → tools, nunca specialties. Procesos exclusivos CUN → contexto, no identidad.

## Specialties

| code | nombre |
| --- | --- |
| `CUSTOMER_INTAKE_ONBOARDING` | Vinculación e incorporación de clientes/usuarios |
| `CUSTOMER_LIFECYCLE_CARE` | Cuidado y seguimiento del ciclo de cliente |
| `CUSTOMER_RETENTION_LOYALTY` | Retención y fidelización |
| `CUSTOMER_SERVICE_SUPPORT` | Servicio al cliente y soporte |

No specialty: CRM, B2B supervisor, CUN_VINCULACIONES, sales ops genérico.

## Radar (6)

`CS_INTAKE_ENROLLMENT` · `CS_LIFECYCLE_FOLLOWUP` · `CS_RETENTION_LOYALTY` · `CS_SERVICE_RESOLUTION` · `CS_RELATIONSHIP_ADVISING` · `CS_COMMERCIAL_CONVERSION`

Mapper: `mapCustomerSuccess` (semantic blob sin tools).

## Validación cohorte B2B

Paula (1195/47), Jeimy (1196/48), Yenny (1198/50): reutilizar P0–R1; P3→P4→Profile.  
Jonh (1191/46): CS secondary solo si MULTI_FIELD lo incluye naturalmente.  
Leidy: `CV_EXTRACTION_BLOCKED` — fuera de este fix.

Script: `scripts/mc1-b2b-customer-success-complete.ts`  
Artefactos: `tmp/mc1-b2b-customer-success-complete/`
