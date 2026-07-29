# MC1.7.0 — Domain Blueprint (metodología oficial)

**Versión:** 1.0 · 2026-07-28  
**Estado:** normativa metodológica  
**Alcance:** creación y maduración de dominios profesionales en MC1  
**No cubre:** implementación técnica, cambios de código, PA2, mappings ni pipelines CV

**Documentos relacionados:**

| Documento | Uso |
|-----------|-----|
| [`mc1-manifesto.md`](mc1-manifesto.md) | **Principios operativos MC1** (evidencia > cargo; anti-tool; evolución; no mutar publicados) |
| [`mc1-specialty-blueprint.md`](mc1-specialty-blueprint.md) | **Metodología oficial de especialidades** (MC1.8.A) |
| [`templates/mc1-specialty-template.md`](templates/mc1-specialty-template.md) | Ficha por especialidad |
| [`templates/mc1-specialty-validation-checklist.md`](templates/mc1-specialty-validation-checklist.md) | CONSOLIDATED por especialidad |
| [`mc1-specialty-maturity-assessment.md`](mc1-specialty-maturity-assessment.md) | Evaluación retrospectiva Visual + AV |
| [`templates/mc1-domain-template.md`](templates/mc1-domain-template.md) | Plantilla por dominio |
| [`templates/mc1-domain-validation-checklist.md`](templates/mc1-domain-validation-checklist.md) | Verificación CONSOLIDATED |
| [`mc1-domain-versioning-policy.md`](mc1-domain-versioning-policy.md) | Versionamiento técnico post-blueprint |
| [`mc1-visual-design-domain-guide.md`](mc1-visual-design-domain-guide.md) | Ejemplo de guía madura (referencia) |

---

## 1. Qué es un dominio profesional en MC1

### 1.1 Definición oficial

Un **dominio profesional MC1** es un **modelo documentado y versionado** que representa una **disciplina de práctica** reconocible en el mercado laboral y en los CV, expresada mediante:

- un **conjunto de especialidades** (ejes de práctica dentro de la disciplina),
- un **vocabulario canónico** de skills (profesionales, herramientas, transversales),
- **mappings** skill→especialidad con pesos,
- **fronteras** explícitas con otras disciplinas,
- y **reglas PA2** que traducen evidencia CV en estados por especialidad (ACTIVE / EMERGENT / HIDDEN).

El dominio es la **unidad de conocimiento** que el motor PA2 evalúa. No es una persona, un equipo ni un organigrama.

**Principio de evolución continua (dominio y especialidades):** los dominios MC1 son modelos evolutivos. CONSOLIDATED indica madurez suficiente para uso en producción, **no** cierre del modelo. Las especialidades dentro del dominio siguen el mismo principio (ver [`mc1-specialty-blueprint.md`](mc1-specialty-blueprint.md)).

### 1.2 Qué representa

| Representa | Descripción |
|------------|-------------|
| Una disciplina | Conocimiento y práctica profesional coherente (ej. desarrollo de software, diseño visual, producción audiovisual). |
| Un vocabulario | Keys canónicas + aliases hacia competencias repetibles en CV. |
| Una hipótesis falsable | “Esta evidencia CV debería mapear así y producir estos estados PA2.” |
| Un artefacto versionado | Catálogo, pack de mappings y regla PA2 con hashes congelados. |
| Una guía viva | Documento de dominio que acumula fronteras, casos ambiguos y madurez. |

### 1.3 Qué no representa

| No representa | Por qué |
|---------------|---------|
| Un cargo | Un “Analista de X” puede mezclar varios dominios o ninguno. |
| Un área organizacional | Un área agrupa roles heterogéneos. |
| Una profesión regulada | MC1 modela evidencia CV, no títulos ni colegios. |
| Una herramienta | Photoshop, Python o Moodle no son dominios. |
| Un proyecto | Un proyecto puntual no define disciplina. |
| Un score de persona | El dominio define **cómo** evaluar; la evaluación es instancia por persona. |

### 1.4 Dominio vs cargo

