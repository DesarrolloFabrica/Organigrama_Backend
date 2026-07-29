# MC1.8.A — Specialty Blueprint (metodología oficial)

**Versión:** 1.0 · 2026-07-28  
**Estado:** normativa metodológica  
**Alcance:** creación, maduración, versionamiento, fusión, división, retiro y spin-off de **especialidades** dentro de un dominio MC1  
**No cubre:** implementación técnica, cambios de código, PA2, mappings, pipelines CV

**Documentos relacionados:**

| Documento | Uso |
|-----------|-----|
| [`mc1-domain-blueprint.md`](mc1-domain-blueprint.md) | Ciclo de vida del dominio padre |
| [`templates/mc1-specialty-template.md`](templates/mc1-specialty-template.md) | Ficha por especialidad |
| [`templates/mc1-specialty-validation-checklist.md`](templates/mc1-specialty-validation-checklist.md) | Verificación CONSOLIDATED de especialidad |
| [`mc1-specialty-maturity-assessment.md`](mc1-specialty-maturity-assessment.md) | Evaluación retrospectiva Visual + AV |
| [`templates/mc1-domain-template.md`](templates/mc1-domain-template.md) | Domain Guide (contenedor de especialidades) |

---

## Principio central — evolución continua

**Las especialidades son modelos evolutivos dentro de un dominio.** Pueden madurar **verticalmente** (mejor vocabulario, evidencia, mappings, fronteras) o crecer **horizontalmente** (nueva especialidad, fusión, división, retiro, spin-off a dominio). **Ninguna especialidad se considera definitivamente cerrada**, incluso en estado CONSOLIDATED.

| Tipo | Qué cambia | Ejemplos |
|------|------------|----------|
| **Evolución vertical** | Refinamiento de una especialidad existente | Nuevos aliases; mappings más precisos; fronteras más claras; reducción de FP/FN |
| **Evolución horizontal** | Estructura del dominio | Crear `AV_POST`; fusionar buckets tool-led; retirar `VISUAL_DIGITAL_ASSETS`; spin-off `VISUAL_UI` → dominio UX |

---

## 1. Definición formal de especialidad

### 1.1 Definición normativa

Una **especialidad MC1** es una **subdisciplina operativa** dentro de un dominio: una agrupación **coherente y falsable** de competencias profesionales que describe una **práctica laboral diferenciable**, con vocabulario propio, evidencia observable en CV, mappings hacia skills canónicas, fronteras explícitas y reglas PA2 que permiten evaluarla **de forma independiente** en el radar del dominio.

La especialidad es la **unidad de granularidad** entre el dominio (disciplina amplia) y la skill (átomo de vocabulario).

### 1.2 Qué representa profesionalmente

| Representa | Descripción |
|------------|-------------|
| Un eje de práctica | Subconjunto reconocible de la disciplina (ej. edición de video dentro de Producción Audiovisual). |
| Un contrato de evaluación | “Esta evidencia CV debería contribuir a este eje y producir ACTIVE/EMERGENT/HIDDEN en PA2.” |
| Un paquete de conocimiento | Skills nucleares, tools asociadas, aliases, fronteras intra e inter-dominio. |
| Una hipótesis versionada | Definición que puede refinarse sin reescribir el dominio entero. |

### 1.3 Relación con el dominio

- Toda especialidad **pertenece a exactamente un dominio** en un momento dado (salvo spin-off completado).
- El dominio **agrupa** especialidades; su madurez **depende parcialmente** de la madurez de sus especialidades nucleares.
- El dominio define **fronteras externas**; la especialidad define **fronteras internas** y con vecinos del mismo dominio.

### 1.4 Especialidad vs skill

| Dimensión | Skill | Especialidad |
|-----------|-------|--------------|
| Granularidad | Un competencia o herramienta | Un **conjunto** de skills con práctica común |
| Evaluación PA2 | Aporta peso/evidencia | Recibe **estado agregado** (ACTIVE/EMERGENT/HIDDEN) |
| Existencia | Miles posibles en catálogo | Pocas por dominio (típ. 3–8 operativas) |
| Ejemplo | `edicion_de_video` | `AV_EDITING` |

**Regla:** una skill **no es** una especialidad. Varias skills alimentan una especialidad.

### 1.5 Especialidad vs tool

