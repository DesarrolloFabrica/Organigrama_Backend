# MC1 — Golden Profile: Ingrid Juliana Vargas Beltrán

**Fecha:** 2026-07-29 / 2026-07-30  
**Documento:** `******9945` · `person_id=1145` · `person_cv_id=192` (activo)  
**Objetivo:** primer perfil de punta a punta (dominio → skills → import → PA2 → radar/FE)  
**Alcance:** solo Ingrid. Sin Gemini. Sin taxonomía definitiva de especialidades.

---

## 1. Veredicto

| Criterio | Estado |
| -------- | ------ |
| Dominio profesional visible | **OK** — `OPERATIONS_MANAGEMENT` / PRIMARY_MATCH |
| Radar funcional | **OK** — 1 eje scaffold `OPS_GENERAL` (ACTIVE) |
| Competencias | **OK** — 20+ skills profesionales/metodológicas evidenciadas |
| Herramientas | **OK** — `Sistema SINU`, `Zoho CRM` mapeadas |
| Evidencias | **OK** — enrichment + evidence evaluation activos |
| Sin “en proceso de clasificación” | **OK** — `evaluatedDomains` no vacío |

Artefactos de ejecución:

- Fixture: `src/database/scripts/fixtures/mc1-curated-profile.operations-ingrid.json`
- Dry-run: `tmp/mc1-golden-ingrid-dryrun.json`
- Execute: `tmp/mc1-golden-ingrid-execute.json`

---

## 2. Estrategia de especialidades (temporal)

PA2, el importer y el radar **exigen ≥1 especialidad** en catálogo.  
La petición de esta iteración era **no definir taxonomía definitiva**.

**Decisión:** crear un único contenedor scaffold:

| Código | Nombre | Rol |
| ------ | ------ | --- |
| `OPS_GENERAL` | Gestión de operaciones (scaffold) | Agrupa todas las skills del dominio para PA2/radar |

**No es taxonomía definitiva.** Se reemplazará cuando existan suficientes perfiles para descubrir agrupaciones naturales (`OPS_ACADEMIC`, etc., según `docs/mc1-operations-management-v1-review.md`).

El FE, si no tiene labels cortos para OPS, usa el nombre de especialidad y orden por rank (fallback existente). **No se modificó el frontend.**

---

## 3. Dominio creado

| Campo | Valor |
| ----- | ----- |
| Código | `OPERATIONS_MANAGEMENT` |
| Nombre | Gestión de Operaciones |
| Catálogo | `mc1.9-operations-golden-2026-07-29` (ACTIVE, id=4) |
| Especialidad scaffold | `OPS_GENERAL` (id specialty=50) |
| Pack | `operations-management-mappings@1.0.0` |
| PA2 | `pa2-operations-management-1.0.0` |

También se reseederon mappings de SOFTWARE / VISUAL_DESIGN / AUDIOVISUAL_PRODUCTION sobre el catálogo nuevo (necesario al activar nueva versión).

---

## 4. Skills reutilizadas

| Skill | Tipo | `skill_id` | Notas |
| ----- | ---- | ---------- | ----- |
| Registro y Control Académico | PROFESSIONAL_KNOWLEDGE | 1275 | |
| Gestión de requerimientos | PROFESSIONAL_KNOWLEDGE | 1091 | También mapeada en SOFTWARE ENG (multi-dominio) |
| Sistema SINU | TOOL | 260 | |
| Automatización de procesos | PROFESSIONAL_KNOWLEDGE | 1093 | Tipo explícito (había AMBIGUOUS) |
| Mejora Continua | METHODOLOGY | 222 | Tipo explícito |
| Optimización de procesos | METHODOLOGY | 216 | Tipo explícito |
| Zoho CRM | TOOL | 833 | Vía canónica (no `crm_zoho`) |

---

## 5. Skills nuevas

Creadas en seed de mappings OPS (antes del import; el import las reutilizó):