| Dimensión | Cargo | Dominio MC1 |
|-----------|-------|-------------|
| Origen | Organigrama / RRHH | Evidencia CV + diseño metodológico |
| Estabilidad | Cambia con reestructuración | Versionado; histórico inmutable |
| Granularidad | Uno por contrato | Varios dominios por persona |
| Inferencia | **Prohibida** en MC1 | Solo evidencia explícita en CV |
| Ejemplo | “Analista de diseño de contenidos” | Puede ser Visual + Instruccional + AV según CV |

**Regla:** nunca crear ni calibrar un dominio “para un cargo”.

### 1.5 Dominio vs área organizacional

El área responde **dónde** trabaja la persona; el dominio responde **qué disciplina evidencia**. Una misma área puede contener perfiles de dominios distintos. La semilla puede salir de un área, pero la validación debe incluir perfiles **fuera** del área cuando sea posible.

### 1.6 Dominio vs profesión

La **profesión** (ej. “Diseñador gráfico”, “Ingeniero de sistemas”) es etiqueta social o de formación. El **dominio MC1** es modelo operativo: especialidades, mappings y fronteras. Una profesión puede alimentar varios dominios (ej. “diseñador” → Visual, UI, Marketing) o ser demasiado amplia para un solo dominio.

---

## 2. Componentes obligatorios de un dominio

### 2.1 Estructura canónica

```text
Dominio MC1
├── Metadatos (código, nombre, versión catálogo, estado madurez)
├── Definición (qué es / qué no es)
├── Objetivo (para qué existe en MC1)
├── Especialidades[]
│   ├── Definición profesional
│   ├── Competencias nucleares / accesorias
│   ├── Skills canónicas + mappings
│   ├── Nivel de madurez por especialidad
│   └── Candidatura a eliminación / fusión / spin-off
├── Vocabulario
│   ├── Skills profesionales (DOMAIN_SPECIALTY)
│   ├── Tools
│   ├── Transversales
│   └── OUTSIDE (explícito)
├── Aliases (capa de normalización léxica)
├── Mappings (pack versionado)
├── Fronteras (con dominios vecinos)
├── Casos ambiguos
├── Corpus de validación
│   ├── Persona semilla
│   ├── Perfiles MATCH / BORDERLINE / OUTSIDE
│   └── Artefactos dry-run
├── Regla PA2 (referencia; no diseñada en blueprint)
├── Guía del dominio (Domain Guide)
└── Estado de madurez + roadmap
```

### 2.2 Obligatorio vs opcional

| Componente | Obligatorio | Cuándo opcional |
|------------|-------------|-----------------|
| Definición + objetivo | **Sí** | — |
| ≥2 especialidades ACTIVE en catálogo | **Sí** (mín. 2) | Dominio monoespecialidad solo en PROTOTYPE |
| Skills profesionales canónicas | **Sí** | — |
| Clasificación OUTSIDE explícita | **Sí** | — |
| Mappings iniciales | **Sí** antes de VALIDATING | — |
| Fronteras documentadas | **Sí** antes de STABLE | — |
| Persona semilla + cadena CV | **Sí** | — |
| ≥1 MATCH + ≥1 BORDERLINE + ≥1 OUTSIDE | **Sí** antes de STABLE | OUTSIDE puede ser perfil sintético documentado |
| Aliases | **Sí** antes de CONSOLIDATED | PROTOTYPE puede tener gaps documentados |
| Domain Guide | **Sí** antes de CONSOLIDATED | — |
| Casos ambiguos | **Sí** antes de STABLE | — |
| Matriz vocabulario | **Sí** en Domain Guide | — |
| Roadmap del dominio | **Sí** | — |
| Regla PA2 dedicada | **Recomendado** | Dominio muy pequeño puede heredar LEXICO estándar |
| Especialidad “reservada” sin mappings | **Opcional** | Solo con política explícita (ej. UI) |
| Tercera ronda de validación dirigida | **Recomendado** | Dominio simple |

---

## 3. Ciclo de vida de un dominio (proceso oficial)