| Tool | Especialidad |
|------|--------------|
| Instrumento (Premiere, Figma) | Práctica (edición, diseño de interfaces) |
| Puede listarse sin evidencia aplicada | Requiere **skills profesionales** para sostenerse |
| Mapping con peso bajo | Nunca definida solo por tools |

**Regla central:** una especialidad **no puede sostenerse solamente con tools** (ver §11).

### 1.6 Especialidad vs cargo

| Cargo | Especialidad |
|-------|--------------|
| Contrato organizacional | Modelo de evidencia CV |
| Puede mezclar varias prácticas | Una práctica puede aparecer en muchos cargos |
| **No** define especialidad | **No** se infiere del cargo |

### 1.7 Especialidad vs área organizacional

El área indica **dónde** trabaja la persona; la especialidad indica **qué práctica** evidencia. Misma área → especialidades distintas posibles.

### 1.8 Especialidad vs dominio independiente

| Criterio | Permanece especialidad | Candidata a dominio |
|----------|------------------------|---------------------|
| Vocabulario | Subconjunto del padre | Corpus propio ≥15 skills profesionales recurrentes |
| Fronteras | Contenidas en el padre | Fronteras propias que distorsionan al padre |
| PA2 | Comparte regla del dominio | Requiere umbrales y radar distintos |
| Profesional primario | Puede coexistir con otras del dominio | Práctica autónoma en mercado |

**Regla:** spin-off es evolución **horizontal** excepcional; no se usa para evitar definir fronteras.

---

## 2. Componentes obligatorios de una especialidad

Estructura canónica de documentación (ver plantilla):

```text
Especialidad
├── code                    (OBLIGATORIO)
├── nombre                  (OBLIGATORIO)
├── definición              (OBLIGATORIO)
├── propósito profesional   (OBLIGATORIO)
├── alcance                 (OBLIGATORIO)
├── skills nucleares        (OBLIGATORIO desde SUPPORTED)
├── skills complementarias  (RECOMENDADO)
├── tools asociadas         (RECOMENDADO)
├── aliases                 (OBLIGATORIO antes de STABLE)
├── mappings                (OBLIGATORIO desde DRAFT)
├── evidencias esperadas    (OBLIGATORIO)
├── evidencias insuficientes (OBLIGATORIO)
├── fronteras               (OBLIGATORIO antes de STABLE)
├── falsos positivos comunes (RECOMENDADO; obligatorio antes de CONSOLIDATED)
├── relación con otras especialidades (RECOMENDADO)
├── estado de madurez       (OBLIGATORIO)
├── versión                 (OBLIGATORIO desde DRAFT)
└── historial de decisiones (RECOMENDADO; obligatorio en cambios major)
```

### 2.1 Clasificación por fase

| Componente | HYPOTHESIS | RESERVED | EMERGENT | SUPPORTED+ |
|------------|------------|----------|----------|------------|
| code, nombre, definición | OBL | OBL | OBL | OBL |
| mappings | — | — | OPCIONAL (experimental) | OBL |
| aliases | — | — | REC | OBL (STABLE) |
| fronteras intra-dominio | REC | OBL | OBL | OBL |
| historial decisiones | REC | REC | REC | OBL (major) |

---

## 3. Ciclo de vida de una especialidad

### 3.1 Escala oficial de madurez de especialidad

```text
HYPOTHESIS → RESERVED → EMERGENT → SUPPORTED → STABLE → CONSOLIDATED
                                                      ↘ DEPRECATED → RETIRED
```

> **Convención de lectura:** los estados en **MAYÚSCULAS** de este documento denotan **madurez de especialidad** (conocimiento/catálogo), salvo cuando se cite explícitamente “resultado PA2”.

### 3.2 Definición por estado

