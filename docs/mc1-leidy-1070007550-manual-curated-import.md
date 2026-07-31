# MC1 — Importación manual curada: Leidy Viviana Bernal León

**Fecha:** 2026-07-30  
**Documento:** `1070007550` · `person_id=1077` · `person_cv_id=182` (activo)  
**Fuente semántica:** ChatGPT (estructura oficial; Cursor no reinterpretó el CV)  
**Extracción Gemini previa:** `217` (conservada inactiva)  
**Objetivo:** dominio `TALENT_MANAGEMENT` con 5 especialidades `TM_*`, PA2, radar de 5 ejes

---

## 1. Veredicto

| Criterio | Estado |
| -------- | ------ |
| Dominio visible | **OK** — `TALENT_MANAGEMENT` / `PRIMARY_MATCH` |
| Especialidades | **OK** — 5 códigos `TM_*` ACTIVE |
| Radar | **OK** — 5 ejes (specialty results) |
| Skills por especialidad | **OK** — 22 skills DOMAIN_SPECIALTY |
| Herramientas fuera del radar | **OK** — 4 OUTSIDE (sin mapping a ejes) |
| Evidencias | **OK** — texts ChatGPT en extracción 237 |
| Sin “en proceso de clasificación” | **OK** — dominio publicable PRIMARY_MATCH |

Artefactos:

- Fixture: `src/database/scripts/fixtures/mc1-curated-profile.talent-leidy.json`
- Dry-run: `tmp/mc1-leidy-dryrun.json`
- Execute: `tmp/mc1-leidy-execute.json`
- Pack: `src/mc-catalog/mc-catalog.mapping-talent-management-v100.ts`

---

## 2. Persona (preflight)

| Campo | Valor |
| ----- | ----- |
| person_id | 1077 |
| document | 1070007550 |
| person_cv_id | 182 (activo, `1070007550.pdf`) |
| Extracción fuente Gemini | 217 (SUCCEEDED → desactivada tras import) |
| Conflicto de integridad | Ninguno |

---

## 3. Catálogo

| Campo | Valor |
| ----- | ----- |
| Versión activa | `mc1.10-talent-2026-07-30` |
| Dominio | `TALENT_MANAGEMENT` — Gestión del Talento |
| Especialidades | `TM_TALENT`, `TM_ORGANIZATIONAL_DEVELOPMENT`, `TM_QUALITY_COMPLIANCE`, `TM_PEOPLE_ANALYTICS`, `TM_STRATEGIC_LEADERSHIP` |
| Pack | `talent-management-mappings@1.0.0` |
| PA2 | `pa2-talent-management-1.0.0` (LEXICOGRAPHIC + anti-tool) |

También se reseederon mappings de SOFTWARE / VISUAL_DESIGN / AUDIOVISUAL_PRODUCTION / OPERATIONS_MANAGEMENT sobre el catálogo nuevo.

---

## 4. Estructura persistida (ChatGPT)

### TM_TALENT — Gestión del Talento
- Selección estratégica  
- Contratación  
- Onboarding  
- Evaluación del desempeño  
- Gestión por competencias (`METHODOLOGY`)

### TM_ORGANIZATIONAL_DEVELOPMENT — Desarrollo Organizacional
- Desarrollo organizacional  
- Planeación estratégica del talento  
- Holocracia (`METHODOLOGY`)

### TM_QUALITY_COMPLIANCE — Calidad y Cumplimiento
- Sistema de Gestión de Calidad (`METHODOLOGY`)  
- ISO 9001 (`METHODOLOGY`)  
- SG-SST  
- Auditoría HSEQ  
- Gestión de riesgos  
- Cumplimiento normativo  

### TM_PEOPLE_ANALYTICS — Analítica del Talento
- Analítica de talento humano  
- Indicadores de gestión  
- Visualización de datos para talento humano  

### TM_STRATEGIC_LEADERSHIP — Dirección Estratégica
- Liderazgo operativo  
- Dirección administrativa  
- Optimización organizacional  
- Acompañamiento a alta dirección  
- Gestión estratégica  

### No creados / no mapeados (corrección ChatGPT)
- Reclutamiento  
- Gestión del cambio  
- Dashboards analíticos / HR Tech / IA aplicada a RRHH **como skills de especialidad**

---

## 5. Skills

