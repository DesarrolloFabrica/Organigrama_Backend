# MC1.9.0 — Exploración transversal · perfil 1070007550

**Fecha:** 2026-07-28  
**Documento:** `1070007550`  
**Modo:** evidence-first · sin PA2 · sin catálogo nuevo  
**Artefactos:** `tmp/mc190-audit-1070007550.json` · `tmp/cv-skills/1070007550.json` · `tmp/cv-skills-enrichment/1070007550-e1-20260728-105121.json` · `tmp/cv-evidence/enrichment-15-er2-20260728-105209.json`

**Principio aplicado:** no se preguntó “¿en qué dominio cabe?” sino “¿qué práctica profesional demuestra la evidencia?”.

---

## 1. Auditoría de identidad

| Campo | Valor |
|-------|-------|
| person_id | **1077** |
| Nombre | LEIDY VIVIANA BERNAL LEÓN |
| Documento | 1070007550 |
| Correo institucional | leidy_bernal@cun.edu.co |
| Correo | vivianabernalleon@gmail.com |
| Cargo / rol Cloud | COODINADOR OPERATIVO ACADEMICO |
| Área | OPERACION ACADEMICA |
| Escuela / programa | *(no reportado en person)* |
| Jefe inmediato | RAUL VALENCIA CIFUENTES · COORDINADOR GENERAL OPERACIONES |
| Estado activo | **Sí** |
| CV activo | **Sí** · person_cv_id=**182** |
| drive_file_id | `1U6ZiTmtxDA_kg9yx_APfku55Ro89c87I` |
| Archivo | `1070007550.pdf` |
| drive_md5 | `64c301da4a4c75715c2d074b275e3730` |
| synced_at | 2026-07-24 |

> El cargo y el área **no** se usan como evidencia profesional principal. Se registran solo para contexto organizacional y para detectar riesgo de contaminación cargo→dominio.

---

## 2. Cadena CV

### 2.1 Estado inicial (pre-MC1.9.0)

| Etapa | Estado |
|-------|--------|
| person | OK |
| person_cv | OK (182) |
| cv_extraction | **Ausente** |
| enrichment | Ausente |
| evidence | Ausente |

### 2.2 Completitud realizada en esta fase

| Etapa | ID | Detalle |
|-------|-----|---------|
| Extracción | **217** | Prompt `c2.1-2026-07-24` · Extractor `1.1.0` · modelo `gemini-3.6-flash` · 27 skills · **nueva** (no había SUCCEEDED previa) |
| Enrichment | **15** | SUCCEEDED · is_active=true · 27/27 |
| Evidence | **15** | er2 · SUCCEEDED · is_active=true · levels **1 STRONG / 4 MODERATE / 10 WEAK / 12 NONE** |
| source_hash (pdf_sha256) | `d25e6375a97f4e0b4394523ae893fcfb4961fff123310860542d93832c44e532` | |

**Cadena:** **completa** y alineada (cv 182 → ext 217 → enr 15 → ev 15).

**Por qué se generó extracción nueva:** no existía ninguna extracción para este person_id. No se reemplazó SUCCEEDED previo.

**PA2:** no ejecutado · no persistido.

---

## 3. Lectura profesional neutral

### 3.1 Práctica profesional principal

La evidencia del CV describe una práctica recurrente de **gestión humana integral**:

- planeación estratégica del talento a nivel nacional;
- diseño de modelo de competencias;
- selección, contratación, onboarding y evaluación de desempeño;
- desarrollo organizacional;
- indicadores de rotación, ausentismo y desempeño;
- dirección de áreas de Gestión Humana y SST;
- implementación de sistemas de calidad (ISO 9001:2015);
- uso de dashboards / IA **aplicados a optimizar gestión del talento**.

**Problemas que resuelve:** atraer/retener/desarrollar personas; alinear talento a objetivos; medir clima laboral operativo (rotación/ausentismo/desempeño); sostener cumplimiento de calidad y SST.

