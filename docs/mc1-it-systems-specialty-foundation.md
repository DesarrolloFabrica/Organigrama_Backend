# IT_SYSTEMS Specialty Foundation V1

Catálogo unificado: **1.11.0** (`IT_SYSTEMS` specialties **1.0.0**).  
Evidencia principal: Bairon Cubillos **1128** (primary 0.88) + Diego Gutiérrez **1228** (secondary 0.80).  
Controles negativos (no reprocesados): Samary 1203, Karolina 1315, Daniel 1108.

## Diagnóstico aprobado

`IT_SYSTEMS` → `FOUNDATION_REQUIRED`  
LEGAL no se implementa: ver `docs/mc1-legal-domain-debt.md`. Edwar 1126 permanece `PRIMARY_TAXONOMY_PENDING`.

## Specialties V1

| code | nombre | evidencia recurrente | personas | frontera |
|---|---|---|---|---|
| `NETWORK_INFRASTRUCTURE` | Infraestructura de red | LAN/WAN/VPN/wireless, routers/switches, redes/telecom | 1128, 1228 | ≠ título telecom; ≠ M365/VPN de usuario |
| `IT_SERVICE_DESK` | Mesa de ayuda y soporte TI | mesa de ayuda/ANS, soporte infra/continuidad, incidentes | 1128, 1228 | ≠ GLPI solo; ≠ CS PQRS; ≠ M365/Git |
| `SYSTEMS_ADMINISTRATION` | Administración de sistemas | servidores, OS, AD, virtualización, mtto preventivo/correctivo | 1128, 1228 | ≠ diplomado SQL; ≠ Power BI/low-code; ≠ SE |
| `IT_SECURITY_OPERATIONS` | Seguridad operativa de TI | perímetro/firewalls, parches, backups (fuerte 1128; adyacente 1228) | 1128 (+1228 débil) | ≠ diplomado infosec; ≠ IAM conocimiento; WEAK permitido |

No specialties para: títulos; Git/M365; Power BI; Azure Data; GLPI solo; IAM sin práctica; herramientas aisladas.

## Radar (7)

`IT_NETWORKING` · `IT_SERVICE_DESK` · `IT_SYSADMIN` · `IT_SECURITY_OPS` · `IT_ENDPOINTS_ASSETS` · `IT_AVAILABILITY_CONTINUITY` · `IT_VENDOR_SLA`

Invariantes: tools ≠ práctica; educación ≠ experiencia; keyword aislada no activa; cobertura>0 requiere skills; IT ≠ SE ≠ DA.

## Fronteras

- IT Systems ≠ Software Engineering
- IT Systems ≠ Data Analytics
- tool usage ≠ IT practice

## Validación post-implementación (P3→P4→Gate→Profile)

Corrida: `scripts/mc1-it-systems-complete.ts` — solo 1128 y 1228. Reutiliza P0–R1.

| Persona | Before | P3 IT_SYSTEMS | Gate | Profile tab |
|---|---|---|---|---|
| Bairon 1128 | PRIMARY_TAXONOMY_PENDING · IT skipped | OBSERVED ×4 (NETWORK, SERVICE_DESK, SYSADMIN, SECURITY_OPS) | `PRIMARY_WITH_OBSERVED_SPECIALTY` · taxonomyPending=false · 6 skills | sí · radar 5 ejes >0 |
| Diego 1228 | DA primary PUBLISHABLE · IT secondary PROVENANCE_ONLY (no catalog) | OBSERVED `IT_SERVICE_DESK` · WEAK `NETWORK_INFRASTRUCTURE` (no publicado) | `SECONDARY_WITH_OBSERVED_SPECIALTY` · taxonomyPending=false · 1 skill | DA primary intacto + IT secondary |

PPM/ED de Bairon: solo WEAK → no tabs. DA de Diego: BI + DATA_ENGINEERING intactos.

**Veredicto:** `IT_SYSTEMS_OPERATIONAL_VALIDATED`

Controles negativos no reprocesados: Samary 1203 (GLPI/tools), Karolina 1315 (IAM knowledge 0.25), Daniel 1108 (R1 drop IT). LEGAL/Edwar 1126 intacto.