- **En import:** 22 EXISTING (materializadas por seed de mappings; `create=0` en importer).  
- Warnings esperados: `IMPORT_SKILL_ALREADY_EXISTS` por `APPROVED_FOR_CREATION` tras seed.  
- Aliases: ninguno requerido en este perfil.  
- Tipos resueltos según instrucción: ISO 9001, Gestión por competencias, Holocracia, SGC → `METHODOLOGY`; SG-SST, HSEQ, riesgos → `PROFESSIONAL_KNOWLEDGE`.

---

## 6. Herramientas (fuera del radar)

Clasificación `OUTSIDE_SOFTWARE_DOMAIN` en pack (sin `mc_skill_specialty_mapping`):

| Skill | Tipo |
| ----- | ---- |
| Dashboards Analíticos | TOOL |
| HR Tech (Sistemas HR Tech) | TOOL |
| Inteligencia Artificial aplicada a RRHH | TECHNOLOGY |
| Herramientas ofimáticas | TOOL |

Adjuntadas a la extracción `237` en categoría `TOOLS_OUTSIDE` para listado FE de herramientas, **sin** mapping a ejes PA2.

---

## 7. Persistencia

| Paso | ID / resultado |
| ---- | -------------- |
| Extracción MANUAL_CURATED | **237** (activa) |
| Extracción Gemini previa | 217 (inactiva; historial conservado) |
| Enrichment sintético | 54 |
| Evidence evaluation | 54 |
| PA2 evaluation | **75** |
| Fingerprint | `801a942a2cfb7f2a39fc822c3acca82036debd1abaa3f7a01d5d5755913cd3d4` |
| Verificación post-import | `verified=true` |
| Idempotencia | Re-execute → `NO_OP` (misma firma activa) |

---

## 8. PA2 / radar

| Campo | Valor |
| ----- | ----- |
| evaluation_id | 75 |
| rules | `pa2-talent-management-1.0.0` |
| status | SUCCEEDED / is_active |
| domain_qualification | **PRIMARY_MATCH** |
| default_specialty_code | `TM_QUALITY_COMPLIANCE` |

Specialty results (5/5 ACTIVE):

| Rank | Código | Coverage | Strength | Mapped / Evidenced |
| ---- | ------ | -------- | -------- | ------------------ |
| 1 | TM_QUALITY_COMPLIANCE | 1.00 | 45.58 | 6 / 6 |
| 2 | TM_TALENT | 1.00 | 40.00 | 5 / 5 |
| 3 | TM_STRATEGIC_LEADERSHIP | 1.00 | 33.00 | 5 / 5 |
| 4 | TM_ORGANIZATIONAL_DEVELOPMENT | 1.00 | 40.00 | 3 / 3 |
| 5 | TM_PEOPLE_ANALYTICS | 1.00 | 40.00 | 3 / 3 |

**Frontend:** sin cambios. Expectativa: dominio “Gestión del Talento” visible, radar con cinco ejes, skills bajo su especialidad, herramientas separadas, sin mensaje de perfil en proceso de clasificación.

---

## 9. Comandos ejecutados

```bash
npm run mc:catalog -- --seed --activate --i-confirm-seed

npm run mc:mappings -- --seed --i-confirm-seed --domain=TALENT_MANAGEMENT
npm run mc:mappings -- --seed --i-confirm-seed --domain=SOFTWARE
npm run mc:mappings -- --seed --i-confirm-seed --domain=VISUAL_DESIGN
npm run mc:mappings -- --seed --i-confirm-seed --domain=AUDIOVISUAL_PRODUCTION
npm run mc:mappings -- --seed --i-confirm-seed --domain=OPERATIONS_MANAGEMENT

npm run mc:import-curated-profile -- \
  --file=src/database/scripts/fixtures/mc1-curated-profile.talent-leidy.json \
  --document=1070007550 \
  --out=tmp/mc1-leidy-dryrun.json

npm run mc:import-curated-profile -- \
  --file=src/database/scripts/fixtures/mc1-curated-profile.talent-leidy.json \
  --document=1070007550 --execute --confirm \
  --out=tmp/mc1-leidy-execute.json
```

---

## 10. Notas

1. No se crearon scaffolds.  
2. No se reorganizó ni reinterpretó la estructura ChatGPT.  
3. Evidencias = textos entregados en la curaduría (sin fusionar ni inventar).  
4. Extracción 217 permanece en historial; la activa es 237 (`manual-curated`).  
5. Re-import con la misma firma es idempotente (`NO_OP`).