### 3.1 Diagrama

```text
┌─────────────┐
│    IDEA     │  Hipótesis de disciplina + fronteras preliminares
└──────┬──────┘
       ▼
┌─────────────┐
│  DISCOVERY  │  Auditoría RO semilla; inventario competencias; GO/NO-GO
└──────┬──────┘
       ▼
┌─────────────┐
│  PROTOTYPE  │  Catálogo + pack v1 + PA2 v1 + dry-run semilla
└──────┬──────┘
       ▼
┌─────────────┐
│ VALIDATING  │  Hermanos/siblings; completar cadenas CV; rondas dry-run
└──────┬──────┘
       ▼
┌─────────────┐
│  KNOWLEDGE  │  Refinar pack (v2+); aliases; Domain Guide
│  EXPANSION  │
└──────┬──────┘
       ▼
┌─────────────┐
│   STABLE    │  Comportamiento PA2 reproducible; fronteras cerradas
└──────┬──────┘
       ▼
┌─────────────┐
│CONSOLIDATED │  Criterios de calidad §10; checklist aprobado
└──────┬──────┘
       ▼
┌─────────────┐
│ PRODUCTION  │  Persistencia masiva; API/FE; política de mantenimiento
└─────────────┘
```

### 3.2 Fases — descripción y entregables

| Fase | Código sugerido | Objetivo | Entregables mínimos | Gate de salida |
|------|-----------------|----------|---------------------|----------------|
| **Idea** | MC1.X.0-pre | Justificar existencia del dominio | Nota de alcance, fronteras borrador | Aprobación explícita para Discovery |
| **Discovery** | MC1.X.0 | Auditar semilla solo lectura | Informe auditoría, inventario skills, `chain.ok` | GO con ajustes documentados |
| **Prototype** | MC1.X.1 | Primera implementación técnica | Catálogo, pack v1, PA2 v1, dry-run semilla, 1 eval persistida opcional | Semilla MATCH defendible en dry-run |
| **Validating** | MC1.X.1C | Probar con perfiles diversos | Preflight hermanos, cadenas CV, dry-runs V1, clasificación MATCH/BORDERLINE/OUTSIDE | Falsos positivos/negativos documentados |
| **Knowledge Expansion** | MC1.X.1C.2 / D | Madurar vocabulario sin tocar PA2 | Pack v2+, aliases, Domain Guide | Vocabulario ≥80 % cubierto en corpus |
| **Stable** | MC1.X.1D+ | Comportamiento predecible | Domain Guide, matriz vocabulario, fronteras | Dry-runs deterministas; gaps acotados |
| **Consolidated** | MC1.X.2 | Declaración de madurez | Checklist CONSOLIDATED firmado | Todos los criterios §10 |
| **Production** | MC1.X.3 | Operación continua | Política versionamiento, runbook eval | Monitoreo drift CV |

### 3.3 Reglas transversales del ciclo

1. **Dry-run antes de persistir** evaluaciones masivas.
2. **No mutar** packs/reglas publicadas in-place; nueva versión.
3. **Re-extracción** si `source_hash` o prompt/extractor cambian.
4. **Documentar** cada fase en `docs/mc1.<fase>-<dominio>-<tema>.md`.
5. **Separar** refinamiento de conocimiento (mappings/aliases) de refinamiento de motor (PA2) — el blueprint asume PA2 estable salvo dominio nuevo.

---

## 4. Estados de madurez

### 4.1 Escala oficial

```text
DISCOVERED → PROTOTYPE → VALIDATING → STABLE → CONSOLIDATED
                                              ↘ PRODUCTION (operativo)
```

Estado paralelo: **RETIRED** (dominio o pack retirado; histórico intacto).

### 4.2 Definición por estado

