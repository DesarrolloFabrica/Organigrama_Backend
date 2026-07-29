# MC1.2 — Especificación Funcional del Dominio «Desarrollo de Software»

| Campo | Valor |
|-------|-------|
| **Estado** | Contrato funcional oficial (pendiente de aprobación formal) |
| **Fase** | MC1.2 |
| **Dominio** | Desarrollo de Software |
| **Versión del contrato** | 1.0 |
| **Fuente de verdad previa** | `docs/mc1.1-analisis-dominio-software-camilo.md` |
| **Audiencia** | Producto, UX, Backend, Frontend |
| **Alcance** | Comportamiento del dominio — no implementación |

Este documento **congela** las reglas del dominio «Desarrollo de Software» para el Modelo de Competencias (MC1).

Tras su aprobación:

- no se reabre el debate sobre qué es o no es este dominio;
- PA2 y el Explorador de Competencias se implementan contra este contrato;
- futuros dominios reutilizan la misma estructura de reglas, no este contenido específico.

**Fuera de alcance de este documento:** clases, tablas, DTOs, migraciones, endpoints, fórmulas matemáticas definitivas, diseño visual de UI, código.

---

## 1. Propósito del dominio

### 1.1 Qué representa

**Desarrollo de Software** es un **área de experiencia profesional**: la práctica de diseñar, construir, integrar, probar, desplegar y mejorar sistemas de software.

No representa:

- una tecnología concreta (React, Node.js, Docker…);
- un título laboral (“Full Stack”, “Senior”, “Tech Lead”);
- un conjunto de soft skills;
- un radar genérico de “habilidades digitales”.

Representa la pregunta:

> ¿Qué hace esta persona como profesional de software?

### 1.2 Quién pertenece al dominio

Pertenecen perfiles cuya evidencia documental describe actividades de construcción o evolución de software, por ejemplo:

- desarrollo de interfaces y experiencias de producto digital;
- desarrollo de servicios, APIs y lógica de servidor;
- modelado y operación de datos persistentes;
- integración entre sistemas;
- despliegue y operación en entornos cloud;
- prácticas de ingeniería, calidad y entrega;
- aplicación de inteligencia artificial **dentro del ciclo de desarrollo de software**.

### 1.3 Objetivo dentro del Modelo de Competencias

Dentro de MC1, este dominio permite:

1. clasificar skills técnicas del pipeline existente bajo especialidades profesionales navegables;
2. mostrar un Explorador de Competencias por persona, área por área;
3. alimentar visualizaciones (p. ej. radar) **sin inventar capacidades**;
4. servir de plantilla estructural para otros dominios futuros.

### 1.4 Qué entra y qué no entra

| Entra en el dominio | No entra en el dominio |
|---------------------|------------------------|
| Tecnologías, herramientas, metodologías y conocimientos usados para construir software | Competencias transversales (liderazgo, comunicación, trabajo en equipo, etc.) → MC2 |
| Especialidades que responden “qué sabe hacer dentro del software” | Etiquetas de rol (“Full Stack”) usadas como eje |
| Skills con mapping a especialidades del área | Outcomes de negocio ambiguos sin especialidad inequívoca |
| Evidencia proveniente del pipeline (Extractor → Enrichment → Evidence Engine) | Inferencias no respaldadas por evidencia documental |

---

## 2. Definición oficial del dominio

El dominio se estructura en cuatro niveles. Cada nivel responde **una sola pregunta**. Ningún nivel debe asumir la responsabilidad de otro.

```
Área de experiencia
        ↓
Especialidad técnica
        ↓
Skills
        ↓
Evidencias
```

### 2.1 Área de experiencia

| Aspecto | Definición |
|---------|------------|
| **Pregunta** | ¿Qué hace esta persona profesionalmente? |
| **Responsabilidad** | Nombrar la profesión / campo de práctica |
| **En este contrato** | Desarrollo de Software |
| **No es** | Un radar, un listado de tools, ni una skill |

Una persona puede tener varias áreas en el futuro. Cada área posee su propio conjunto de especialidades y su propia visualización.

### 2.2 Especialidad