| Estado | Significado | Evidencia mínima | PA2 permitido | Visible al usuario | Puede producir ACTIVE (PA2) |
|--------|-------------|------------------|---------------|-------------------|------------------------------|
| **HYPOTHESIS** | Idea documentada; no en catálogo | Nota en Discovery; 0–1 perfil | No | No | No |
| **RESERVED** | Registrada; sin mappings definitivos | Señal en corpus pero insuficiente para generalizar | No (o solo dry-run experimental) | Opcional como “reservada” | No |
| **EMERGENT** | Mappings experimentales; evidencia temprana | ≥1 perfil con skill profesional MODERATE+ en núcleo; o ≥2 perfiles con señal débil coherente | Dry-run sí; persistencia cautelosa | Sí, con etiqueta de madurez | **Solo EMERGENT/HIDDEN** (no ACTIVE de producción)* |
| **SUPPORTED** | Práctica defendida; pack operativo | ≥2 perfiles con evidencia diversa o 1 semilla muy fuerte + 1 refuerzo; fronteras borrador | Sí | Sí | Sí (ACTIVE posible según PA2) |
| **STABLE** | Comportamiento PA2 reproducible | Corpus MATCH+BORDERLINE; FP/FN documentados; aliases ≥80 % | Sí | Sí | Sí |
| **CONSOLIDATED** | Referencia organizacional | Checklist especialidad completo | Sí | Sí | Sí |
| **DEPRECATED** | Obsoleta; no nuevas evaluaciones | Decisión documentada; reemplazo definido | Solo histórico | Advertencia | No nuevas ACTIVE |
| **RETIRED** | Eliminada del catálogo activo | Migración completada | No | No (histórico) | No |

\* Política conceptual para implementación futura: en EMERGENT (madurez), PA2 no debería emitir ACTIVE en producción hasta pasar a SUPPORTED, salvo flag explícito de prototipo.

### 3.3 Criterios de entrada y salida (calidad, no cantidad fija)

**HYPOTHESIS → RESERVED:** práctica diferenciable identificada; decisión de registrar sin implementar.

**RESERVED → EMERGENT:** primera skill profesional MODERATE+ en núcleo **o** responsabilidad laboral explícita repetible; mappings propuestos en borrador.

**EMERGENT → SUPPORTED:** evidencia en **≥2 perfiles** con diversidad de señal **o** 1 semilla + 1 validación independiente; fronteras con ≥1 especialidad vecina; sin dependencia exclusiva de tools.

**SUPPORTED → STABLE:** dry-run 2× determinista en corpus; falsos positivos/negativos **comprendidos**; aliases recurrentes resueltos.

**STABLE → CONSOLIDATED:** checklist §17 completo.

**→ DEPRECATED:** ver §9.

### 3.4 Factores de madurez (no solo personas)

| Factor | Pregunta |
|--------|----------|
| Diversidad de evidencia | ¿Aparece en perfiles de cargos/áreas distintos? |
| Calidad de señal | ¿MODERATE+ en skills profesionales, no solo listing? |
| Consistencia PA2 | ¿Mismo perfil → mismo estado 2×? |
| Fronteras | ¿Se distingue de especialidades vecinas en corpus? |
| FP / FN | ¿Documentados y explicados? |
| Dependencia de tools | ¿ACTIVE requiere skill profesional? |
| Estabilidad semántica | ¿Aliases y definición dejan de moverse cada ronda? |

### 3.5 Compatibilidad con Domain Blueprint MC1.7.0 §4.3

| MC1.7.0 (legacy) | Specialty Blueprint 1.0 |
|------------------|----------------------|
| RESERVED | RESERVED |
| DRAFT | EMERGENT (con mappings borrador) |
| OPERATIONAL | SUPPORTED o STABLE |
| CONSOLIDATED | CONSOLIDATED |
| CANDIDATE_REMOVE | DEPRECATED (previo a RETIRED) |

Los documentos MC1.7.0 previos pueden usar terminología legacy hasta migración documental.

---

## 4. Madurez de especialidad vs resultado PA2 individual

### 4.1 Dos planos independientes

| Plano | Qué modela | Ejemplos |
|-------|------------|----------|
| **Madurez de especialidad** | Estado del **conocimiento** en catálogo/pack | `AV_EDITING` = SUPPORTED |
| **Resultado PA2 por persona** | Estado de **evaluación** de un individuo | Juan: `AV_EDITING` = HIDDEN |

**No son intercambiables.**

### 4.2 Resultados PA2 por persona (recordatorio)

| Resultado PA2 | Significado |
|---------------|-------------|
| **ACTIVE** | Evidencia y cardinalidad suficientes para especialidad principal o secundaria fuerte |
| **EMERGENT** | Señal real pero insuficiente para ACTIVE (cardinalidad, cobertura, una sola skill fuerte) |
| **HIDDEN** | Sin señal mapeada con evidencia útil, o bloqueado por anti-tool / OUTSIDE |

### 4.3 Matriz de combinaciones válidas