| Estado | Significado | Requisitos de entrada | Criterios de salida |
|--------|-------------|----------------------|---------------------|
| **DISCOVERED** | Existe hipótesis y evidencia semilla en CV | Auditoría RO completada; cadena CV vigente o plan para completarla | Informe GO; especialidades propuestas |
| **PROTOTYPE** | Primer pack + PA2 + dry-run semilla | Catálogo sembrado; pack v1 publicado; dry-run semilla | ≥1 especialidad ACTIVE o EMERGENT coherente en semilla |
| **VALIDATING** | Prueba con corpus diverso | ≥3 perfiles con cadena CV (semilla + 2+) | Clasificación MATCH/BORDERLINE/OUTSIDE por perfil; lista falsos +/- |
| **STABLE** | Conocimiento y motor alineados | Pack vigente; Domain Guide borrador; fronteras §6 | Comportamiento PA2 reproducible 2×; falsos negativos **comprendidos** (no sorpresa) |
| **CONSOLIDATED** | Dominio listo como referencia organizacional | Checklist §10 completo | Aprobación metodológica |
| **PRODUCTION** | Uso operativo masivo | CONSOLIDATED + runbook + API/FE si aplica | Política de drift y re-evaluación |

### 4.3 Madurez por especialidad (dentro del dominio)

Cada especialidad tiene su propio ciclo de vida, **independiente** del estado del dominio padre y **independiente** del resultado PA2 por persona (ACTIVE / EMERGENT / HIDDEN). La normativa completa está en [`mc1-specialty-blueprint.md`](mc1-specialty-blueprint.md) §3–§4.

**Escala resumida (Specialty Blueprint 1.0):**

```text
HYPOTHESIS → RESERVED → EMERGENT → SUPPORTED → STABLE → CONSOLIDATED
                                                      ↘ DEPRECATED → RETIRED
```

| Sub-estado (resumen) | Criterio breve |
|----------------------|----------------|
| **HYPOTHESIS** | Idea documentada; aún no en catálogo |
| **RESERVED** | En catálogo; sin mappings definitivos |
| **EMERGENT** | Mappings experimentales; evidencia temprana |
| **SUPPORTED** | Práctica defendida; pack operativo |
| **STABLE** | PA2 reproducible; FP/FN comprendidos |
| **CONSOLIDATED** | Checklist de especialidad completo |
| **DEPRECATED / RETIRED** | Retiro versionado; histórico preservado |

**Madurez del dominio y madurez de especialidades:** un dominio no debería declararse CONSOLIDATED si ninguna especialidad nuclear alcanza al menos **STABLE**, o si especialidades DEPRECATED sin retirar generan ruido sistemático. Ver criterio C10 §10.2 y Specialty Blueprint §17.

**Compatibilidad MC1.7.0 (legacy):** RESERVED ≈ RESERVED; DRAFT ≈ EMERGENT; OPERATIONAL ≈ SUPPORTED/STABLE; CANDIDATE_REMOVE ≈ DEPRECATED.

**Evolución:**

| Tipo | Ámbito | Ejemplos |
|------|--------|----------|
| **Vertical** | Una especialidad existente | Aliases, mappings, fronteras, reducción FP/FN |
| **Horizontal** | Estructura del dominio | Nueva especialidad; fusión; división; retiro; spin-off a dominio hijo |

---

## 5. Proceso de validación (selección de perfiles)

### 5.1 Principio

La validación no busca “más personas”. Busca **diversidad de señal** para probar definición, fronteras y vocabulario.

### 5.2 Persona semilla

| Criterio | Descripción |
|----------|-------------|
| Cadena CV completa | extracción + enrichment + evidence vigentes, `source_hash` alineado |
| Evidencia disciplinar clara | Al menos una skill profesional MODERATE+ en el núcleo del dominio |
| Sin ser “perfecta” | Puede mezclar transversales; debe ser realista |
| Trazabilidad | Documento, person_id, IDs de cadena registrados |
| Rol irrelevante | Se documenta rol/área pero **no** se usa para inferir dominio |

**Objetivo:** anclar el pack v1 y la primera evaluación defendible.

### 5.3 Perfil MATCH

