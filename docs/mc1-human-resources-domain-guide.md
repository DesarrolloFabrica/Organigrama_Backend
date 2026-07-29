# Guía del dominio — Gestión Humana (HUMAN_RESOURCES)

**Versión documental:** MC1.9.2 · 2026-07-28  
**Estado del dominio:** **DISCOVERED**  
**Recomendación de avance:** no PROTOTYPE_READY todavía (ver MC1.9.2)  
**Pack vigente:** *(pendiente — no implementado)*  
**PA2 vigente:** *(pendiente — no implementado)*  
**Blueprint:** [`mc1-domain-blueprint.md`](mc1-domain-blueprint.md) · [`mc1-manifesto.md`](mc1-manifesto.md)

**Corpus de evidencia:**  
- Semilla: Leidy Viviana Bernal León (`1070007550`, ext **217** / enr **15** / ev **15**)  
- Validación R1: [`mc1.9.2-human-resources-validation-round1.md`](mc1.9.2-human-resources-validation-round1.md)  
- Discovery candidatos: [`mc1.9.1-human-resources-candidate-discovery.md`](mc1.9.1-human-resources-candidate-discovery.md)  
- Semilla: [`mc1.9.0-profile-1070007550-discovery.md`](mc1.9.0-profile-1070007550-discovery.md)

> Dominio descubierto por exploración transversal evidence-first. **No** forzar desde cargo Cloud. **No** construir el dominio solo alrededor de Leidy.

---

## 0. Metadatos **(obligatorio)**

| Campo | Valor |
|-------|-------|
| `DOMAIN_CODE` | `HUMAN_RESOURCES` |
| Nombre | Gestión Humana |
| `MC_CATALOG_VERSION` | *(no sembrado)* |
| Estado madurez dominio | **DISCOVERED** |
| Autor / fase | MC1.9.2 · Validation Round 1 |
| Última revisión | 2026-07-28 |

---

## 1. Propósito del dominio **(obligatorio)**

### 1.1 Qué es

**Gestión Humana** es la práctica de **atraer, incorporar, desarrollar, evaluar, administrar (incl. nómina cuando aplique) y retener colaboradores**, y de **diseñar sistemas de personas** (competencias, cultura, desarrollo organizacional) cuando la evidencia muestra **aplicación profesional sobre el ciclo de vida del colaborador**.

### 1.2 Qué no es

| No es | Por qué |
|-------|---------|
| Un cargo o área Cloud | El cargo puede diferir del núcleo CV (Leidy, Yuri). |
| Calidad / HSEQ como disciplina | ISO/auditoría/OHSAS sin ciclo de talento (Daniel OUTSIDE). |
| SG-SST automático | Puede ser frontera compartida o disciplina HSEQ (Leidy STRONG ≠ auto-inclusión). |
| Pedagogía / evaluación educativa | Lina: instrumentos/psicometría; talento NONE. |
| Operación académica genérica | Capacitación de equipos no basta (Yuri). |
| Software / BI / dashboards | Camilo; tools ≠ People Analytics. |
| Listado de skills de reclutamiento | Laura: listing WEAK/NONE — no MATCH. |
| Solo soft skills | Liderazgo/empatía sin contexto TH. |

### 1.3 Pregunta rectora

> ¿Qué representa realmente Gestión Humana en los CV de la organización?

**Respuesta consolidada (v0.2 · MC1.9.2):** ciclo de vida del talento y dirección de personas con evidencia aplicada. La ronda 1 confirma **un MATCH adicional híbrido** (Alberto), **fronteras** útiles (Lina, Yuri), **OUTSIDE** claros (Daniel, Camilo) y **COMPLEMENTARY** nómina (María José). **No** confirma a Laura como MATCH. La definición **requiere ajustes** antes de prototipo (reducir peso SST/ISO de la semilla).

---

## 2. Objetivo en MC1 **(obligatorio)**

Cerrar el gap de perfiles con práctica profesional de personas fuera de SOFTWARE / VISUAL / AUDIOVISUAL. Permitir, en fases futuras, evaluar especialidades de talento y DO con anti-tool y fronteras HSEQ/DI/ops.