| Aspecto | Definición |
|---------|------------|
| **Pregunta** | ¿Qué sabe hacer dentro de esa área? |
| **Responsabilidad** | Agrupar actividades profesionales reconocibles dentro del área |
| **Unidad de navegación** | Eje del Explorador / radar de **esta** área |
| **No es** | Una tecnología, un vendor, ni un soft skill |

### 2.3 Skill

| Aspecto | Definición |
|---------|------------|
| **Pregunta** | ¿Con qué conocimientos, herramientas o metodologías lo hace? |
| **Responsabilidad** | Materializar la especialidad en elementos concretos del CV |
| **Origen** | Pipeline existente (extracción + enriquecimiento) |
| **No es** | Una profesión ni un eje del radar |

Una skill puede contribuir a **más de una especialidad** solo cuando la evidencia lo justifica, con pesos relativos cuya suma no exceda 1.

### 2.4 Evidencia

| Aspecto | Definición |
|---------|------------|
| **Pregunta** | ¿Dónde quedó demostrado? |
| **Responsabilidad** | Sustentar por qué el sistema cree que la skill (y, por agregación, la especialidad) tiene respaldo |
| **Origen exclusivo** | Evidence Engine sobre ítems de Enrichment derivados del CV |
| **No es** | Una opinión del modelo, ni una inferencia de seniority |

### 2.5 Separación anti-solapamiento

| Si el elemento… | Entonces pertenece a… |
|-----------------|------------------------|
| Nombra la profesión | Área |
| Nombra un saber-hacer profesional estable | Especialidad |
| Nombra una tecnología/herramienta/método concreto | Skill |
| Cita o mide respaldo documental | Evidencia |

**Regla:** si un elemento no responde la pregunta de su nivel, está mal ubicado.

---

## 3. Especialidades oficiales

Lista **congelada** del dominio Desarrollo de Software (conclusiones MC1.1).

Códigos estables (identidad de catálogo; no implican esquema de BD):

| Código | Nombre oficial |
|--------|----------------|
| `SOFTWARE_FRONTEND` | Desarrollo frontend |
| `SOFTWARE_BACKEND` | Desarrollo backend |
| `SOFTWARE_DATA` | Bases de datos |
| `SOFTWARE_API_INTEGRATION` | Integración de APIs |
| `SOFTWARE_CLOUD_DEPLOY` | Cloud y despliegue |
| `SOFTWARE_ENGINEERING_QUALITY` | Ingeniería y calidad de software |
| `SOFTWARE_AI_APPLIED` | IA aplicada al desarrollo |

> **Nota:** «Arquitectura de software» **no** es especialidad oficial en v1.0. En MC1.1 quedó como señal ambigua sin evidencia suficiente; incorporarla requeriría pasar las reglas de la §4.

### 3.1 Desarrollo frontend (`SOFTWARE_FRONTEND`)

| Campo | Contenido |
|-------|-----------|
| **Propósito** | Representar la capacidad de construir interfaces y experiencias de usuario en software |
| **Descripción funcional** | Agrupa frameworks, lenguajes y estilos usados para UI/producto digital |
| **Ejemplos de skills** | React, Next.js, Angular, JavaScript, TypeScript, HTML5, CSS3, Sass, Tailwind CSS |
| **Criterios de pertenencia** | La skill se usa para construir o estilizar interfaces; la evidencia habla de frontend, UI, interfaces o experiencia de usuario |
| **Criterios de no pertenencia** | Servicios de servidor, persistencia, infraestructura cloud, soft skills |
| **Relación con otras** | Complementaria a Backend; puede compartir skills de lenguaje (p. ej. JavaScript/TypeScript) con peso dual |

### 3.2 Desarrollo backend (`SOFTWARE_BACKEND`)

| Campo | Contenido |
|-------|-----------|
| **Propósito** | Representar la construcción de lógica de servidor, servicios y aplicaciones del lado servidor |
| **Descripción funcional** | Agrupa runtimes, frameworks y lenguajes de servicios |
| **Ejemplos de skills** | Node.js, NestJS, Express.js, ASP.NET, C#, .NET, Go |
| **Criterios de pertenencia** | Evidencia de servicios backend, APIs como parte de servicios, lógica de servidor |
| **Criterios de no pertenencia** | Solo UI; solo cloud de infraestructura sin servicio; solo metodología ágil |
| **Relación con otras** | Complementaria a Frontend y a Integración de APIs; puede recibir peso secundario de ORMs o APIs |