| Criterio | Descripción |
|----------|-------------|
| Evidencia CV | Núcleo profesional del dominio con evidencia aplicada (ideal MODERATE+) |
| Expectativa PA2 | Al menos una especialidad ACTIVE o EMERGENT coherente **sin** forzar umbrales |
| Función en validación | Demostrar que el dominio **sí captura** la disciplina |

**Objetivo:** probar verdaderos positivos.

### 5.4 Perfil BORDERLINE

| Criterio | Descripción |
|----------|-------------|
| Evidencia CV | Mezcla dominio vecino + señal débil del dominio; o una sola skill profesional fuerte |
| Expectativa PA2 | EMERGENT, HIDDEN parcial, o ACTIVE en especialidad secundaria |
| Función | Calibrar cardinalidad, aliases faltantes, fronteras |

**Objetivo:** encontrar gaps de vocabulario sin falsos positivos.

### 5.5 Perfil OUTSIDE

| Criterio | Descripción |
|----------|-------------|
| Evidencia CV | Núcleo en dominio vecino (otra disciplina) |
| Mismo cargo/área opcional | Refuerza que cargo ≠ dominio |
| Expectativa PA2 | 0 ACTIVE; dominio no debe “absorber” el perfil |
| Función | Probar fronteras y clasificaciones OUTSIDE |

**Objetivo:** probar verdaderos negativos.

### 5.6 Tamaño mínimo de corpus (calidad, no cantidad)

No hay número fijo de personas. Hay **cobertura de casos**:

| Caso requerido | Mínimo |
|----------------|--------|
| Semilla MATCH | 1 |
| MATCH adicional (especialidad distinta o refuerzo) | 1 recomendado |
| BORDERLINE | ≥1 |
| OUTSIDE | ≥1 |
| Falso negativo documentado (gap alias) | ≥1 antes de CONSOLIDATED |
| Dry-run doble determinista | Todos los perfiles del corpus |

---

## 6. Reglas para especialidades

> **Normativa detallada:** crear, reservar, fusionar, dividir, retirar y convertir en dominio independiente — [`mc1-specialty-blueprint.md`](mc1-specialty-blueprint.md) §5–§10.  
> **Plantilla de ficha:** [`templates/mc1-specialty-template.md`](templates/mc1-specialty-template.md).

### 6.1 ¿Cuándo merece existir una especialidad?

Una especialidad **merece existir** cuando cumple **todas**:

1. **Práctica profesional distinguible** — expertos la nombran separadamente.
2. **Evidencia recurrente en CV** — aparece en ≥2 perfiles del corpus o en literatura de rol.
3. **Skills profesionales propias** — no solo herramientas.
4. **Utilidad para PA2** — permite estados diferenciados (no duplica otra especialidad 1:1).
5. **Definición falsable** — se puede escribir “qué no es”.

### 6.2 ¿Cuándo debe eliminarse?

Eliminar o marcar **CANDIDATE_REMOVE** cuando:

- Solo tiene **tools** mapeadas y ninguna skill profesional en el corpus.
- **100 % HIDDEN** en todos los perfiles VALIDATING sin explicación de reserva.
- **Duplica** otra especialidad en resultado PA2 (mismos perfiles, mismos estados).
- No hay **práctica profesional independiente** (ej. bucket “herramientas digitales” sin competencia nucleus).

Proceso: documentar en Domain Guide → proponer en pack vNext → no eliminar en catálogo sin nueva `MC_CATALOG_VERSION`.

### 6.3 ¿Cuándo fusionar dos especialidades?

Fusionar cuando:

- Mismas skills profesionales y mismos perfiles ACTIVE/EMERGENT indistintos.
- Separación solo por tools (ej. dos especialidades activadas solo por InDesign vs Canva).
- Expertos no distinguen la práctica en el contexto organizacional.

### 6.4 ¿Cuándo spin-off a dominio independiente?

Convertir especialidad en **dominio nuevo** cuando:

- Tiene **vocabulario propio** ≥15 skills profesionales recurrentes.
- Requiere **fronteras distintas** y PA2 con umbrales diferentes.
- Profesionales pueden ser **primarios** en esa práctica sin el dominio padre.
- Mezclar contamina falsos positivos del dominio padre de forma sistemática.