**Entregables:** modelos de competencias; procesos de ciclo de vida del colaborador; cuadros de indicadores; certificación ISO; sistemas SG-SST; dashboards de talento.

**Criterio profesional (no tools):** diseño de procesos de talento, modelo de competencias, planeación estratégica de TH, liderazgo de áreas de GH.

**Tools / tecnología de apoyo:** dashboards, ofimática, “HR Tech” (listing), IA aplicada a RRHH (WEAK, una responsabilidad).

### 3.2 Trayectoria

**Clasificación:** **GENERALISMO DENTRO DE UNA DISCIPLINA** (Gestión Humana), con **señal de transición organizacional** hacia operación académica.

| Señal | Lectura |
|-------|---------|
| Cargos CV: Directora GH / DO; Directora Nacional GH y SST | Núcleo histórico en Gestión Humana |
| Responsabilidades de ciclo de talento + indicadores | Especialización amplia dentro de TH |
| ISO / riesgos / SST | Extensiones frecuentes del rol GH senior, no dominio distinto por sí solas |
| “+1000 docentes / 80 administrativos” | Contexto de impacto en entorno educativo |
| Cargo Cloud actual: Coordinador Operativo Académico | Posible transición; **no** domina la evidencia CV |

### 3.3 Núcleo vs señales secundarias

| Capa | Contenido |
|------|-----------|
| **NÚCLEO PROFESIONAL** | Gestión del talento humano; desarrollo organizacional; ciclo de vida del colaborador (selección–onboarding–desempeño); planeación estratégica de TH; indicadores de gestión de personas |
| **CAPACIDADES COMPLEMENTARIAS** | SG-SST; sistemas de calidad ISO; gestión de riesgos; liderazgo de equipos |
| **TOOLS** | Dashboards analíticos; ofimática; HR Tech (listing) |
| **METODOLOGÍAS** | Gestión por competencias; holocracia; ISO 9001:2015 |
| **TRANSVERSALES** | Comunicación, negociación, empatía, adaptabilidad, etc. (casi todas NONE) |
| **SEÑALES SECUNDARIAS** | Operación académica / impacto en docentes; analítica de talento (listing); IA en RRHH (WEAK) |
| **FUERA DEL NÚCLEO** | Software engineering; diseño visual; producción audiovisual |

---

## 4. Inventario de evidencia (selección relevante)

| Evidencia | Texto fuente (resumen) | Tipo | Fuerza | Confianza | Contexto | Interpretación |
|-----------|------------------------|------|--------|-----------|----------|----------------|
| SG-SST | Directora Nacional GH y SST + especialización SG-SST | PROFESSIONAL_SKILL | STRONG 79 | 0.86 | EXPERIENCIA + EDUCACIÓN | Especialidad fuerte dentro/adyacente a GH |
| ISO 9001:2015 | Implementación SGC y migración ISO sin NC | METHOD | MODERATE 50 | 0.58 | EXPERIENCIA | Entregable de calidad asociado a rol gerencial |
| Indicadores de gestión | Cuadro de indicadores; rotación/ausentismo/desempeño | PROFESSIONAL_SKILL | MODERATE 48.5 | 0.86 | EXPERIENCIA | Núcleo de medición de TH |
| Gestión del talento humano | Planeación estratégica TH nacional | PROFESSIONAL_SKILL / DOMAIN_SIGNAL | MODERATE 47 | 0.53 | EXPERIENCIA + PERFIL | **Núcleo** (confianza media por ambigüedad textual) |
| Desarrollo organizacional | Cargo Directora GH y DO | PROFESSIONAL_SKILL / RESPONSIBILITY | MODERATE 40 | 0.86 | EXPERIENCIA | Núcleo DO |
| Modelo de competencias | Diseño del modelo + indicadores | METHOD | WEAK 34 | 0.53 | EXPERIENCIA | Ciclo TH |
| Onboarding / selección / desempeño | Procesos bajo holocracia | PROFESSIONAL_SKILL / METHOD | WEAK 34 | — | EXPERIENCIA | Ciclo TH |
| Holocracia | Modelo de evaluación/selección | METHOD | WEAK 34 | 0.86 | EXPERIENCIA | Método de org design |
| Dashboards / IA RRHH | Herramientas para optimizar talento | TOOL / TECHNOLOGY | WEAK 34–37 | 0.86 | EXPERIENCIA | Apoyo; no definen profesión |
| Analítica de datos TH | Mención perfil + skills | PROFESSIONAL_SKILL | NONE 0 | 0.42 | PERFIL / LISTING | Señal débil |
| Soft skills varias | Solo skills section | TRANSVERSAL | NONE | 0.42 | LISTING | No aportan dominio |
| HR Tech / Auditoría HSEQ | Solo listing | TOOL / AMBIGUOUS | NONE | — | LISTING | No generalizar |