### 3.3 Bases de datos (`SOFTWARE_DATA`)

| Campo | Contenido |
|-------|-----------|
| **Propósito** | Representar modelado, consulta, administración y persistencia de datos |
| **Descripción funcional** | Agrupa motores, lenguajes de consulta y ORMs |
| **Ejemplos de skills** | PostgreSQL, MySQL, MongoDB, SQL, PL/SQL, TypeORM |
| **Criterios de pertenencia** | La skill describe almacenamiento, consulta, modelado u ORM de datos |
| **Criterios de no pertenencia** | Almacenamiento de objetos cloud usado solo como infra (p. ej. S3) sin rol de modelo de datos de aplicación; soft skills |
| **Relación con otras** | Colinda con Backend (ORM) y Cloud (managed DB); los pesos duales se justifican por evidencia |

### 3.4 Integración de APIs (`SOFTWARE_API_INTEGRATION`)

| Campo | Contenido |
|-------|-----------|
| **Propósito** | Representar diseño, consumo e integración de interfaces entre sistemas |
| **Descripción funcional** | Distingue la práctica de integrar/validar información vía APIs respecto del backend genérico |
| **Ejemplos de skills** | APIs REST, Postman |
| **Criterios de pertenencia** | Evidencia de creación, consumo, integración o validación vía APIs |
| **Criterios de no pertenencia** | Framework backend sin mención de integración; UI pura |
| **Relación con otras** | Solapa parcialmente con Backend; en v1.0 se mantiene separada pero puede visualizarse como **Emergente** (§5) cuando la masa de skills es baja |

### 3.5 Cloud y despliegue (`SOFTWARE_CLOUD_DEPLOY`)

| Campo | Contenido |
|-------|-----------|
| **Propósito** | Representar despliegue, hospedaje y operación de software en entornos cloud |
| **Descripción funcional** | Agrupa proveedores cloud, servicios de entrega y contenedores ligados al despliegue |
| **Ejemplos de skills** | Google Cloud Platform, Amazon Web Services, Docker, Azure, S3, CloudFront |
| **Criterios de pertenencia** | Evidencia de despliegue, hosting, CDN, contenedores o plataformas cloud |
| **Criterios de no pertenencia** | Solo listado de vendor sin actividad; desarrollo de features sin despliegue |
| **Relación con otras** | Distinta de «Infraestructura» como área futura; aquí es despliegue **dentro** del desarrollo de software |

### 3.6 Ingeniería y calidad de software (`SOFTWARE_ENGINEERING_QUALITY`)

| Campo | Contenido |
|-------|-----------|
| **Propósito** | Representar prácticas de entrega, control de versiones, agilidad y aseguramiento de calidad |
| **Descripción funcional** | Fusiona ingeniería de entrega y calidad porque, por separado, suelen carecer de masa crítica |
| **Ejemplos de skills** | Git, GitHub, Metodologías Ágiles, Scrum, Pruebas funcionales, Gestión de requerimientos |
| **Criterios de pertenencia** | Prácticas que sostienen cómo se entrega y se valida el software |
| **Criterios de no pertenencia** | Un framework de producto; un proveedor cloud; soft skills de liderazgo |
| **Relación con otras** | Transversal *dentro del dominio técnico* (no confundir con MC2); no es DevOps completo ni QA aislado |

### 3.7 IA aplicada al desarrollo (`SOFTWARE_AI_APPLIED`)

| Campo | Contenido |
|-------|-----------|
| **Propósito** | Representar el uso de inteligencia artificial **como parte del trabajo de software** |
| **Descripción funcional** | Agrupa conocimientos y prácticas de IA ligados a análisis, automatización, reportes o calidad del software |
| **Ejemplos de skills** | Inteligencia Artificial, prompting |
| **Criterios de pertenencia** | Evidencia que conecta IA con el ciclo de desarrollo o producto de software |
| **Criterios de no pertenencia** | Soft skills cognitivas genéricas (“pensamiento crítico”); IA como competencia transversal sin ancla técnica |
| **Relación con otras** | Puede coexistir con Backend/Automatización de negocio, pero no se diluye en “conocimientos varios” |

