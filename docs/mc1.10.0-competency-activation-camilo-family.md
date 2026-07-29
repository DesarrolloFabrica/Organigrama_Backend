# MC1.10.0 — Competency activation batch — 3 profiles

**Fecha:** 2026-07-28  
**Fase:** Activación de competencias visibles en Organigrama  
**Catálogo activo:** `mc1.8-2026-07-28` (id=3)  
**Script:** `npm run mc:activate-competencies` · `src/database/scripts/mc110-activate-person-competencies.ts`  
**Artefactos:** `tmp/mc110-initial-audit.json` · `tmp/mc110-activate-competencies.json` · `tmp/mc110-api-dump.json`

> **Corrección posterior:** el resumen UX/UI visible en la ficha de Zuany se corrigió en [`mc1.10.1-zuany-professional-summary-consistency.md`](mc1.10.1-zuany-professional-summary-consistency.md) (narrativa FE; evaluation_id **9** reutilizada). Este documento conserva el resultado histórico de activación.

> Principio: cada persona = su propio CV + extracción + evidencia + evaluación.  
> Parentesco, cargo, área o jefe **no** son evidencia MC1.

---

## 1. Auditoría inicial

| Documento | person_id | Nombre | Correo | Cargo (contexto) | Área (contexto) | Activo |
|-----------|-----------|--------|--------|------------------|-----------------|--------|
| 1000518830 | 1 | CAMILO ANDRES QUINTERO VARGAS | camilo_quintero@cun.edu.co | DESARROLLADOR FULLSTACK | FABRICA Y DESARROLLO | Sí |
| 1000372715 | 3 | ZUANY ALEJANDRO ACUÑA VELEZ | zuany_acuna@cun.edu.co | DISEÑADOR UX/UI | FABRICA Y DESARROLLO | Sí |
| 1010247929 | 4 | JOSE ALEJANDRO CAMACHO COBOS | jose_camachoc@cun.edu.co | DISEÑADOR UX/UI | FABRICA Y DESARROLLO | Sí |

Sin duplicados Core por documento.

### Estado de cadena (pre → post)

| Documento | Pre | Post | Notas |
|-----------|-----|------|-------|
| 1000518830 | FULL + eval SOFTWARE en catálogo **mc1.6** (STALE) | FULL + eval **#8** en **mc1.8** | Re-evaluación necesaria |
| 1000372715 | CV 191 activo; ext 4 sobre CV 66 inactivo | cv **191** → ext **218** → enr **24** → ev **24** | Re-extracción justificada (CV activo ≠ extracción) |
| 1010247929 | EXTRACTION_ONLY | cv **65** → ext **5** → enr **23** → ev **23** | Sin persistencia PA2 |

---

## 2. Catálogo vigente

| Campo | Valor |
|-------|-------|
| Versión activa | **mc1.8-2026-07-28** |
| Dominios | SOFTWARE · VISUAL_DESIGN · AUDIOVISUAL_PRODUCTION |
| Mappings activos | SW 48 · Visual 17 · AV 11 |
| Packs PUBLISHED | `software-mappings@mc1.1-camilo-2026-07-27` · `visual-design-mappings@1.1.0` · `audiovisual-production-mappings@1.0.0` |
| PA2 rules usadas | `pa2-software-1.1.0` · `pa2-visual-design-1.1.0` · `pa2-audiovisual-production-1.0.0` |

Los tres dominios están operativos bajo el catálogo activo. No se modificaron hashes ni releases históricos.

---

## 3. Cadenas finales

| Documento | person_cv | extraction | enrichment | evidence | source_hash (pdf) |
|-----------|-----------|------------|------------|----------|-------------------|
| 1000518830 | 187 | 206 | 2 | 3 | `aeee9c55…49d7` |
| 1000372715 | 191 | 218 | 24 | 24 | `00c79260…9e41` |
| 1010247929 | 65 | 5 | 23 | 23 | `5c215c7c…4077` |

---

## 4. Calidad de evidencia

| Persona | STRONG | MOD | WEAK | NONE | Tier | Notas |
|---------|--------|-----|------|------|------|-------|
| Camilo | 6 (1 pro) | 15 (3 pro) | 15 | 23 | **HIGH** | Cadena Software madura |
| Zuany | 0 | 8 | 2 | 15 | **LOW→MEDIUM** (cadena) | React/NestJS/TS/PG/Full Stack MODERATE |
| José | 0 | 4 | 2 | 20 | **MEDIUM** | Diseño gráfico / video / foto MOD; Adobe tools NONE |

Ninguna cadena INSUFFICIENT para bloquear dry-run. José bloqueado en **persistencia** por revisión profesional (ver §7).

---

## 5. Lectura profesional neutral

### Camilo · 1000518830

| Campo | Lectura |
|-------|---------|
| Práctica principal | Desarrollo de software fullstack |
| Nucleares | Backend, ingeniería, datos, IA aplicada |
| Tipo trayectoria | **SPECIALIST** / generalist within software |
| Claridad núcleo | Alta |

### Zuany · 1000372715

| Campo | Lectura |
|-------|---------|
| Práctica principal | Desarrollo fullstack (React, NestJS, TypeScript, PostgreSQL, GCP) |
| Complementarias | Excel, Power BI, Figma listing |
| Tipo | **GENERALIST_WITHIN_DISCIPLINE** (Software) |
| Claridad núcleo | Media-alta tras re-extracción |
| Nota | Cargo UX/UI **ignorado**; evidencia CV = software |

### José · 1010247929