### 6.5 Ejemplo conceptual: especialidad “UI” en un dominio visual

Sin modificar implementación actual:

| Pregunta | Análisis metodológico |
|----------|----------------------|
| ¿Merece existir? | Solo si la organización distingue **diseño visual de interfaces** como práctica separada del gráfico editorial. |
| Evidencia en corpus típico | Menciones UX/UI frecuentes pero a menudo WEAK o mezcladas con código/prototipado. |
| Riesgo | Absorber **UX Research** o **desarrollo front** → falsos positivos. |
| Opciones | (A) RESERVED sin mappings hasta política; (B) mappings restrictivos con evidencia mínima documentada; (C) **spin-off** a dominio UX/UI independiente. |
| Regla blueprint | **No activar** especialidad UI por cargo “UX/UI”; exigir criterios de evidencia mínima en Domain Guide antes de mappings. |

---

## 7. Reglas para skills

### 7.1 Taxonomía MC1

| Tipo | Definición | Entra a PA2 como | Ejemplo genérico |
|------|------------|------------------|------------------|
| **Skill profesional** | Conocimiento o práctica disciplinar | `PROFESSIONAL_KNOWLEDGE` | “Diseño editorial”, “Backend development” |
| **Tool** | Software o plataforma instrumento | `TOOL` | Photoshop, Git, Moodle |
| **Metodología** | Forma de trabajo aplicable a varios dominios | `METHODOLOGY` | Scrum, Design Thinking, Prompting |
| **Tecnología** | Paradigma o stack genérico | `TECHNOLOGY` | REST, IA generativa |
| **Soft skill / transversal** | Competencia interpersonal o genérica | `SOFT_SKILL` / TRANSVERSAL | Trabajo en equipo |
| **OUTSIDE** | Skill clasificada fuera del dominio | Sin mapping | SCORM en dominio visual |

### 7.2 Criterios objetivos

| Pregunta | Profesional | Tool |
|----------|-------------|------|
| ¿Se enseña como disciplina? | Sí | No (se enseña uso) |
| ¿Tiene evidencia sin nombrar software? | Sí | A menudo solo listing |
| ¿Transfiere entre herramientas? | Sí | No |
| ¿Puede ser PRIMARY 1.0 en mapping? | Sí | Raramente; peso bajo |
| ¿Sola activa especialidad post anti-tool? | Sí | **No** (regla PA2 vigente) |

### 7.3 Conocimiento vs competencia transversal

- **Conocimiento de dominio:** clasificar `DOMAIN_SPECIALTY` si alimenta especialidad.
- **Transversal:** aporta contexto pero no define especialidad (IA, gestión de proyectos, soft skills).
- **Regla:** si aparece en >50 % de todos los CV independiente del rol → candidata TRANSVERSAL.

---

## 8. Reglas para aliases

### 8.1 Cuándo crear alias

Crear alias cuando:

- La **misma práctica** aparece con ≥2 formulaciones léxicas en el corpus.
- Existe **key canónica** destino con misma semántica.
- La evidencia CV es **sustantiva** en al menos un perfil (no typo aislado).
- El falso negativo es **reproducible** en dry-run (skill con evidencia, sin mapping).

### 8.2 Cuándo crear nueva skill canónica

Nueva key cuando:

- La práctica es **distinta** de todas las canónicas (no es sinónimo).
- Aparece en ≥2 perfiles o es núcleo claro en 1 perfil semilla.
- No puede resolverse por alias sin **pérdida semántica** (ej. “marketing digital” ≠ “diseño gráfico”).

### 8.3 Cuándo normalizar en extractor/enricher

- Alias count >3 para la misma idea → considerar normalización upstream.
- Formulaciones compuestas recurrentes (“A y B”) → split o key compuesta documentada.

### 8.4 Cuándo no hacer nada

- Aparición **única** en un CV.
- Término **genérico** (“suite Adobe”, “herramientas digitales”) → OUTSIDE o ignorar.
- Equivalencia **dudosa** → documentar en casos ambiguos; no aliasar hasta VALIDATING adicional.