### 3.8 Concepto oficial: especialidad emergente

Una especialidad **emergente** es una especialidad **oficial del catálogo del dominio** que:

- existe porque hay evidencia real de la actividad profesional;
- aún no reúne masa suficiente (pocas skills, coverage bajo, o dependencia de una sola skill fuerte);
- **no se elimina** del modelo;
- **no se presenta** como eje principal del Explorador hasta cumplir reglas de visualización (§6).

En v1.0, las candidatas naturales a tratarse como emergentes en perfiles delgados son:

- Integración de APIs;
- Cloud y despliegue (cuando el respaldo es mayoritariamente listado);
- IA aplicada (cuando hay strength alto pero cardinality mínima — puede ser eje visible con lectura cautelosa, ver §6).

«Emergente» es un **estado de presentación y madurez**, no un tipo distinto de especialidad.

---

## 4. Reglas para crear una especialidad

Estas reglas aplican a este dominio y son **reutilizables** para futuros dominios.

Una nueva especialidad **puede** incorporarse solo si cumple **todas** las condiciones siguientes:

1. **Actividad profesional reconocible**  
   Responde “¿qué sabe hacer dentro del área?” en lenguaje comprensible para cualquier usuario del sistema (no jerga de vendor).

2. **Agrupación de múltiples skills relacionadas**  
   No se crea una especialidad para una sola tecnología. Se espera un conjunto coherente de skills (orientativamente más de una; idealmente varias con evidencia).

3. **Respaldo de evidencia**  
   Debe existir evidencia documental en al menos parte del conjunto. Una especialidad no nace de un listado vacío de evidencia (`NONE` generalizado).

4. **Estabilidad temporal**  
   Debe permanecer significativa aunque cambien frameworks concretos (p. ej. “Desarrollo frontend” sobrevive si React es reemplazado por otro stack UI).

5. **No es una tecnología**  
   Prohibido: especialidades llamadas “React”, “AWS”, “PostgreSQL”.

6. **No es un soft skill ni un título**  
   Prohibido: “Liderazgo”, “Full Stack”, “Senior Developer”.

7. **No se solapa destructivamente**  
   Si dos especialidades no se pueden distinguir por evidencia ni por pregunta funcional, deben fusionarse (como Ingeniería + Calidad en v1.0).

8. **Justificación de descubrimiento**  
   Toda alta debe documentar evidencia de perfiles reales (mismo método que MC1.1), no checklist aspiracional.

9. **Aprobación de contrato**  
   Incorporar una especialidad implica nueva versión del contrato funcional del dominio (este documento o sucesor).

### 4.1 Cuándo NO crear una especialidad

- Una sola skill con `evidenceLevel = NONE`.
- Un outcome de negocio sin stack (“automatización de procesos”) sin ancla clara.
- Un rol compuesto que solo reúne otras especialidades (“Full Stack”).
- Una moda tecnológica sin actividad profesional estable detrás.

---

## 5. Estados de una especialidad

Estados oficiales del catálogo / presentación:

| Estado | Significado | Efecto en el Explorador |
|--------|-------------|-------------------------|
| **Activa** | Especialidad oficial, madura para el dominio, con masa y evidencia suficientes **en el perfil evaluado** | Puede aparecer como **eje principal** del radar del área |
| **Emergente** | Especialidad oficial del dominio, pero con masa/evidencia insuficiente **en el perfil** (o intrinsicamente delgada en catálogo) | No es eje principal; puede mostrarse atenuada, en sección secundaria, o solo en detalle/auditoría |
| **Experimental** | Candidata en evaluación de producto; aún no congelada en contrato | **No** forma parte del Explorador productivo; solo entornos de diseño/análisis |
| **Inactiva** | Retirada del dominio o reemplazada por fusión/renombre | No aparece; histórico conservado solo para trazabilidad |

