# Guía del dominio — {{DOMAIN_NAME}} ({{DOMAIN_CODE}})

**Versión documental:** MC1.{{PHASE}} · {{DATE}}  
**Estado del dominio:** {{MATURITY_STATE}}  
**Pack vigente:** `{{PACK_CODE}}@{{PACK_VERSION}}`  
**PA2 vigente:** `{{PA2_RULES_VERSION}}`  
**Blueprint:** [`mc1-domain-blueprint.md`](../mc1-domain-blueprint.md)

**Corpus de evidencia:** {{LIST_PROFILE_IDS_OR_ANONYMIZED_REFS}}  
**Artefactos:** {{PATHS_TO_DRYRUNS_AND_REPORTS}}

> Copiar este archivo a `docs/mc1-{{SLUG}}-domain-guide.md` al iniciar Knowledge Expansion.  
> Completar todas las secciones marcadas **(obligatorio)** antes de declarar CONSOLIDATED.

---

## 0. Metadatos **(obligatorio)**

| Campo | Valor |
|-------|-------|
| `DOMAIN_CODE` | {{DOMAIN_CODE}} |
| Nombre | {{DOMAIN_NAME}} |
| `MC_CATALOG_VERSION` | {{CATALOG_VERSION}} |
| Estado madurez dominio | {{MATURITY_STATE}} |
| Autor / fase | {{AUTHOR}} |
| Última revisión | {{DATE}} |

---

## 1. Propósito del dominio **(obligatorio)**

### 1.1 Qué es

{{DEFINITION_2_4_SENTENCES}}

### 1.2 Qué no es

| No es | Por qué |
|-------|---------|
| {{ANTI_PATTERN_1}} | {{REASON}} |
| {{ANTI_PATTERN_2}} | {{REASON}} |
| {{ANTI_PATTERN_3}} | {{REASON}} |

### 1.3 Pregunta rectora

> ¿Qué representa realmente {{DOMAIN_NAME}} en los CV de {{ORG_CONTEXT}}?

**Respuesta consolidada:** {{SYNTHESIS_PARAGRAPH}}

---

## 2. Objetivo en MC1 **(obligatorio)**

{{WHY_THIS_DOMAIN_EXISTS_IN_MC1}}

---

## 3. Especialidades — fichas técnicas **(obligatorio)**

Repetir bloque §3.x por cada especialidad ACTIVE en catálogo.

### 3.{{N}} {{SPECIALTY_CODE}} — {{SPECIALTY_NAME}}

#### Definición profesional

{{PROFESSIONAL_DEFINITION}}

#### Competencias nucleares

- {{CORE_1}}
- {{CORE_2}}

#### Competencias accesorias

- {{ACCESSORY_1}}

#### Skills canónicas (pack vigente)

| key | Tipo | Rol en especialidad |
|-----|------|---------------------|
| `{{SKILL_KEY}}` | {{TYPE}} | {{MAPPING_ROLE}} |

#### Aliases propuestos / vigentes

| Formulación en CV | → Canónica | Estado |
|-------------------|------------|--------|
| {{CV_FORM}} | `{{CANONICAL_KEY}}` | {{PROPOSED\|ACTIVE\|REJECTED}} |

#### Herramientas asociadas

{{TOOLS_LIST}}

#### Skills que NO pertenecen

- {{EXCLUDED_SKILL}} — {{REASON}}

#### Ejemplos reales (corpus)

| Señal en CV | Evidencia EE | Efecto PA2 |
|-------------|--------------|------------|
| {{SIGNAL}} | {{LEVEL}} | {{PA2_STATE}} |

#### Nivel de madurez especialidad

**{{RESERVED \| DRAFT \| OPERATIONAL \| CONSOLIDATED \| CANDIDATE_REMOVE}}** — {{JUSTIFICATION}}

---

## 4. Matriz de vocabulario del dominio **(obligatorio)**

Clasificación: **PROFESSIONAL** · **TOOL** · **TRANSVERSAL** · **NO PERTENECE**

### 4.1 Skills con key canónica en pack

| Skill encontrada (forma CV) | Skill canónica | Alias | Especialidad | Tipo |
|----------------------------|----------------|-------|--------------|------|
| {{FOUND}} | `{{KEY}}` | {{ALIAS_OR—}} | {{SPECIALTY}} | {{TYPE}} |