| Campo | Lectura |
|-------|---------|
| Práctica principal | Diseño de piezas gráficas + edición de video + fotografía |
| Complementarias | Tailwind MOD; React/TS WEAK; Adobe tools listing NONE |
| Tipo | **MULTIDISCIPLINARY** / transición diseño↔frontend |
| Claridad núcleo | Media — núcleo creativo; Software FE por Tailwind |
| Disciplinas posibles | Visual (gap mapping `diseno_de_piezas_graficas`≠`diseno_grafico`); AV (EMERGENT); Software (tool FE) |

---

## 6. Dry-run multidominio

| Persona | Dominio | Resultado PA2 | Default | A/E/H | Clase conceptual |
|---------|---------|---------------|---------|-------|------------------|
| Camilo | SOFTWARE | PRIMARY | BACKEND | 5/2/0 | **PRIMARY_MATCH** |
| Camilo | VISUAL | — | — | 0/0/5 | OUTSIDE |
| Camilo | AV | — | — | 0/0/3 | OUTSIDE |
| Zuany | SOFTWARE | PRIMARY | FRONTEND | 2/3/2 | **PRIMARY_MATCH** |
| Zuany | VISUAL | — | — | 0/0/5 | OUTSIDE |
| Zuany | AV | — | — | 0/0/3 | OUTSIDE |
| José | SOFTWARE | PRIMARY | FRONTEND | 1/1/5 | PRIMARY técnico / **BORDERLINE_REVIEW** |
| José | VISUAL | — | — | 0/0/5 | OUTSIDE (gap alias) |
| José | AV | — | — | 0/1/2 | SECONDARY_SIGNAL |

---

## 7. Selección de dominio y persistencia

| Persona | Decisión | Dominio | evaluation_id | Motivo |
|---------|----------|---------|---------------|--------|
| Camilo | **APPROVED_FOR_PERSISTENCE** | SOFTWARE | **8** (SEEDED) | PRIMARY claro; catálogo mc1.8; desactiva hist. #4 (mc1.6) |
| Zuany | **APPROVED_FOR_PERSISTENCE** | SOFTWARE | **9** (SEEDED) | React/NestJS/TS/PG evidentes |
| José | **BORDERLINE_REVIEW_REQUIRED** | — | no persistido | Núcleo diseño/AV; FE por Tailwind; Visual OUTSIDE por alias; no forzar Software |

Históricos preservados (Camilo #1, #2, #4 inactivas).

---

## 8. API (capa de lectura)

**Endpoints:**

- `GET /api/org-chart/person/:personId/competencies`
- `GET /api/org-chart/person/:personId/competencies/domains/:domainCode`
- `GET /…/specialties/:specialtyCode`

**Service:** `OrgChartCompetenciesService` — solo lee evaluaciones activas; filtra HIDDEN salvo `includeHidden=true`.

| person_id | Status | evaluation_id | domain | specialties visibles |
|-----------|--------|---------------|--------|----------------------|
| 1 | AVAILABLE | 8 | SOFTWARE | 5 ACTIVE + 2 EMERGENT (sin HIDDEN) |
| 3 | AVAILABLE | 9 | SOFTWARE | 2 ACTIVE + 3 EMERGENT |
| 4 | NOT_EVALUATED | — | — | respuesta válida, no 500 |

---

## 9. Frontend

- Feature: `features/competencies` · `CompetenciesExplorer` · hooks `useOrgPersonCompetencies*`
- Consume endpoints correctos por `personId`
- Filtra HIDDEN en cliente (`visibleSpecialties`)
- Soporta dominio dinámico (no hardcode SOFTWARE en lectura)
- Maneja `NOT_EVALUATED` / `STALE` / `AVAILABLE`
- **Sin cambios de UI** en esta fase

Estado esperado en ficha:

| Documento | Frontend |
|-----------|----------|
| 1000518830 | **VISIBLE** (eval 8) |
| 1000372715 | **VISIBLE** (eval 9) |
| 1010247929 | empty state / NOT_EVALUATED (correcto) |

---

## 10. Tabla funcional

| Documento | Cadena | Dominio | Evaluación | API | Frontend | Estado final |
|-----------|--------|---------|------------|-----|----------|--------------|
| 1000518830 | FULL | SOFTWARE | #8 | AVAILABLE | puede renderizar | **VISIBLE** |
| 1000372715 | FULL | SOFTWARE | #9 | AVAILABLE | puede renderizar | **VISIBLE** |
| 1010247929 | FULL | — | no | NOT_EVALUATED | empty | **NO_PRIMARY_MATCH** / BORDERLINE |

---

## 11. Pruebas y builds

| Check | Resultado |
|-------|-----------|
| `npm test -- --testPathPatterns="mc-catalog\|org-chart-competencies\|mc-pa2"` | **110 passed** |
| Backend `npm run build` | **PASS** |
| Frontend build | **no modificado** |
| Regresiones | **no** |

---

## 12. Errores / bloqueos

1. **Zuany:** extracción 4 ligada a CV inactivo 66 → re-extracción 218 sobre CV 191 (causa demostrada).  
2. **Camilo:** evaluación #4 en catálogo inactivo → STALE en API → re-seed #8 en mc1.8.  
3. **José:** no persistido — revisión borderline (diseño vs FE tool-led; gap Visual alias).

---

## 13. Resumen ejecutivo

| Métrica | Valor |
|---------|-------|
| Evaluaciones reutilizadas (ALREADY_EXISTS) | **0** |
| Evaluaciones creadas (SEEDED) | **2** (#8, #9) |
| Personas sin match persistido | **1** (José) |
| Persistencia dominio | solo PRIMARY_MATCH aprobados |
| Parentesco usado | **no** |

**Veredicto:** **GO CON AJUSTES** — flujo CV→ficha operativo para PRIMARY_MATCH; José queda documentado sin forzar dominio.

---

**Documento:** MC1.10.0 · Competency activation batch — 3 profiles · 2026-07-28