### 5.1 Reglas de transición (funcionales)

- Catálogo del dominio → una especialidad nace como **Experimental** o entra directo como oficial tras aprobación de contrato.
- Sobre un **perfil concreto**, una especialidad oficial se evalúa como **Activa** o **Emergente** según Coverage, Confidence y masa de skills (§6–§8).
- **Inactiva** solo por decisión de versión de contrato (fusión, renombre, retiro).

### 5.2 Relación con el piloto Camilo (referencia, no regla hardcodeada)

En el perfil piloto usado para descubrir el dominio:

| Especialidad | Estado de presentación esperado |
|--------------|---------------------------------|
| Desarrollo frontend | Activa (eje por defecto) |
| Desarrollo backend | Activa |
| Bases de datos | Activa |
| Ingeniería y calidad de software | Activa (lectura cautelosa) |
| IA aplicada al desarrollo | Activa con lectura cautelosa (alta evidencia, baja cardinality) |
| Integración de APIs | Emergente |
| Cloud y despliegue | Emergente |

Otros perfiles del mismo dominio pueden producir otra distribución Activa/Emergente sin cambiar el catálogo.

---

## 6. Reglas de visualización (Explorador de Competencias)

Sin diseño de UI. Solo comportamiento esperado.

### 6.1 Navegación canónica

```
Área (Desarrollo de Software)
  → Especialidades del área (radar / lista de ejes)
    → Skills de la especialidad seleccionada
      → Evidencias de la skill
```

### 6.2 Cuándo una especialidad es eje principal (Activa visible)

Debe cumplir, sobre el perfil:

1. pertenecer al catálogo oficial del área;
2. tener al menos una skill mapeada con evidencia distinta de vacío total del conjunto;
3. superar el umbral funcional de Coverage para visibilidad (§7);
4. no estar Inactiva ni Experimental.

### 6.3 Cuándo permanece Emergente

Cuando es oficial del catálogo pero:

- Coverage bajo; o
- muy pocas skills con soporte; o
- dependencia casi exclusiva de una sola skill fuerte sin acompañamiento.

Comportamiento: **no compite visualmente** con los ejes principales; no debe abrirse por defecto.

### 6.4 Cuándo no debe mostrarse

- Estado Inactiva o Experimental.
- Cero skills mapeadas para esa persona en esa especialidad.
- Competencias `TRANSVERSAL_FUTURE` (no son especialidades del área).
- Skills `AMBIGUOUS` no generan eje.

### 6.5 Apertura por defecto

Al entrar al área Desarrollo de Software:

1. Si existe una especialidad Activa con **señal de identidad** del perfil (p. ej. autodefinición + múltiples evidencias STRONG en un saber-hacer), esa se abre.
2. Si no, se abre la especialidad Activa con mejor combinación de Coverage + evidencia sustantiva.
3. Nunca se abre por defecto una Emergente.

Para el piloto de descubrimiento, la especialidad por defecto fue **Desarrollo frontend**. Esa es la regla de referencia del primer Vertical Slice; no es una constante universal para todos los perfiles.

### 6.6 Comportamiento al cambiar de especialidad

- Al seleccionar otro eje Activo: se reemplaza el listado de skills por las de esa especialidad (incluye contribuciones duales con su peso).
- Orden sugerido de skills: mayor respaldo de evidencia primero.
- Al seleccionar una skill: se muestran evidencias y métricas del Evidence Engine.
- Cambiar de especialidad **no** recalcula ni inventa evidencia; solo cambia el filtro de navegación.

### 6.7 Radar del área

- El radar muestra **especialidades**, nunca el área.
- Cada área tiene su propio radar; el número de ejes puede variar entre áreas y entre personas.
- Ejes Emergentes no deben distorsionar la lectura de fortalezas (ocultos o claramente secundarios).

---

## 7. Modelo de Coverage (definición funcional)

### 7.1 Qué representa

**Coverage** mide qué proporción del conjunto de skills asociadas a una especialidad tiene **algún respaldo de evidencia** (no está vacío).

Responde:

> ¿Qué tan “cubierta” está esta especialidad por evidencia real en este perfil?

No responde:

