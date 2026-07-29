# MC1.10.1 — Consistencia del resumen profesional · Zuany (1000372715)

**Fecha:** 2026-07-28  
**Persona:** ZUANY ALEJANDRO ACUÑA VELEZ · person_id **3** · documento `1000372715`  
**Relacionado:** [`mc1.10.0-competency-activation-camilo-family.md`](mc1.10.0-competency-activation-camilo-family.md)  
**Script:** `npm run mc:audit-zuany-summary` · `tmp/mc1101-zuany-summary-audit.json`

---

## 1. Síntoma

En la pestaña **Competencias**, bajo el encabezado de área profesional (Software / Frontend), el texto narrativo aún presentaba a Zuany en clave **diseñador UX/UI** / trayectoria hacia **Diseño de Interfaces**, pese a:

- evaluación MC1 activa **SOFTWARE** / default **SOFTWARE_FRONTEND**;
- cadena vigente ext **218** → enr **24** → ev **24** → eval **9**;
- evidencia fullstack (React, NestJS, TypeScript, PostgreSQL, etc.).

---

## 2. Fuente exacta del texto UX/UI

| Campo | Valor |
|-------|-------|
| **Texto exacto** | `DISEÑADOR UX/UI` (cargo Core) |
| **Tabla** | `core.role` vía `core.person.role_id` |
| **Registro** | `person.id=3` · `role_id` → nombre de rol |
| **Campo API** | `CompetencyExplorerSummaryDto.person.role` |
| **Versión** | Rol organizacional vigente (no versionado MC1) |
| **Cadena que lo consume** | `OrgChartCompetenciesService.loadPerson` → `GET …/competencies` → FE `buildTrajectoryNarrative({ roleName: summary.person.role })` → párrafo en `CompetenciesExplorer` |

### Texto inventado por el frontend (antes)

Con `roleIsUi && !primaryIsUi` (Frontend ≠ VISUAL_UI), se generaba:

> «… mayor fortaleza en Desarrollo de Software, especialmente en Frontend. Actualmente se desempeña como DISEÑADOR UX/UI, lo que representa una trayectoria reciente hacia el Diseño de Interfaces.»

Esa frase **no** provenía de extracción, enrichment, evidence ni PA2.

### Señales secundarias en CV (no núcleo)

En extracción **218**: skill/tool **Figma** (complementaria). No hay skill profesional UX/UI dominante.

---

## 3. Causa raíz

**Caso D + E (híbrido):**

1. **E:** El cargo Core sigue siendo `DISEÑADOR UX/UI` (identidad organizacional; no se mutó Core en esta fase).  
2. **D:** El frontend usaba ese cargo como input de narrativa MC1 y, al no ser la especialidad `VISUAL_UI`, **invertía** el relato hacia “trayectoria a Interfaces”, contradiciendo el dominio Software.

La cadena MC1 estaba **correcta y alineada**. No hubo enrichment/evidence desalineados ni evaluation_id 9 sobre fuente vieja.

---

## 4. Matriz de capas (después de auditoría)

| Capa | ID activo | Depende de | Source hash | Resumen profesional | Consistente |
|------|-----------|------------|-------------|---------------------|-------------|
| person_cv | **191** | Drive | md5 Drive | — | Sí |
| extraction | **218** | CV 191 | `00c79260…9e41` | Skills fullstack + Figma | Sí |
| enrichment | **24** | ext 218 | mismo hash | Skills alineadas a 218 | Sí |
| evidence | **24** | enr 24 | — | MODERATE técnicos | Sí |
| evaluation | **9** | 218/24/24 | mismo source | SOFTWARE / FRONTEND | Sí |
| Core role | DISEÑADOR UX/UI | org | — | Cargo org (no MC1) | Separado a propósito |
| FE narrativa | — | person.role | — | **corregida** | Sí post-fix |

---

## 5. Verificación extracción 218 / enrichment / evidence

| Práctica actual | Evidencia |
|-----------------|-----------|
| Fullstack / FE / BE | React, NestJS, TypeScript, PostgreSQL, Full Stack (MODERATE) |
| Cloud | GCP (MODERATE); Cloud ACTIVE en PA2 |
| Complementarias | Figma (listing/histórico); Excel/Power BI |

**UX/UI:** no es núcleo MC1; a lo sumo **complementario/histórico** (Figma + cargo Core).

Enrichment **24** y evidence **24** dependen de **218**. Evaluation **9** usa esa cadena. Dry-run MC1.10.1: SOFTWARE PRIMARY; Visual/AV OUTSIDE.

---

## 6. Corrección realizada

### Código (general, no por person_id)

Archivo: `Organigrama_Frontend/src/features/competencies/utils/trajectoryNarrative.ts`

- La narrativa cargo UX/UI ↔ especialidad **solo** aplica si el dominio MC1 es **VISUAL_DESIGN**.
- En **SOFTWARE** / **AUDIOVISUAL_PRODUCTION** no se inventa “trayectoria hacia Diseño de Interfaces”.
- `CompetenciesExplorer` pasa `domainCode` explícito.

### Semántica en ficha (post-fix)

| Capa | Qué muestra |
|------|-------------|
| Área profesional (MC1) | Desarrollo de Software |
| Especialidad principal | Frontend |
| Especialidades | Cloud ACTIVE; Backend/AI/Data EMERGENT |
| Cargo Core | Sigue existiendo en organigrama/perfil org; **no** redefine el resumen MC1 |
| UX/UI | Complementario/histórico; no identidad dominante MC1 |

### Persistencia

**REUSE evaluation_id 9** — reproducible sobre cadena 218/24/24; sin nueva evaluación.

### Core

No se modificó `core.role` / `core.person` (posible desfase org vs CV; fuera del alcance MC1 salvo decisión de RRHH).

---

## 7. José (1010247929)

Sin cambios. Sigue **NOT_EVALUATED** / sin evaluación persistida (MC1.10.0 borderline). No se crearon mappings Visual.

---

## 8. Pruebas

| Suite | Resultado |
|-------|-----------|
| FE `trajectoryNarrative.spec.ts` | 5 passed (incluye caso Software + cargo UX/UI → null) |
| FE `src/features/competencies` | 37 passed |
| FE `npm run build` | PASS |
| BE `npm run build` | PASS |
| Dry-run PA2 Zuany | SOFTWARE PRIMARY; Visual/AV OUTSIDE |

---

## 9. Riesgos

- Cargo Core desactualizado puede confundir en **otras** pantallas (organigrama/perfil); no en narrativa MC1 post-fix.
- Si en el futuro se desea narrativa “cargo org vs dominio Software”, debe diseñarse explícitamente sin afirmar trayectoria a Interfaces.

---

## 10. Entregable

| Ítem | Valor |
|------|-------|
| Fuente UX/UI | `core.role.name` → API `person.role` → FE `trajectoryNarrative` |
| Causa raíz | Caso D+E: narrativa FE confunde cargo org con identidad MC1 |
| Extracción | **218** alineada a CV 191 |
| Enrichment | **24** alineado a 218 |
| Evidence | **24** alineado a 24 |
| Evaluación | **9** REUSE · SOFTWARE / FRONTEND |
| UX/UI | complementario / histórico (no núcleo) |
| José | sin evaluación |
| Veredicto | **GO** |

---

**Documento:** MC1.10.1 · Zuany professional summary consistency · 2026-07-28