### 8.5 Ejemplos (casos reales ya observados — dominio Visual)

| Formulación CV | Decisión blueprint | Destino |
|----------------|-------------------|---------|
| Branding y Diseño de Identidad Corporativa | **Alias** | `diseno_de_identidad_visual` |
| Identidad visual | **Alias** | `diseno_de_identidad_visual` |
| Diseño Editorial y Diagramación | **Alias split** | `diseno_editorial` + `diagramacion_editorial` |
| Adobe Creative Cloud | **No aliasar** | OUTSIDE (genérico) |
| Ilustración digital | **Nueva key** (propuesta) | `ilustracion_digital` |
| Diseño UX/UI | **No aliasar a Visual** | Frontera / dominio futuro |

---

## 9. Metodología de fronteras

### 9.1 Por qué son obligatorias

Sin fronteras, el dominio **absorbe** prácticas vecinas por:

- tools compartidas (Adobe, Office),
- cargos híbridos,
- listing en sección skills sin evidencia aplicada.

Las fronteras reducen falsos positivos y hacen explícitos los OUTSIDE.

### 9.2 Procedimiento

Para cada dominio vecino `D₂`:

```text
1. Listar skills que aparecen en corpus de ambos dominios
2. Clasificar cada skill:
   ├── PERTENECE (mapping en D₁)
   ├── NO PERTENECE (OUTSIDE en D₁)
   └── ZONA GRIS (caso ambiguo documentado)
3. Definir regla de desempate (evidencia aplicada > listing)
4. Validar con ≥1 perfil OUTSIDE hacia D₂
5. Registrar en Domain Guide §Fronteras
```

### 9.3 Plantilla de frontera

| Dominio vecino | Pertenece a D₁ | No pertenece | Zona gris | Regla |
|----------------|----------------|--------------|-----------|-------|
| _ej. Instruccional_ | Maquetación visual de guía | SCORM, LMS, DI como núcleo | Material educativo maquetado | Si entregable es curso → D₂ |

### 9.4 Zona gris

La zona gris **no se mapea** hasta tener regla. Se documenta en “casos ambiguos” con:

- ejemplo de CV,
- decisión provisional,
- perfil de validación que la resolverá.

---

## 10. Consolidación — criterios de calidad

### 10.1 ¿Cuándo declarar CONSOLIDATED?

Cuando el dominio cumple **criterios de calidad**, no un conteo fijo de personas.

### 10.2 Criterios obligatorios

| # | Criterio | Indicador de cumplimiento |
|---|----------|---------------------------|
| C1 | **Especialidades estables** | Cada especialidad OPERATIONAL o CANDIDATE_REMOVE documentado; ninguna sin definición |
| C2 | **Falsos positivos bajos** | Perfiles OUTSIDE sin ACTIVE; fronteras validadas |
| C3 | **Falsos negativos comprendidos** | Todo FN tiene ticket de alias o OUTSIDE deliberado; sin FN sorpresa en ronda final |
| C4 | **Aliases maduros** | ≥90 % formulaciones recurrentes del corpus resueltas |
| C5 | **Vocabulario estable** | Matriz skill↔canónica publicada en Domain Guide |
| C6 | **Fronteras claras** | ≥3 fronteras con vecinos documentadas con regla |
| C7 | **Comportamiento consistente** | Dry-run 2× determinista en todo el corpus |
| C8 | **Reproducibilidad técnica** | `source_hash`, pack hash, config hash en contexto |
| C9 | **Domain Guide completo** | Guía según plantilla |
| C10 | **Al menos un eje consolidado** | ≥1 especialidad CONSOLIDATED (ACTIVE reproducible) |
| C11 | **Diversidad de señal** | Corpus incluye MATCH + BORDERLINE + OUTSIDE |
| C12 | **Política de evolución** | Roadmap vNext sin deuda silenciosa |

### 10.3 Criterios que no bastan solos