| Madurez especialidad | ACTIVE persona | EMERGENT persona | HIDDEN persona |
|---------------------|----------------|------------------|----------------|
| RESERVED | — | — | ✓ (esperado) |
| EMERGENT | raro* | ✓ | ✓ |
| SUPPORTED | ✓ | ✓ | ✓ |
| CONSOLIDATED | ✓ | ✓ | ✓ |
| DEPRECATED | histórico | histórico | ✓ |

\* ACTIVE con especialidad EMERGENT solo en fase Prototype documentada.

### 4.4 Ejemplo canónico

- `AV_EDITING` = **SUPPORTED** (catálogo maduro).
- Santiago = **ACTIVE** en `AV_EDITING` (futuro dry-run).
- Perfil solo con “Suite Office” = **HIDDEN** en `AV_EDITING`.

---

## 5. Criterios para crear una especialidad

### 5.1 Debe cumplirse todo

1. **Práctica profesional diferenciable** — expertos o corpus la nombran separadamente.
2. **Conjunto coherente de skills** — no una sola tool.
3. **Evidencia profesional observable** en CV (ideal MODERATE+ en núcleo).
4. **Distinguible** de especialidades existentes en el dominio.
5. **Recurrencia o relevancia** — ≥2 perfiles, o núcleo claro en semilla + hipótesis defendible.
6. **Utilidad interpretativa** — mejora el radar frente a un solo bucket genérico.
7. **Evaluación independiente** — PA2 puede emitir estado sin activar otra especialidad 1:1.

### 5.2 Señales positivas

- Responsabilidades laborales explícitas en experiencia.
- Skills profesionales con evidencia aplicada (WORK_EXPERIENCE).
- Misma práctica nombrada con ≥2 formulaciones (candidatas a alias).
- Perfiles BORDERLINE que hoy no encajan en especialidad existente.

### 5.3 Señales de alerta (no crear)

| Señal | Por qué |
|-------|---------|
| Existe solo una herramienta | Tool ≠ especialidad |
| Una palabra en un CV | No generalizar |
| Nombre de cargo | Cargo ≠ especialidad |
| Facilita “llenar” el radar vacío | Artificial |
| Duplica resultado de especialidad existente | Fusionar en su lugar |

### 5.4 Procedimiento de creación

```text
Señal en corpus / Discovery
  → Ficha HYPOTHESIS (Specialty Template)
  → Revisión fronteras con vecinas
  → Decisión: RESERVED o EMERGENT
  → Pack minor + dry-run
  → SUPPORTED
```

---

## 6. Criterios para RESERVED

### 6.1 Cuándo RESERVED

Registrar sin implementación plena cuando hay **evidencia inicial** pero **insuficiente** para:

- mappings definitivos,
- ACTIVE reproducible,
- generalización de vocabulario,
- fronteras estables.

**Ejemplos:** `AV_SOUND`, `AV_STREAMING`, `AV_PHOTOGRAPHY`, `VISUAL_UI`.

### 6.2 Qué puede hacer RESERVED

| Permitido | Prohibido |
|-----------|-----------|
| Existir en catálogo con definición y propósito | Mappings PRIMARY en pack de producción |
| Documentar evidencia observada y vacíos | Declarar STABLE o CONSOLIDATED |
| Dry-run experimental no persistido | ACTIVE como resultado de referencia |
| Política explícita en Domain Guide | Generalizar aliases desde un solo perfil |

### 6.3 Qué debe documentar RESERVED

- Por qué se reserva.
- Qué evidencia falta.
- Gate para pasar a EMERGENT.
- Riesgo si se activa prematuramente.

---

## 7. Criterios para fusionar especialidades

### 7.1 Señales de fusión

- Skills nucleares casi idénticas.
- Mismos perfiles ACTIVE/EMERGENT indistintamente.
- Misma práctica profesional; separación solo por tools.
- Usuarios/analistas no distinguen en explicación.
- Una siempre subordinada (solo SECONDARY mapping).

### 7.2 Procedimiento

```text
Detección (corpus o auditoría)
  → Comparación fichas + matriz mappings
  → Propuesta de fusión (issue / doc)
  → Versión major de pack + catálogo
  → Especialidad absorbente (SUPPORTED+)
  → Especialidad absorbida → DEPRECATED → RETIRED
  → Preservar historial (evaluaciones apuntan a versión congelada)
  → Actualizar Domain Guide + historial de decisiones
```

### 7.3 Preservación histórica