---

## 5. Hipótesis profesionales (pre-catálogo)

### Hipótesis 1 — Gestión Humana / Talento Humano

- **A favor:** planeación TH nacional; modelo de competencias; ciclo selección–onboarding–desempeño; cargos de Directora GH; indicadores de rotación/ausentismo; DO explícito.
- **En contra:** cargo actual es operación académica; conf. media en “Gestión del talento” por evidencia corta/genérica.
- **Confianza:** **alta**

### Hipótesis 2 — Sistemas de Gestión (Calidad + SST)

- **A favor:** SG-SST STRONG; ISO MODERATE con logro de certificación; gestión de riesgos.
- **En contra:** aparecen embebidos en roles de Gestión Humana (“Directora Nacional de GH y SST”); no hay trayectoria exclusiva de auditor/consultor de calidad.
- **Confianza:** **media** (mejor como especialidades dentro de GH o dominio hermano futuro)

### Hipótesis 3 — Operación académica / coordinación académica

- **A favor:** cargo Cloud; liderazgo con impacto en docentes; área OPERACION ACADEMICA.
- **En contra:** el CV no centra entregables de operación académica (calendarios, matrícula, programación, etc.); la evidencia profesional dominante es GH.
- **Confianza:** **baja** como núcleo; **media** como señal secundaria / transición

---

## 6. Comparación con dominios existentes

*(Solo después de la lectura neutral.)*

| Dominio | Clasificación | Evidencia coincidente | No coincidente | Riesgo FP |
|---------|---------------|----------------------|----------------|-----------|
| **SOFTWARE** | **OUTSIDE** | Ninguna skill de desarrollo | No hay lenguajes, frameworks, APIs, cloud engineering | IA/dashboards no deben mapear a SOFTWARE_AI |
| **VISUAL_DESIGN** | **OUTSIDE** | Ninguna | No hay diseño gráfico, identidad, editorial, UI | Ninguno relevante |
| **AUDIOVISUAL_PRODUCTION** | **OUTSIDE** | Ninguna | No hay edición, motion, post, NLE | Ninguno relevante |

**Tools compartidas:** ofimática / dashboards — genéricas; no activan dominios creativos ni software.

**Dry-run PA2:** no necesario para el diagnóstico de frontera (ausencia total de vocabulario de los tres dominios).

---

## 7. Decisión de ruta

### **Ruta C — Posible dominio nuevo**

La práctica principal es **diferenciable**, no cabe de forma limpia en SOFTWARE / VISUAL_DESIGN / AUDIOVISUAL_PRODUCTION, tiene vocabulario propio (talento, competencias, onboarding, DO, SG-SST, ISO en contexto GH), responsabilidades recurrentes y entregables propios.