1. Gestión de operaciones académicas  
2. Homologaciones académicas  
3. Equivalencias académicas  
4. Gestión de casos académicos  
5. Gestión de SLA  
6. Análisis de indicadores de gestión  
7. Elaboración de informes de gestión  
8. Gestión de certificaciones  
9. Cierre de periodos académicos  
10. Gestión de procesos  
11. Trazabilidad de casos  
12. Gestión de historias académicas  
13. Gestión de notas  
14. Aplicación de normatividad académica  
15. Capacitación de usuarios  

**Total pack OPS:** 22 DOMAIN_SPECIALTY + 1 TRANSVERSAL (`liderazgo_de_equipos`) + 1 OUTSIDE (`microsoft_office`) = 24 clasificaciones.

---

## 6. Aliases utilizados

| Alias | Canónica | Acción |
| ----- | -------- | ------ |
| `crm_zoho` → “CRM Zoho” | `zoho_crm` / Zoho CRM (id 833) | Insertado en `cv_skill_alias` |

En el JSON curado se usó el nombre canónico **Zoho CRM** (`REUSE_EXISTING`).

---

## 7. Relaciones creadas

```text
OPERATIONS_MANAGEMENT
└── OPS_GENERAL (scaffold)
      ├── 22 skills DOMAIN_SPECIALTY → PRIMARY mapping
      ├── liderazgo_de_equipos → TRANSVERSAL_FUTURE (sin mapping)
      └── microsoft_office → OUTSIDE (sin mapping)
```

Persona:

```text
person 1145
 └─ person_cv 192 (activo)
     └─ extraction 236 (manual-curated, activa)
         ├─ enrichment 53
         ├─ evidence 53
         └─ mc_profile_evaluation 74
              domain=OPERATIONS_MANAGEMENT
              qualification=PRIMARY_MATCH
              specialty OPS_GENERAL → ACTIVE
              coverage≈0.91 · mapped=22 · evidenced=20
```

---

## 8. Resultado del importer

```text
mode=EXECUTE  outcome=EXECUTED  verified=true
person=******9945 personId=1145 cv=192
domain=OPERATIONS_MANAGEMENT EXISTING
skills existing=22  create=0  (nuevas ya creadas en seed mappings)
extraction=236 enrichment=53 evidence=53 pa2=74
```

Warnings esperados: `IMPORT_SKILL_ALREADY_EXISTS` en skills marcadas `APPROVED_FOR_CREATION` que el seed ya había materializado.

---

## 9. Resultado de PA2

| Campo | Valor |
| ----- | ----- |
| evaluation_id | 74 |
| rules | `pa2-operations-management-1.0.0` |
| pack | `operations-management-mappings@1.0.0` |
| status | SUCCEEDED / is_active |
| default specialty | OPS_GENERAL |
| presentation | **ACTIVE** |
| domain_qualification | **PRIMARY_MATCH** |
| coverage | 0.9091 |
| strength | 40 |
| confidence | 0.776 |
| mapped / evidenced | 22 / 20 |

---

## 10. Resultado del radar / FE (sin cambios de UI)

Validación por reglas de publicación (`filterPublishableDomains` / `deriveDomainQualification`):

| Check | Resultado |
| ----- | --------- |
| Extracción activa | 236 |
| Dominios publicables | `OPERATIONS_MANAGEMENT` PRIMARY_MATCH |
| Expectativa FE | **DOMAIN_VISIBLE** (no “en proceso de clasificación”) |
| Ejes radar | 1 (`OPS_GENERAL`) — fallback de orden por rank/code |
| Herramientas en mapping | Sistema SINU, Zoho CRM |

**Nota UX:** el radar se verá con un solo eje hasta que existan especialidades reales. Eso es intencional en esta iteración.

---

## 11. Evidencia funcional

Comandos ejecutados (resumen):