- Evaluaciones persistidas conservan `pack_version` y `specialty_code` originales.
- Documento de migración: código antiguo → código nuevo.

---

## 8. Criterios para dividir una especialidad

### 8.1 Señales de división

- Prácticas claramente distintas dentro de una ficha.
- PA2 mezcla perfiles incompatibles bajo un solo código.
- Vocabulario heterogéneo (ej. motion publicitario vs animación explicativa).
- Subgrupos estables de skills con evidencia no correlacionada.
- Una parte del núcleo puede existir sin la otra en el corpus.

### 8.2 Ejemplo conceptual (sin decisión)

`AV_MOTION` podría, en el futuro, dividirse en animación 2D explicativa vs motion publicitario — **solo** si el corpus lo exige.

### 8.3 Procedimiento

```text
Detección de heterogeneidad
  → Auditoría de subgrupos de skills/evidencia
  → Propuesta: especialidad A + especialidad B
  → Redistribución mappings (major)
  → Corpus de validación para ambas
  → Especialidad padre → DEPRECATED
```

---

## 9. Criterios para retirar una especialidad

### 9.1 Caso de referencia: `VISUAL_DIGITAL_ASSETS`

Causas válidas de retiro:

- No representa práctica profesional independiente.
- Es bucket de tools (Canva, Genially, InDesign sin profesional).
- Duplica GRAPHIC o EDITORIAL.
- Genera ambigüedad sin explicación útil.
- Anti-tool deja la especialidad siempre HIDDEN/EMERGENT tool-led.

### 9.2 Estados de retiro

```text
CANDIDATE_REMOVE (legacy) / DEPRECATED
  → período de gracia documentado
  → RETIRED (sin mappings activos)
```

### 9.3 Procedimiento

1. Documentar causa en Domain Guide.
2. Definir redistribución de skills/tools.
3. Publicar pack **major** sin la especialidad.
4. Marcar catálogo `MC_CATALOG_VERSION` incrementada.
5. **No** borrar evaluaciones históricas.
6. API/FE: especialidad RETIRED no aparece en radar vigente.

### 9.4 Qué preservar

| Artefacto | Acción |
|-----------|--------|
| Evaluaciones PA2 persistidas | Inmutables; referencian pack histórico |
| Dry-runs | Archivar en `tmp/` o docs de fase |
| Ficha especialidad | Mover a apéndice “Retiradas” con fecha |

---

## 10. Criterios para convertir especialidad en dominio

### 10.1 Preguntas mínimas (ej. `VISUAL_UI`)

| # | Pregunta |
|---|----------|
| Q1 | ¿Práctica profesional propia reconocible en mercado? |
| Q2 | ¿Tiene especialidades internas propias? |
| Q3 | ¿Vocabulario y metodologías no subsumibles al padre? |
| Q4 | ¿Fronteras con el padre generan FP sistemáticos? |
| Q5 | ¿Profesionales pueden ser primarios sin el dominio padre? |
| Q6 | ¿Requiere PA2, radar y pack independientes? |
| Q7 | ¿Mantenerla distorsiona el dominio padre? |

**Todas afirmativas con evidencia** → candidata a spin-off. **No decidir UI ahora**; solo aplicar proceso cuando corresponda.

### 10.2 Procedimiento spin-off

```text
Candidatura documentada (Specialty + Domain Discovery hijo)
  → GO explícito
  → Nuevo DOMAIN_CODE
  → Migración de skills/mappings (major en ambos)
  → Especialidad origen → RETIRED en padre
  → Frontera padre↔hijo publicada
```

---

## 11. Skills nucleares y complementarias

### 11.1 Taxonomía en contexto de especialidad

| Tipo | Rol en especialidad | Puede ser PRIMARY 1.0 | Activa sola post anti-tool |
|------|---------------------|----------------------|----------------------------|
| **CORE SKILL** | Define la práctica | Sí | Sí |
| **SUPPORTING SKILL** | Refuerza; no define sola | Raramente (>0.5) | A veces EMERGENT |
| **TOOL** | Instrumento | No (peso bajo) | **No** |
| **METHOD** | Forma de trabajo | Secundario | No |
| **TRANSVERSAL** | Contexto | No mapping | No |
| **OUTSIDE** | Otra disciplina | Sin mapping | No |

### 11.2 Regla central

> Una especialidad **no puede sostenerse solamente con tools.**