| Campo | Valor |
|-------|-------|
| Nombre provisional | **Gestión Humana** |
| Código provisional | `HUMAN_RESOURCES` |
| Estado | **DISCOVERED** |
| Alternativa | DOMAIN_HYPOTHESIS si se exige ≥2 perfiles antes de guía — **no**: hay núcleo defendible en 1 perfil; se declara DISCOVERED con vacíos explícitos |

**No es Ruta A:** no coincide con dominios implementados.  
**No es Ruta B:** no es expansión de Visual/AV/Software.  
**No es Ruta D:** hay núcleo identificable (GH), no mezcla sin centro.  
**No es Ruta E:** hay evidencia suficiente de práctica profesional.

---

## 8. Especialidades provisionales

| Especialidad provisional | Evidencia | Estado sugerido | Distinción | Vacíos |
|--------------------------|-----------|-----------------|------------|--------|
| **HR_TALENT** — Gestión del talento / ciclo de vida | Planeación TH; selección; onboarding; desempeño; indicadores | **EMERGENT** | Práctica de personas, no de sistemas de calidad | 1 perfil; conf. media en skill nominal |
| **HR_ORG_DEVELOPMENT** — Desarrollo organizacional | Cargo DO; holocracia; modelo de competencias | **EMERGENT** | Diseño de org/procesos vs operación diaria de TH | Poca diversidad de formulaciones |
| **HR_SST** — SG-SST | STRONG 79; cargo GH y SST; especialización | **EMERGENT** | Cumplimiento SST vs calidad ISO vs TH | ¿Separar o subsumir en GH? |
| **HR_QUALITY_SYSTEMS** — Sistemas de gestión de calidad | ISO 9001 implementación | **HYPOTHESIS / RESERVED** | Puede ser dominio Calidad futuro | 1 logro; frontera con Calidad |
| **HR_PEOPLE_ANALYTICS** — Analítica de talento | Dashboards WEAK; analítica NONE | **HYPOTHESIS** | Datos de personas vs BI genérico | Evidencia insuficiente |

Ninguna → SUPPORTED / STABLE / CONSOLIDATED.

---

## 9. Vocabulario inicial (candidatos)

### CORE PROFESSIONAL SKILLS (CANDIDATE)

- gestión del talento humano  
- desarrollo organizacional  
- evaluación del desempeño  
- onboarding  
- planeación estratégica del talento  
- indicadores de gestión (de personas)  
- modelo / gestión por competencias  

### SUPPORTING SKILLS (CANDIDATE)

- gestión de riesgos  
- liderazgo de equipos (cuando contextualizado en área GH)  

### TOOLS (CANDIDATE)

- dashboards analíticos  
- ofimática  
- sistemas HR Tech  

### METHODS (CANDIDATE)

- holocracia  
- ISO 9001:2015 / sistemas de gestión de calidad  
- gestión por competencias  

### TRANSVERSALS

- comunicación asertiva, negociación, empatía, adaptabilidad, etc. → MC2  

### DELIVERABLES (CANDIDATE)

- modelo de competencias  
- cuadro de indicadores de TH  
- certificación ISO  
- procesos de selección/contratación/onboarding  

### AMBIGUOUS

- “analítica de datos” sin contexto de talento  
- “inteligencia artificial” sin vínculo RRHH  
- “planificación estratégica” genérica  

### OUTSIDE

- desarrollo de software; diseño visual; audiovisual; pedagogía DI / SCORM  

**Aliases / mappings:** no creados (solo candidatos documentales).

---

## 10. Fronteras

| Frontera | Veredicto | Criterio |
|----------|-----------|----------|
| vs SOFTWARE | **NO PERTENECE** | No construye software; dashboards/IA son medios para TH |
| vs VISUAL_DESIGN | **NO PERTENECE** | Sin piezas gráficas / identidad / editorial |
| vs AUDIOVISUAL | **NO PERTENECE** | Sin timeline / motion / post |
| vs Operación académica | **ZONA GRIS** | Cargo actual + impacto en docentes; núcleo CV es GH |
| vs Calidad / HSEQ puro | **ZONA GRIS** | ISO/SST fuertes pero embebidos en GH |
| vs “Multimedia / Integral” | **NO crear** | Prohibido como catch-all |

