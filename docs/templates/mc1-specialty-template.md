# Plantilla — Especialidad MC1

**Versión:** MC1.8.A · 2026-07-28  
**Normativa:** [`mc1-specialty-blueprint.md`](../mc1-specialty-blueprint.md)  
**Dominio padre:** `{{DOMAIN_CODE}}` — {{DOMAIN_NAME}}

> Copiar a sección del Domain Guide o a `docs/specialties/{{DOMAIN_CODE}}/{{SPECIALTY_CODE}}.md`  
> Completar campos **(obligatorio)** antes de promover madurez.

---

## Metadatos **(obligatorio)**

| Campo | Valor |
|-------|-------|
| `SPECIALTY_CODE` | {{SPECIALTY_CODE}} |
| Nombre | {{SPECIALTY_NAME}} |
| Dominio | `{{DOMAIN_CODE}}` |
| Estado madurez | {{HYPOTHESIS \| RESERVED \| EMERGENT \| SUPPORTED \| STABLE \| CONSOLIDATED \| DEPRECATED \| RETIRED}} |
| Versión documental | {{VERSION}} |
| Última revisión | {{DATE}} |
| Autor / fase | {{AUTHOR}} |

---

## 1. Definición **(obligatorio)**

### 1.1 Qué es

{{DEFINITION_2_4_SENTENCES}}

### 1.2 Qué no es

| No es | Por qué |
|-------|---------|
| {{ANTI_PATTERN_1}} | {{REASON}} |
| {{ANTI_PATTERN_2}} | {{REASON}} |

### 1.3 Propósito profesional **(obligatorio)**

{{WHY_THIS_SPECIALTY_EXISTS}}

### 1.4 Alcance **(obligatorio)**

**Incluye:** {{IN_SCOPE_BULLETS}}

**Excluye:** {{OUT_OF_SCOPE_BULLETS}}

---

## 2. Competencias **(obligatorio desde SUPPORTED)**

### 2.1 Skills nucleares (CORE)

| Skill (forma CV / canónica) | Tipo | Rol esperado en mapping |
|------------------------------|------|-------------------------|
| {{CORE_SKILL_1}} | PROFESSIONAL | PRIMARY |
| {{CORE_SKILL_2}} | PROFESSIONAL | PRIMARY / SUPPORTING |

### 2.2 Skills complementarias (SUPPORTING)

- {{SUPPORTING_1}}
- {{SUPPORTING_2}}

### 2.3 Tools asociadas (no nucleares)

| Tool | Uso en especialidad | Peso máximo esperado |
|------|---------------------|----------------------|
| {{TOOL_1}} | {{USAGE}} | {{WEIGHT_HINT}} |

### 2.4 Methodologies / transversales

| Item | Clasificación | ¿Mapea? |
|------|---------------|---------|
| {{ITEM}} | METHOD / TRANSVERSAL | Sí / No |

---

## 3. Vocabulario y mappings

### 3.1 Skills canónicas (pack vigente)

| key | Tipo | Rol | Versión pack |
|-----|------|-----|--------------|
| `{{SKILL_KEY}}` | {{TYPE}} | {{MAPPING_ROLE}} | {{PACK_VERSION}} |

### 3.2 Aliases

| Formulación en CV | → Canónica | Estado |
|-------------------|------------|--------|
| {{CV_FORM}} | `{{CANONICAL_KEY}}` | {{PROPOSED \| ACTIVE \| REJECTED}} |

### 3.3 Mappings pendientes / vacíos

| Skill encontrada | Frecuencia corpus | Acción propuesta |
|------------------|-------------------|------------------|
| {{FOUND}} | {{COUNT}} | {{ACTION}} |

---

## 4. Evidencia **(obligatorio)**

### 4.1 Evidencias esperadas (sustantivas)

- {{EXPECTED_EVIDENCE_1}}
- {{EXPECTED_EVIDENCE_2}}

### 4.2 Evidencias insuficientes

| Señal | Por qué insuficiente |
|-------|---------------------|
| {{INSUFFICIENT_1}} | {{REASON}} |
| Solo listing de tool | Anti-tool; no activa especialidad |

### 4.3 Ejemplos en corpus

| Perfil / ref | Señal CV | Nivel EE | Resultado PA2 esperado |
|--------------|----------|----------|------------------------|
| {{REF}} | {{SIGNAL}} | {{LEVEL}} | {{ACTIVE \| EMERGENT \| HIDDEN}} |

---

## 5. Fronteras **(obligatorio antes de STABLE)**

### 5.1 Fronteras con dominios vecinos

| Dominio vecino | Pertenece | No pertenece | Zona gris | Regla |
|----------------|-----------|--------------|-----------|-------|
| {{NEIGHBOR}} | {{YES}} | {{NO}} | {{GRAY}} | {{RULE}} |

### 5.2 Fronteras con especialidades del mismo dominio

#### {{SPECIALTY_CODE}} ↔ {{SIBLING_CODE}}

| Pertenece a {{SPECIALTY_CODE}} | No pertenece | Zona gris |
|-------------------------------|--------------|-----------|
| {{YES}} | {{NO}} | {{GRAY}} |

**Regla:** {{RULE}}

---

## 6. Riesgos y casos ambiguos

### 6.1 Falsos positivos comunes

| Caso | Causa | Mitigación |
|------|-------|------------|
| {{FP_CASE}} | {{CAUSE}} | {{MITIGATION}} |

### 6.2 Falsos negativos comunes

| Caso | Causa | Mitigación |
|------|-------|------------|
| {{FN_CASE}} | {{CAUSE}} | {{MITIGATION}} |

### 6.3 Relación con otras especialidades

| Especialidad | Relación | Notas |
|--------------|----------|-------|
| {{OTHER_CODE}} | Complementa / Compite / Solapa | {{NOTES}} |

---

## 7. Madurez y roadmap

### 7.1 Estado actual

**{{MATURITY_STATE}}** — {{JUSTIFICATION}}

### 7.2 Criterios de salida al siguiente estado

| Criterio | Estado |
|----------|--------|
| {{GATE_CRITERION_1}} | ☐ |
| {{GATE_CRITERION_2}} | ☐ |

### 7.3 Próximo hito

{{NEXT_MILESTONE}}

---

## 8. Gobernanza

### 8.1 Historial de decisiones

| Fecha | Versión | Decisión | Motivo | Referencia |
|-------|---------|----------|--------|------------|
| {{DATE}} | {{VER}} | {{DECISION}} | {{REASON}} | {{DOC_LINK}} |

### 8.2 Versionamiento

| Cambio | Tipo (patch/minor/major) | Pack / catálogo |
|--------|--------------------------|-----------------|
| {{CHANGE}} | {{TYPE}} | {{VERSION}} |

---

## 9. Checklist rápido pre-promoción

| ¿Listo para {{TARGET_STATE}}? | Sí / No |
|-------------------------------|---------|
| Definición falsable | |
| ≥1 CORE con evidencia MODERATE+ en corpus | |
| Fronteras con ≥1 vecina documentadas | |
| Sin dependencia exclusiva de tools | |
| FP/FN revisados | |

---

**Plantilla:** MC1.8.A · [`mc1-specialty-template.md`](mc1-specialty-template.md)