### 11.3 Contribución conceptual a resultados PA2 (sin umbrales numéricos)

| Composición de evidencia mapeada | Resultado PA2 esperado (típico) |
|----------------------------------|----------------------------------|
| 0 skills con evidencia útil | HIDDEN |
| Solo tools MODERATE, 0 profesional | HIDDEN (anti-tool) |
| 1 CORE MODERATE+ | EMERGENT |
| ≥2 CORE/SUPPORTING MODERATE+ con cobertura | ACTIVE (si madurez SUPPORTED+) |
| Mezcla dominio vecino dominante | HIDDEN o EMERGENT en especialidad secundaria |

Los umbrales numéricos permanecen en PA2; este blueprint define **política conceptual**.

---

## 12. Evidencia de especialidad

### 12.1 Tipos de evidencia (fuerza conceptual decreciente)

| Orden | Tipo | Notas |
|-------|------|-------|
| 1 | Responsabilidad recurrente en experiencia laboral | Máxima señal aplicada |
| 2 | Proyecto / producto entregable descrito | Sustantivo |
| 3 | Skill profesional explícita + experiencia | MODERATE típico |
| 4 | Logro / resultado medible | Refuerzo |
| 5 | Formación especializada (título, diplomado) | Soporte; no basta sola |
| 6 | Certificación | Soporte |
| 7 | Tool aplicada en contexto laboral | Soporte; no núcleo |
| 8 | Skill en sección skills (listing) | WEAK |
| 9 | Mención aislada / perfil genérico | Insuficiente |

### 12.2 Ejemplos por nivel (Evidence Engine — sin modificar motor)

| Nivel EE | Ejemplo AV | Ejemplo Visual |
|----------|------------|----------------|
| **Fuerte** | Serie de videos animados 2D + responsabilidad producción | Liderazgo proyectos diseño gráfico MODERATE |
| **Moderada** | Premiere en WORK_EXPERIENCE + edición en summary | `diseno_grafico` MODERATE |
| **Débil** | Blender solo en SKILLS_SECTION | InDesign listing sin experiencia |
| **Insuficiente** | “Suite Adobe” genérico | “Creativo” sin ancla |

---

## 13. Fronteras entre especialidades

### 13.1 Plantilla obligatoria (por par)

Para cada vecina `S₂`:

| Pertenece a S₁ | No pertenece | Zona gris | Regla de desempate |
|----------------|--------------|-----------|-------------------|
| … | … | … | evidencia aplicada > listing |

### 13.2 Pares de referencia (documentar en Domain Guide)

| Par | Pregunta distintiva |
|-----|---------------------|
| AV_EDITING ↔ AV_POST | ¿Entregable es corte/narrativa vs color/finishing? |
| AV_MOTION ↔ AV_EDITING | ¿Gráficos animados vs ensamblaje timeline? |
| VISUAL_GRAPHIC ↔ VISUAL_IDENTITY | ¿Pieza puntual vs sistema de marca? |
| VISUAL_EDITORIAL ↔ VISUAL_GRAPHIC | ¿Publicación periódica/diagramación vs pieza publicitaria? |

**Objetivo:** no eliminar todo solapamiento; definir **qué evidencia** inclina la balanza.

---

## 14. Relación con PA2

### 14.1 Política por madurez de especialidad

| Madurez | ¿Evaluable en PA2? | ¿En radar UI? | ¿ACTIVE producción? | ¿Persistir evaluación? |
|---------|-------------------|---------------|---------------------|------------------------|
| HYPOTHESIS | No | No | No | No |
| RESERVED | No | Opcional “reservada” | No | No |
| EMERGENT | Dry-run sí | Sí (etiqueta) | No* | Solo prototipo |
| SUPPORTED+ | Sí | Sí | Sí | Sí |
| DEPRECATED | Solo re-eval histórica | Advertencia | No nuevas | Congelar |
| RETIRED | No | No | No | Histórico |

### 14.2 Versionamiento de cambios PA2/mappings

| Cambio | Impacto evaluaciones |
|--------|---------------------|
| Patch alias | Re-evaluar opcional |
| Minor mapping | Nueva evaluación recomendada |
| Major fusión/división/retiro | Nueva evaluación; histórico preservado |

### 14.3 Preservación histórica

Toda evaluación persistida debe poder responder: `domain_code`, `specialty_code`, `pack_version`, `pa2_rules_version`, `source_hash`, `evaluation_id`.