---

## 3. Especialidades — fichas técnicas **(obligatorio)**

> Sin mappings. Madurez máxima en esta fase: **SUPPORTED** (documental). No STABLE/CONSOLIDATED.

### 3.1 HR_TALENT — Gestión del talento

**Definición:** planificar y operar el ciclo de vida del colaborador (atracción, selección, inducción, desempeño, desarrollo, cultura/bienestar asociados).

**Estado:** **SUPPORTED** (recomendación documental MC1.9.2) · **REFINE** (no split prematuro; procesos = skills).

**Evidencia:** Leidy (TH MODERATE); Alberto (dirección TH, selección, cultura MODERATE). Laura **no** aporta (listing).

### 3.2 HR_ORG_DEVELOPMENT — Desarrollo organizacional

**Estado:** **EMERGENT** · evidencia parcial (DO Leidy; cultura Alberto; cambio Yuri).

### 3.3 HR_SST — SG-SST

**Estado:** **RESERVED** · **MOVE_TO_BOUNDARY**. No clasificar SST como HR automáticamente.

### 3.4 HR_QUALITY_SYSTEMS

**Estado:** **DEPRECATED** dentro de HR · **REMOVE** del núcleo. Disciplina Quality/HSEQ.

### 3.5 HR_PEOPLE_ANALYTICS

**Estado:** **HYPOTHESIS**. Sin KPIs de personas reales; tools no activan.

### 3.6 Administración de personal y nómina *(conceptual, sin código)*

**Estado:** **EMERGENT** · COMPLEMENTARY (María José). Posible agrupación compensación + admin laboral.

---

## 4. Vocabulario (candidatos)

Ver inventario MC1.9.2 §11. Solo **CANDIDATE**; sin aliases ni pack.

---

## 5. Fronteras **(obligatorio)**

| Dominio / disciplina | Relación |
|----------------------|----------|
| SOFTWARE | **NO PERTENECE** (Camilo) |
| VISUAL / AUDIOVISUAL | **NO PERTENECE** |
| Operación académica | **ZONA GRIS** (Yuri) |
| Calidad / HSEQ | **NO PERTENECE** como núcleo (Daniel); frontera SST |
| Diseño instruccional / pedagogía | **ZONA GRIS** (Lina) |
| Nómina / admin de personal | **COMPLEMENTARY** |
| People Analytics / BI | **NO** por tools |

---

## 6. Corpus

| Perfil | Rol | Clasificación R1 | Cadena |
|--------|-----|------------------|--------|
| Leidy `1070007550` | Semilla | **MATCH** | FULL 217/15/15 |
| Alberto `1082955522` | Validación | **MATCH** (híbrido) | FULL 204/17/17 |
| Laura `1000120580` | Validación | **INSUFFICIENT** | FULL 8/16/16 |
| Lina `1233497340` | Frontera | **BORDERLINE** | FULL 137/18/18 |
| Yuri `1013588273` | Frontera | **BORDERLINE** | FULL 55/19/19 |
| Daniel `1020749844` | Negativo | **OUTSIDE** HSEQ | FULL 31/20/20 |
| María J. Algarín `1068658455` | Complemento | **COMPLEMENTARY** | FULL 166/21/21 |
| Camilo `1000518830` | Negativo técnico | **OUTSIDE** Software | FULL (previa) |

---

## 7. Roadmap

| Fase | Contenido |
|------|-----------|
| DISCOVERED (MC1.9.0) | Semilla Leidy |
| Candidate Discovery (MC1.9.1) | Finalistas léxico+profesional |
| Validation R1 (MC1.9.2) | 6 cadenas + clasificación evidencia |
| MC1.9.3 (sugerido) | +1 MATCH puro; definición v0.2 |
| Prototype | Catálogo + pack + PA2 (**no aún**) |

---

## 8. Veredicto de madurez

**Estado:** **DISCOVERED**  
**Veredicto R1:** **GO CON AJUSTES** — hipótesis válida; no prototipo todavía.

---

**Guía:** MC1.9.2 · Gestión Humana · DISCOVERED · 2026-07-28