> ¿Qué tan experto es?

### 7.2 Para qué sirve

- Distinguir especialidades con masa respaldada vs especialidades solo listadas.
- Decidir si una especialidad se presenta como Activa o Emergente.
- Evitar que un catálogo amplio proyecte falsa fortaleza.

### 7.3 Cómo debe interpretarlo el usuario

| Lectura | Interpretación esperada |
|---------|-------------------------|
| Coverage alto | Muchas de las skills de la especialidad tienen alguna evidencia |
| Coverage bajo | La especialidad aparece en el CV sobre todo como listado, con pocas pruebas |
| Coverage alto ≠ seniority | Puede haber muchas skills débiles |

### 7.4 Influencia en visualización

- Coverage bajo → favorece estado **Emergente** u ocultamiento del eje.
- Coverage alto → habilita eje **Activo**, sujeto a Confidence y masa mínima.
- Coverage no sustituye la inspección de evidencias por skill.

### 7.5 Relación con la evidencia existente

Coverage se deriva de los resultados del **Evidence Engine por skill** ya calculados.  
No crea evidencia nueva.  
No modifica Extractor, Enrichment ni Evidence Engine.

*(La fórmula exacta se fijará en la fase de implementación; este contrato solo fija el significado.)*

---

## 8. Modelo de Confidence (definición funcional)

### 8.1 Qué representa

**Confidence** expresa qué tanta **confianza metodológica** hay en la evaluación de evidencia de una skill (y, por agregación, de una especialidad).

Responde:

> ¿Qué tan fiable es el respaldo que estamos mostrando?

No responde por sí sola:

> ¿Qué tan fuerte es la competencia?

Eso lo aborda principalmente la fortaleza / nivel de evidencia (`evidenceStrength` / `evidenceLevel`).

### 8.2 Cómo complementa al Coverage

| Señal | Rol |
|-------|-----|
| Coverage | Amplitud: cuántas skills de la especialidad tienen respaldo |
| Strength / Level | Intensidad del respaldo por skill |
| Confidence | Fiabilidad de esa medición |

Una especialidad puede tener Coverage alto con Confidence bajo (muchas señales dudosas) o Coverage medio con Confidence alto (pocas señales pero sólidas).

### 8.3 Cuándo puede afectar la clasificación Activa / Emergente

Confidence baja reiterada en las skills de una especialidad:

- no borra la especialidad del catálogo;
- puede impedir promoverla a eje principal;
- debe invitar a una lectura cautelosa en el Explorador.

Confidence alta en una sola skill **no** convierte automáticamente una especialidad delgada en Activa sin Coverage/masa suficientes — salvo políticas explícitas de producto documentadas (p. ej. IA con evidencia STRONG + educación formal). Cualquier excepción debe declararse en la versión del contrato.

### 8.4 Cómo mostrarlo conceptualmente al usuario

El usuario debe poder entender, sin jerga interna:

- que el sistema distingue “hay evidencia” de “confiamos en cómo se midió”;
- que Confidence no es un diploma ni un nivel laboral;
- que puede mostrarse junto a la evidencia de la skill, no como etiqueta de persona.

---

## 9. Modelo de Evidencias

### 9.1 Cadena oficial

```
Especialidad
    ↓ (agrupa)
Skills mapeadas
    ↓ (sustentan)
Evidence Engine (por skill)
    ↓ (explica)
Ítems documentales del CV (vía Enrichment)
```

### 9.2 Reglas

1. **Única fuente de evidencia:** pipeline existente. El dominio no inventa citas.
2. **La especialidad no tiene evidencia propia atómica:** se sostiene por la evidencia de sus skills.
3. **Sin evidencia suficiente, no hay eje Activo.** La especialidad puede existir en catálogo y aún así presentarse Emergente u oculta.
4. **Prohibida la inferencia:** no se concluye “es arquitecto” porque aparece la palabra Arquitectura en un listado sin respaldo.
5. **Pesos duales:** una skill puede respaldar dos especialidades; la evidencia es la misma, el reparto de contribución es declarativo y justificado.
6. **AMBIGUOUS / TRANSVERSAL_FUTURE:** no alimentan especialidades del dominio.