---

## 15. Gobernanza y versionamiento

### 15.1 Semántica de versión (dominio + especialidad)

| Tipo | Cambio | Ejemplo |
|------|--------|---------|
| **Patch** | Alias nuevo; typo; sin cambio de significado | “Premiere Pro” → alias existente |
| **Minor** | Skill o mapping nuevo compatible | `motion_graphics` PRIMARY en AV_MOTION |
| **Major** | Fusión, división, retiro, redefinición de especialidad | Retirar VISUAL_DIGITAL_ASSETS |

### 15.2 Trazabilidad obligatoria en cambios major

- `source_hash` del corpus que motivó el cambio.
- `mapping_pack` version + hash.
- `MC_CATALOG_VERSION`.
- `algorithm_version` / `rules_version` PA2 si aplica.
- Entrada en **historial de decisiones** de la especialidad.

### 15.3 Regla de publicación

**No mutar** packs ni reglas publicadas in-place. Nueva versión + migración documentada.

---

## 16. Evolución continua con nuevos perfiles

### 16.1 Flujo

```text
Nuevo CV → Cadena extract/enrich/evidence → Evaluación PA2
  → ¿Resultado esperado?
       Sí → NO_CHANGE
       No → Auditoría evidencia → Clasificar hallazgo → Acción versionada
```

### 16.2 Clasificación de hallazgos

| Hallazgo | Acción | Versión típica |
|----------|--------|----------------|
| **NO_CHANGE** | Registrar en corpus | — |
| **NEW_ALIAS** | Pack patch | Patch |
| **NEW_MAPPING** | Pack minor | Minor |
| **NEW_SKILL** | Catálogo + mapping | Minor |
| **SPECIALTY_REFINEMENT** | Actualizar ficha; ajustar mappings | Minor |
| **NEW_SPECIALTY_HYPOTHESIS** | Ficha HYPOTHESIS | — |
| **BOUNDARY_CHANGE** | Domain Guide §fronteras | Minor o major |
| **FALSE_POSITIVE** | Ajustar mappings/PA2/frontera | Minor/major |
| **FALSE_NEGATIVE** | Alias o mapping faltante | Patch/minor |

### 16.3 Regla

El proceso **no debe mutar versiones publicadas** sin bump de versión y registro.

---

## 17. Consolidación de especialidad

Ver checklist completo: [`templates/mc1-specialty-validation-checklist.md`](templates/mc1-specialty-validation-checklist.md).

Resumen de criterios (no exclusivamente número de personas):

- Definición estable y falsable.
- Práctica diferenciable demostrada en corpus.
- Skills nucleares maduras (CORE, no solo tools).
- Aliases suficientes para formulaciones recurrentes.
- Tools separadas de profesionales (anti-tool validado).
- Mappings reproducibles en dry-run 2×.
- Evidencia diversa (experiencia + skills; ideal ≥2 perfiles).
- Fronteras intra e inter-dominio claras.
- FP y FN documentados y comprendidos.
- Explicación comprensible para analista no autor.
- Versionamiento e historial de decisiones disponibles.

---

## 18. Plantillas y evaluación retrospectiva

| Entregable | Ruta |
|------------|------|
| Plantilla especialidad | [`templates/mc1-specialty-template.md`](templates/mc1-specialty-template.md) |
| Checklist CONSOLIDATED | [`templates/mc1-specialty-validation-checklist.md`](templates/mc1-specialty-validation-checklist.md) |
| Evaluación Visual + AV | [`mc1-specialty-maturity-assessment.md`](mc1-specialty-maturity-assessment.md) |

---

## 19. Objetivo final — cumplimiento MC1.8.A

Tras este blueprint, cualquier analista puede:

```text
detectar posible especialidad
  → documentarla (Template)
  → clasificar madurez (§3)
  → validar con evidencia (§12)
  → incorporar al dominio (pack versionado)
  → refinar con nuevos perfiles (§16)
  → fusionar / dividir / retirar / spin-off (§7–10)
```

sin improvisar y sin depender del historial oral de Diseño Visual o Producción Audiovisual.

**Veredicto MC1.8.A:** Specialty Blueprint **publicado**. Próxima implementación AV (MC1.8.1) debe citar este documento al definir especialidades del pack v1.

---

**Normativa:** MC1.8.A · Specialty Blueprint v1.0 · 2026-07-28