### 4.2 Skills recurrentes sin key canónica (vacíos)

| Skill encontrada | Frecuencia corpus | Canónica propuesta | Especialidad | Tipo |
|------------------|-------------------|--------------------|--------------|------|
| {{FOUND}} | {{COUNT}} | `{{PROPOSED_KEY}}` | {{SPECIALTY}} | {{TYPE}} |

---

## 5. Redundancias detectadas **(obligatorio antes de STABLE)**

### 5.1 Aliases / sinónimos no unificados

{{LIST}}

### 5.2 Mappings duplicados

| Skill | Especialidades | Observación |
|-------|----------------|-------------|
| {{KEY}} | {{SPECIALTIES}} | {{NOTE}} |

### 5.3 Herramientas repetidas

{{LIST}}

### 5.4 Skills demasiado amplias / específicas / ambiguas

| Skill | Problema |
|-------|----------|
| {{KEY}} | {{ISSUE}} |

---

## 6. Vacíos del catálogo **(obligatorio)**

| Prioridad | Concepto | Perfiles afectados |
|-----------|----------|-------------------|
| P0 | {{GAP}} | {{PROFILES}} |
| P1 | {{GAP}} | {{PROFILES}} |

---

## 7. Fronteras del dominio **(obligatorio)**

### 7.1 {{DOMAIN_NAME}} ↔ {{NEIGHBOR_DOMAIN_1}}

| Pertenece a {{DOMAIN_CODE}} | No pertenece | Zona gris |
|----------------------------|--------------|-----------|
| {{YES}} | {{NO}} | {{GRAY}} |

**Regla:** {{RULE}}

### 7.2 {{DOMAIN_NAME}} ↔ {{NEIGHBOR_DOMAIN_2}}

_(repetir)_

---

## 8. Casos ambiguos **(obligatorio)**

| Caso | Resolución propuesta |
|------|----------------------|
| {{CASE}} | {{RESOLUTION}} |

---

## 9. Corpus de validación **(obligatorio)**

### 9.1 Persona semilla

| Campo | Valor |
|-------|-------|
| Referencia | {{SEED_REF}} |
| person_id | {{ID}} |
| ext / enr / ev | {{IDS}} |
| source_hash | `{{HASH_PREFIX}}…` |
| Clasificación | MATCH |
| PA2 dry-run | {{SUMMARY_A_E_H}} |

### 9.2 Tabla comparativa PA2 (corpus)

| Perfil | Clasificación conceptual | Default PA2 | A | E | H | Notas |
|--------|--------------------------|-------------|---|---|---|-------|
| {{NAME}} | {{MATCH\|BORDERLINE\|OUTSIDE}} | {{DEFAULT}} | | | | |

### 9.3 Falsos positivos / negativos documentados

| Tipo | Perfil | Causa | Acción |
|------|--------|-------|--------|
| FP | {{}} | {{}} | {{}} |
| FN | {{}} | {{}} | {{}} |

---

## 10. Roadmap del dominio **(obligatorio)**

### 10.1 Por especialidad

| Especialidad | ¿Consolidado? | Próximo hito |
|--------------|---------------|--------------|
| {{CODE}} | {{YES/NO}} | {{MILESTONE}} |

### 10.2 Por versión de pack (conocimiento)

| Versión | Contenido | PA2 |
|---------|-----------|-----|
| {{PACK_VERSION}} | {{CHANGES}} | Sin cambio |

---

## 11. Veredicto y declaración de madurez **(obligatorio al cierre)**

**Estado:** {{MATURITY_STATE}}

### Criterios CONSOLIDATED (ver checklist)

{{CHECKLIST_SUMMARY_OR_LINK}}

### Lista priorizada pendiente

| # | Necesidad | Prioridad |
|---|-----------|-----------|
| 1 | {{ITEM}} | P0 |

---

## 12. Referencias

| Documento | Contenido |
|-----------|-----------|
| `{{PATH}}` | {{DESCRIPTION}} |

---

**Plantilla:** MC1.7.0 · [`mc1-domain-template.md`](mc1-domain-template.md)