### 9.3 Principio de existencia

> Una especialidad **oficial** puede existir en el catálogo del dominio.  
> Una especialidad **visible como competencia respaldada** en el Explorador **nunca** existe sin evidencia suficiente en el perfil.

Catálogo ≠ proyección de fortaleza.

---

## 10. Competencias transversales (MC1 vs MC2)

### 10.1 Separación oficial

| Modelo | Contenido | Rol |
|--------|-----------|-----|
| **MC1** | Competencias **profesionales** por área (este documento) | Explorador por dominio técnico/funcional |
| **MC2** | Competencias **transversales** (liderazgo, comunicación, trabajo en equipo, adaptabilidad, etc.) | Futuro modelo transversal, independiente |

### 10.2 Por qué las blandas no entran en Desarrollo de Software

- No responden “qué sabe hacer dentro del desarrollo de software” como especialidad técnica.
- Contaminan el radar del área (como ocurrió en enfoques históricos tipo PA1/PA2 temprano).
- Tienen otro ciclo de vida, otro lenguaje y otra validación.

### 10.3 Tratamiento en este dominio

Toda skill clasificada como transversal se marca conceptualmente como **`TRANSVERSAL_FUTURE`**:

- no mapea a especialidades de Software;
- no aparece como eje del radar de Software;
- queda lista para ingestión futura en MC2 sin reprocesar el área.

### 10.4 Preparación de integración MC2

Cuando exista MC2:

- MC1 y MC2 coexisten como modelos independientes;
- una persona puede navegar área profesional **y** perfil transversal;
- no se fusionan catálogos;
- la evidencia puede ser compartida a nivel skill, pero la clasificación es distinta.

---

## 11. Principios del dominio

Estos principios **no deben romperse**:

1. **Nunca inferir competencias inexistentes.**  
2. **Toda competencia visible debe estar respaldada por evidencia.**  
3. **Las tecnologías no son especialidades.**  
4. **Las especialidades representan actividades profesionales.**  
5. **Las profesiones no son herramientas.**  
6. **El modelo debe ser estable en el tiempo** (sobrevive al cambio de stacks).  
7. **El modelo debe ser extensible a nuevos dominios** sin cambiar la jerarquía Área → Especialidad → Skill → Evidencia.  
8. **PA1, Extractor, Enrichment y Evidence Engine no se alteran** para “arreglar” el dominio; el dominio se adapta a sus salidas.  
9. **El frontend es representación, no fuente de verdad** del modelo.  
10. **Catálogo amplio no autoriza proyección engañosa**; Coverage/Confidence/estados regulan la visualización.  
11. **Soft skills fuera de MC1.**  
12. **Ambigüedades se declaran, no se fuerzan** a una especialidad.  
13. **Cada área tiene su propio radar**; no existe un radar único de toda la persona que mezcle áreas.  
14. **Una skill puede contribuir a más de una especialidad solo con justificación y pesos.**  

---

## 12. Escalabilidad a otros dominios

El contrato de **Desarrollo de Software** es el primer ejemplar de un patrón:

```
Área N
  ├── Especialidades oficiales del área N
  ├── Skills del pipeline clasificadas al área N
  └── Evidencias del Evidence Engine
```

Dominios futuros (sin definirlos aquí), por ejemplo:

- Diseño UX/UI  
- Producción Audiovisual  
- Marketing  
- Ciencia de Datos  
- Infraestructura  
- Gestión de Proyectos  

podrán incorporarse porque:

1. la jerarquía de cuatro niveles es independiente del contenido;
2. las reglas de creación de especialidades (§4) son genéricas;
3. los estados Activa/Emergente/Experimental/Inactiva son genéricos;
4. Coverage/Confidence/Evidencia son conceptos de perfil, no de software;
5. MC2 permanece separado en todos los casos;
6. cada área tendrá su propio contrato funcional (como este) sin modificar los anteriores.

**No se requiere cambiar el Modelo de Competencias** para agregar un área: se agrega un contrato de dominio + clasificación de skills + reglas de visualización del área.

---

## 13. Riesgos identificados y recomendaciones