- Número de evaluaciones persistidas.
- Mismo cargo/área en todos los perfiles.
- Solo especialidad gráfica/nuclear ACTIVE sin especialidades secundarias evaluadas.

### 10.4 Declaración

La declaración CONSOLIDATED es **metodológica** (Domain Guide + checklist). La implementación técnica sigue [`mc1-domain-versioning-policy.md`](mc1-domain-versioning-policy.md).

---

## 11. Plantilla oficial

Ver [`templates/mc1-domain-template.md`](templates/mc1-domain-template.md).

Uso:

1. Copiar plantilla a `docs/mc1-<dominio>-domain-guide.md` cuando el dominio alcance fase Knowledge Expansion.
2. Completar secciones en orden.
3. No saltar fronteras ni casos ambiguos.

---

## 12. Checklist de validación

| Nivel | Documento |
|-------|-----------|
| Dominio CONSOLIDATED | [`templates/mc1-domain-validation-checklist.md`](templates/mc1-domain-validation-checklist.md) |
| Especialidad CONSOLIDATED | [`templates/mc1-specialty-validation-checklist.md`](templates/mc1-specialty-validation-checklist.md) |

---

## 13. Roadmap recomendado de creación de dominios

Orden basado en dependencias de frontera, madurez del motor y corpus disponible. **No implementar** en esta fase.

| Orden | Dominio | Justificación |
|-------|---------|---------------|
| 1 | **Desarrollo de Software** | Referencia histórica MC1; motor PA2 maduro; catálogo consolidado |
| 2 | **Diseño Visual** | En STABLE; fronteras con instruccional/AV/UX ya exploradas; alimenta política anti-tool |
| 3 | **Diseño Instruccional** | Alta prevalencia en Fábrica de Contenidos; frontera con Visual ya documentada; reduce contaminación cruzada |
| 4 | **Producción Audiovisual** | Frontera clara con Visual (timeline vs pieza estática); muchos listings Premiere en CVs actuales |
| 5 | **Marketing / Comunicación digital** | Absorbe community manager, analítica; frontera con Visual (pieza vs campaña) |
| 6 | **UX / Diseño de producto** | Spin-off potencial desde especialidad UI; requiere política propia |
| 7 | **Operaciones / Gestión** | Perfil transversal; probablemente más MC2 que dominio PA2 — evaluar si merece dominio |

**Regla de orden:** construir primero dominios con **fronteras ya validadas** contra un dominio existente, antes de dominios altamente transversales.

---

## 14. Convención de documentación por fase

| Fase | Patrón de archivo |
|------|-------------------|
| Discovery | `mc1.<X>.0-<slug>-domain-audit.md` |
| Prototype | `mc1.<X>.1-<slug>-implementation.md` |
| Validating | `mc1.<X>.1c-<slug>-sibling-audit.md` |
| Evidence | `mc1.<X>.1c.1-<slug>-candidate-evidence.md` |
| Pack v2 | `mc1.<X>.1c.2-<slug>-v2-implementation.md` |
| Ronda validación | `mc1.<X>.1c.3-<slug>-validation-roundN.md` |
| Domain Guide | `mc1-<slug>-domain-guide.md` |
| Blueprint | `mc1-domain-blueprint.md` (este documento) |

---

## 15. Objetivo final — cumplimiento

Tras MC1.7.0:

- Ningún dominio nuevo depende del historial oral del equipo.
- Cualquier analista puede iniciar en **Discovery** con semilla, seguir el ciclo §3 y cerrar con **Domain Guide + checklist**.
- PA2 y mappings se **consumen** como infraestructura estable; el blueprint gobierna **conocimiento**, no código.

**Veredicto MC1.7.0:** Blueprint oficial **publicado**. Próximo dominio debe citar este documento en su fase Discovery.

**Actualización MC1.8.A:** enlazado [`mc1-specialty-blueprint.md`](mc1-specialty-blueprint.md) como normativa de especialidades; §4.3 ampliado con ciclo completo, evolución vertical/horizontal y dependencia dominio↔especialidad. Compatible conceptualmente con MC1.7.0.