**Tools que podrían FP:** Excel/dashboards/Power BI genéricos; “IA”; “gestión” aislada; “liderazgo”.

**Términos demasiado genéricos:** gestión, operaciones, estrategia, analítica, calidad (sin contexto).

**Responsabilidades que demuestran la disciplina:** diseño de procesos de talento; modelo de competencias; planeación TH; indicadores de rotación/ausentismo/desempeño; dirección de GH.

---

## 11. Calidad como semilla

| Criterio | Evaluación |
|----------|------------|
| Claridad del núcleo | Alta (GH) |
| Riqueza de evidencia | Media-alta (responsabilidades concretas) |
| Recurrencia | Alta en ciclo TH |
| Separación profesión/tools | Buena (tools WEAK/listing) |
| Contaminación otros dominios | Baja vs Software/Visual/AV; media vs Operación académica (cargo) |
| Especialidades extraíbles | Sí (talento, DO, SST) |
| Calidad CV | Buena, con soft skills listing |

**Clasificación:** **USABLE_SEED**

No STRONG_SEED porque: (1) un solo perfil; (2) SG-SST puede sesgar el primer pack; (3) cargo actual ≠ núcleo CV; (4) varias skills núcleo aún WEAK/MODERATE con ambigüedad.

---

## 12. Perfiles adicionales requeridos

| Tipo | Perfil buscado |
|------|----------------|
| **MATCH** | Otro perfil GH con ciclo de talento + indicadores, **sin** cargo de operación académica |
| **MATCH** | Perfil GH senior con herramientas distintas (ATS/HRIS nombrados, sin “IA” genérica) |
| **BORDERLINE** | Coordinador académico operativo con poca evidencia de TH (valida frontera cargo≠dominio) |
| **OUTSIDE** | Perfil Calidad/HSEQ puro sin GH |
| **OUTSIDE** | Perfil Software o Visual con dashboards (anti-FP tools) |
| **COMPLEMENTARY_SPECIALTY** | Especialista SST de planta / auditor ISO sin rol de talento |
| **COMPLEMENTARY_SPECIALTY** | People analytics / HRBP con analítica MODERATE+ |

---

## 13. Riesgos

1. Forzar dominio por cargo Cloud (Operación Académica) → falso dominio académico.  
2. Sobreajustar pack a SG-SST (STRONG por educación + título) y descuidar ciclo de talento.  
3. Crear dominio “Calidad” prematuro solo por ISO.  
4. Mapear dashboards/IA a SOFTWARE.  
5. Declarar SUPPORTED con un solo perfil.

---

## 14. Recomendación

1. Documentar dominio **`HUMAN_RESOURCES` (Gestión Humana)** en estado **DISCOVERED**.  
2. No implementar catálogo/pack/PA2 en esta fase.  
3. Próxima fase: Discovery ampliado / Knowledge Expansion con ≥1 MATCH adicional antes de Prototype.  
4. Mantener Operación Académica como **hipótesis de dominio distinto** solo si aparecen perfiles con núcleo operativo académico (no este caso como semilla primaria).

---

## 15. Verificaciones

| Check | Resultado |
|-------|-----------|
| Usuario localizado | Sí · 1077 |
| Cadena completa | Sí · 182/217/15/15 |
| Lectura antes de mappings | Sí |
| Separación skills/tools/métodos | Sí |
| Comparación 3 dominios | Sí · todos OUTSIDE |
| Ruta A–E | **C** |
| Persistencia PA2 | **No** |
| Packs/catálogos mutados | **No** |
| Manifiesto | Creado y enlazado |

---

**Discovery:** MC1.9.0 · 1070007550 · Ruta C · HUMAN_RESOURCES DISCOVERED · 2026-07-28