```bash
npm run mc:catalog -- --seed --activate --i-confirm-seed
npm run mc:mappings -- --seed --i-confirm-seed --domain=OPERATIONS_MANAGEMENT
npm run mc:mappings -- --seed --i-confirm-seed --domain=SOFTWARE
npm run mc:mappings -- --seed --i-confirm-seed --domain=VISUAL_DESIGN
npm run mc:mappings -- --seed --i-confirm-seed --domain=AUDIOVISUAL_PRODUCTION

npm run mc:import-curated-profile -- \
  --file=src/database/scripts/fixtures/mc1-curated-profile.operations-ingrid.json \
  --document=1000019945

npm run mc:import-curated-profile -- \
  --file=src/database/scripts/fixtures/mc1-curated-profile.operations-ingrid.json \
  --document=1000019945 --execute --confirm \
  --out=tmp/mc1-golden-ingrid-execute.json
```

Verificación BD: `tmp/mc1-golden-fe-check.js` → `frontendExpectation=DOMAIN_VISIBLE`.

Para validar en UI: abrir ficha de Ingrid (`person_id=1145`) en el Explorador de competencias (backend en `:3000` debe estar con catálogo activo).

---

## 12. Problemas encontrados

1. **Sin especialidades es imposible en el motor actual** → scaffold `OPS_GENERAL` documentado.  
2. **Skills nuevas deben existir antes del seed de mappings** → el seed OPS ahora crea skills faltantes.  
3. **Nueva versión de catálogo invalida mappings del catálogo anterior** → reseed de los 3 dominios legacy.  
4. **Importer no pasaba `rulesVersion` operativo** → ahora resuelve vía `MC_OPERATIVE_DOMAIN_RULES`.  
5. **`domain_qualification` quedaba NULL** → se persistió `PRIMARY_MATCH` (y el importer ahora la escribe post-PA2). Aun con NULL, la API la derivaba de `active_count≥1`.  
6. **`sourceSection: SKILLS` inválido** en fixture → corregido a `OTHER`.  
7. **Tools con evidence NONE** (SINU/Zoho) — no bloquean ACTIVE por companion profesional; aparecen como herramientas mapeadas.

---

## 13. Archivos de código tocados

| Área | Archivos |
| ---- | -------- |
| Catálogo | `mc-catalog.constants.ts`, `mc-catalog.definition-mc12.ts` |
| Pack OPS | `mc-catalog.mapping-operations-management-v100.ts` (nuevo) |
| Registry | `mc-catalog.mapping-registry.ts` |
| PA2 | `mc-pa2.config.ts`, `mc-pa2.algorithm.ts`, `mc-operative-domains.ts` |
| Seed mappings | `mc-catalog.mapping.service.ts` (auto-create skill) |
| Importer | `curated-profile.importer.ts`, `curated-profile.activation.ts` |
| Publish order | `mc-multidomain-profile-publish.ts` |
| Fixture | `fixtures/mc1-curated-profile.operations-ingrid.json` |
| Specs | `mc-catalog.definition.spec.ts`, `mc-catalog.multidomain.spec.ts` |

---

## 14. Próximos pasos

1. Validar visualmente en FE la ficha de Ingrid (dominio, radar de 1 eje, skills, tools, evidencias).  
2. Opcional FE (fuera de esta fase): short labels / eje `OPS_GENERAL` en `radarLabels.ts`.  
3. Incorporar 2–3 perfiles más de operaciones antes de partir `OPS_GENERAL` en especialidades reales.  
4. Decidir frontera multi-dominio de `gestion_de_requerimientos` (SOFTWARE vs OPS).  
5. Sustituir evidencias sintéticas del golden por citas textuales del PDF cuando se curen perfiles siguientes.  
6. Usar este fixture/pack como plantilla del siguiente golden (no procesar más CVs hasta acordar el segundo perfil).

---

*Golden profile operativo. Especialidades definitivas aplazadas a propósito.*