| Riesgo | Descripción | Recomendación |
|--------|-------------|---------------|
| Especialidades demasiado pequeñas | Integración de APIs / IA con poca cardinality | Mantener en catálogo; presentar como Emergente o con lectura cautelosa; no abrir por defecto |
| Especialidades demasiado amplias | Ingeniería y calidad agrupa entrega + QA | Vigilar en nuevos perfiles; dividir solo si ambos lados ganan masa propia y pregunta distinta |
| Ambigüedades futuras | “Full Stack”, “Arquitectura”, outcomes de negocio | Estado `AMBIGUOUS`; no crear eje; revisar en versiones de contrato |
| Inferencia | Promover Arquitectura u otras por nombre sin evidencia | Principio §11.1; Coverage/Evidence como candado de visualización |
| Crecimiento del catálogo | Proliferación de especialidades por moda tecnológica | Reglas §4; una especialidad = actividad estable, no vendor |
| Falsa fortaleza cloud | Muchas skills cloud con evidencia NONE | Coverage bajo → Emergente/oculto |
| Eje “estrella” por una skill | IA con strength muy alto | Mostrar cardinality y evidencias; no ocultar acompañamiento débil |
| Contaminación transversal | Reintroducir soft skills al radar técnico | MC2 obligatorio; `TRANSVERSAL_FUTURE` |
| Doble conteo histórico | Estilo DIGITAL_TOOLS | Prohibir especialidades comodín; pesos duales solo justificados |
| Confundir catálogo con perfil | “Existe en dominio” ≠ “la persona es fuerte en X” | Separar estado de catálogo vs estado de presentación por perfil |

---

## 14. Clasificación de skills (contrato de estados)

Toda skill evaluada frente a este dominio debe quedar en **exactamente uno** de estos estados de clasificación:

| Estado | Significado |
|--------|-------------|
| `DOMAIN_SPECIALTY` | Pertenece al dominio y mapea a una o más especialidades oficiales |
| `TRANSVERSAL_FUTURE` | Competencia transversal; diferida a MC2 |
| `OUTSIDE_SOFTWARE_DOMAIN` | No pertenece a Desarrollo de Software (otros dominios futuros) |
| `AMBIGUOUS` | No hay especialidad inequívoca sin forzar; no mapea |
| `CATALOG_GAP` | Parece del dominio pero falta especialidad oficial; no se inventa al vuelo — abre proceso de versión de contrato |

---

## 15. Congelamiento v1.0 — checklist de cierre

Al aprobar este documento, el equipo acepta que:

- [ ] El área oficial es **Desarrollo de Software**.
- [ ] Las 7 especialidades de la §3 son la lista oficial v1.0.
- [ ] «Arquitectura» no es especialidad oficial en v1.0.
- [ ] Soft skills quedan fuera (MC2 / `TRANSVERSAL_FUTURE`).
- [ ] Coverage, Confidence y Evidencia se interpretan según §§7–9.
- [ ] El Explorador navega Área → Especialidad → Skill → Evidencia.
- [ ] PA2 se implementará **contra este contrato**, sin reabrir descubrimiento del dominio.
- [ ] Cambios futuros requieren nueva versión de esta especificación.

---

## 16. Relación con la siguiente fase

Tras la aprobación de MC1.2:

| Siguiente trabajo | Qué usa como verdad |
|-------------------|---------------------|
| Catálogo mínimo PA2 del dominio Software | §3 Especialidades oficiales |
| Mappings skill → especialidad | §2, §9, §14 + tablas de MC1.1 |
| Explorador (primer Vertical Slice) | §5, §6, §7, §8 |
| Fuera de discusión | Propósito del dominio, jerarquía, principios, separación MC2 |

**Implementación ≠ redescubrimiento.**  
Cualquier duda arquitectónica sobre este dominio se resuelve leyendo este documento, no reanalizando el CV piloto.

---

## Historial

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0 | 2026-07-27 | Congelamiento inicial a partir de MC1.1 |

**Documento predecesor:** `docs/mc1.1-analisis-dominio-software-camilo.md`  
**Documento sucesor esperado:** implementación PA2 / Explorador (fuera del alcance de MC1.2)
