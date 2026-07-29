# MC1.9.1 — Candidate Discovery · Gestión Humana (HUMAN_RESOURCES)

**Fecha:** 2026-07-28  
**Dominio provisional:** `HUMAN_RESOURCES` · estado **DISCOVERED** (sin cambio)  
**Semilla:** LEIDY VIVIANA BERNAL LEÓN · `1070007550` · person_id **1077**  
**Script RO:** `src/database/scripts/mc191-hr-candidate-discovery.ts` · `npm run mc:discover-hr-candidates`  
**Artefacto:** `tmp/mc191-hr-candidates.json`

**Marco:** Domain Blueprint · Specialty Blueprint · guía HR · discovery MC1.9.0 · Manifiesto MC1  
**Principio:** evidence-first · cargo ≠ dominio · coincidencia léxica ≠ pertenencia

---

## 1. Estrategia de búsqueda

1. Universo: personas con `person_cv` activo.  
2. Prioridad: cadena completa (ext→enr→ev).  
3. Ampliación: extracciones SUCCEEDED activas (mayoría del corpus).  
4. Señales: nombres de skills + textos de experiencia/responsabilidad/perfil (no cargo/área como filtro).  
5. Buckets léxicos: TALENT, ORG_DEV, ADMIN_PERSONNEL, SST, PEOPLE_ANALYTICS, QUALITY_BOUNDARY.  
6. Clasificación automática preliminar + **revisión profesional** para finalistas.  
7. Corrección léxica: `formación` no coincide como substring de `información` (FP Software).

---

## 2. Universo consultado

| Métrica | Cantidad |
|---------|----------|
| Personas con CV activo | **126** |
| Extracciones SUCCEEDED activas | **109** |
| Cadenas completas (ext+enr+ev) | **13** (incluye semilla) |
| Candidatos con ≥1 hit de bucket (excl. semilla) | **68** |

**Hallazgo estructural:** el corpus HR está **sub-enriquecido**. Solo ~12 perfiles no-semilla tienen cadena completa; casi todos los candidatos HR útiles están en `EXTRACTION_ONLY`.

---

## 3. Consultas / buckets utilizados

Ver `QUERY_BUCKETS` en el script. Resumen:

| Bucket | Ejemplos de términos |
|--------|----------------------|
| TALENT | selección, reclutamiento, onboarding, talento, desempeño, bienestar, competencias, RRHH |
| ORG_DEV | desarrollo organizacional, gestión del cambio, holocracia |
| ADMIN_PERSONNEL | nómina, contratos laborales, compensación, relaciones laborales |
| SST | SG-SST, riesgos laborales, COPASST, HSEQ |
| PEOPLE_ANALYTICS | people analytics, rotación, ausentismo, headcount |
| QUALITY_BOUNDARY | ISO 9001, auditoría interna, mejora continua, gestión documental |

---

## 4. Candidatos iniciales (muestra depurada ≥10)

Lista profesionalmente depurada a partir del top léxico (68). Se descartan scores inflados por textos genéricos (“equipos multidisciplinarios”, “mejora continua” ágil, “gestión documental” administrativa).

| Persona | Documento | person_id | Evidencia coincidente | Fuente | Fuerza | Hipótesis preliminar (auto→manual) |
|---------|-----------|-----------|----------------------|--------|--------|-------------------------------------|
| Laura Alejandra García | 1000120580 | 50 | Reclutamiento/selección; experiencia en TH | ext skill+texto | Alta (texto laboral) | BORDERLINE→**MATCH** |
| Alberto Mario Valencia | 1082955522 | 1352 | Dirección estratégica TH; selección; cultura; bienestar | ext skill+texto | Alta | BORDERLINE→**MATCH** |
| Lina Marcela Tristancho | 1233497340 | 1201 | Gestión del talento; inducción; evaluación desempeño | ext | Media | BORDERLINE |
| Yuri Astrid Maecha | 1013588273 | 1132 | Inducción/capacitación docentes; cambio org.; riesgos laborales | ext | Media | BORDERLINE |
| María José Algarín | 1068658455 | 1263 | Gestión de nómina; gestión documental | ext | Media-baja | COMPLEMENTARY |
| Yenny Paola Páez | 1013584506 | 1198 | Nómina, contratación, selección + ISO 9001 | ext | Media | COMPLEMENTARY |
| Daniel Mauricio Rodríguez | 1020749844 | 1101 | ISO 9001/14001/OHSAS; auditoría; matrices de riesgo | ext | Alta (calidad) | **OUTSIDE** HSEQ |
| María Paula Montes | 1000047404 | 48 | Gestión documental académica | ext | Baja | OUTSIDE admin |
| Julio Andrés Pamplona | 1015428917 | 1097 | Gestión TH deportiva; SST | ext | Media-baja | COMPLEMENTARY SST |
| Miguel Ángel Hernández | 1030696269 | 1147 | Conocimiento SST + KPIs | ext | Baja | COMPLEMENTARY débil |
| Camilo Quintero | 1000518830 | 1 | *(FP léxico formación⊂información; corregido)* | — | — | **DISCARD** / OUTSIDE Software |
| Diego Raúl García | 1023973897 | — | Texto genérico educativo | ext | Baja (ruido) | DISCARD |
| Jenny Vanessa Segura | 1016081697 | — | Cultura org. + texto genérico | ext | Baja | DISCARD / ruido |
| Andres Camilo Vásquez | 1033768569 | — | Hits talento sin núcleo claro | ext | Baja | INSUFFICIENT |
| Francisco Peña | 1023881860 | — | Gestión documental | ext | Baja | OUTSIDE admin |

---

## 5. Finalistas (corpus de validación)

Selección: **2 MATCH · 2 BORDERLINE · 1 OUTSIDE HSEQ · 1 OUTSIDE técnico · 1 COMPLEMENTARY** (7 perfiles; priorizar 6 en siguiente fase).

### F1 — Laura Alejandra García Sarmiento · `1000120580`

| Campo | Valor |
|-------|-------|
| person_id | 50 |
| Cargo / área (contexto) | Analista de servicio · Homologaciones |
| Cadena | EXTRACTION_ONLY · ext **8** · hash `983432c9…47a0` |
| Práctica preliminar | Reclutamiento y selección / gestión de personal (experiencia TH explícita) |
| Categoría | **POTENTIAL_MATCH** |
| Motivo | Núcleo TH distinto a Leidy (selección operativa vs dirección GH+SST+ISO) |
| Acción | **PROCESS_CHAIN** → USE_AS_MATCH |

### F2 — Alberto Mario Valencia Zableh · `1082955522`

| Campo | Valor |
|-------|-------|
| person_id | 1352 |
| Cargo / área | Coordinador de desarrollo profesional · Prácticas |
| Cadena | EXTRACTION_ONLY · ext **204** · hash `453543fc…6a79` |
| Práctica preliminar | Dirección estratégica del talento humano; selección; cultura; bienestar |
| Categoría | **POTENTIAL_MATCH** |
| Motivo | TH estratégico cercano a Leidy, sin cargo de ops académica |
| Acción | **PROCESS_CHAIN** → USE_AS_MATCH |

### F3 — Lina Marcela Tristancho Gómez · `1233497340`

| Campo | Valor |
|-------|-------|
| person_id | 1201 |
| Cargo / área | Experto modelos evaluación pedagógica · Saber Pro |
| Cadena | EXTRACTION_ONLY · ext **137** |
| Práctica preliminar | Inducción/entrenamiento/desempeño + analítica académica (Excel/R) |
| Categoría | **POTENTIAL_BORDERLINE** (GH vs pedagogía / DI) |
| Motivo | Vocabulario TH en entorno de evaluación educativa |
| Acción | **PROCESS_CHAIN** → USE_AS_BORDERLINE |

### F4 — Yuri Astrid Maecha Garzón · `1013588273`

| Campo | Valor |
|-------|-------|
| person_id | 1132 |
| Cargo / área | Líder · Operación académica |
| Cadena | EXTRACTION_ONLY · ext **55** |
| Práctica preliminar | Inducción/capacitación de docentes; gestión del cambio; formación en riesgos laborales |
| Categoría | **POTENTIAL_BORDERLINE** (ops académica + SST) |
| Motivo | Misma zona gris cargo↔GH que Leidy, con énfasis docente |
| Acción | **PROCESS_CHAIN** → USE_AS_BORDERLINE |

### F5 — Daniel Mauricio Rodríguez Pinzón · `1020749844`

| Campo | Valor |
|-------|-------|
| person_id | 1101 |
| Cargo / área | Líder · Operación académica |
| Cadena | EXTRACTION_ONLY · ext **31** |
| Práctica preliminar | Auditoría interna; ISO 9001/14001/OHSAS; matrices de riesgo |
| Categoría | **POTENTIAL_OUTSIDE** (HSEQ / Quality) |
| Motivo | Calidad/SST de sistemas **sin** ciclo de talento |
| Acción | **PROCESS_CHAIN** → USE_AS_OUTSIDE |

### F6 — Camilo Andrés Quintero Vargas · `1000518830` (referencia OUTSIDE técnico)

| Campo | Valor |
|-------|-------|
| person_id | 1 |
| Cadena | **FULL** (Software seed) |
| Categoría | **POTENTIAL_OUTSIDE** (Software) |
| Motivo | Demuestra FP léxico y frontera tools/datos ≠ People Analytics |
| Acción | **USE_AS_OUTSIDE** (cadena lista; no re-procesar) |

### F7 — María José Algarín Álvarez · `1068658455`

| Campo | Valor |
|-------|-------|
| person_id | 1263 |
| Cargo | Aprendiz |
| Cadena | EXTRACTION_ONLY · ext **166** |
| Práctica preliminar | Gestión de nómina + administración/documental |
| Categoría | **POTENTIAL_COMPLEMENTARY** (admin de personal / nómina) |
| Motivo | Especialidad débil vs núcleo TH de Leidy |
| Acción | **PROCESS_CHAIN** → USE_AS_COMPLEMENTARY |

---

## 6. Comparación con Leidy

| Candidato | Relación con Leidy | Núcleo compartido | Diferencia principal | Utilidad |
|-----------|--------------------|-------------------|----------------------|----------|
| Laura García | Hermano MATCH | Selección / talento | TH operativo de reclutamiento vs dirección GH+SST+ISO | Confirma HR_TALENT sin SST |
| Alberto Valencia | Hermano MATCH | TH estratégico, cultura, bienestar | Menos ISO/SST; más desarrollo profesional | Confirma HR_TALENT / cultura |
| Lina Tristancho | Frontera | Inducción, desempeño | Núcleo pedagógico / evaluación educativa | Frontera DI / pedagogía |
| Yuri Maecha | Frontera | Capacitación equipos; cambio; SST formación | Ops académica + docentes | Frontera OPERATIONS |
| Daniel Rodríguez | Contraste | Sistemas de gestión / riesgos | HSEQ sin talento | OUTSIDE Quality/HSEQ |
| Camilo Quintero | Contraste | Ninguno real | Software; FP léxico | OUTSIDE técnico |
| María José Algarín | Complemento | Personal administrativo | Nómina/admin sin DO/TH senior | COMPLEMENTARY admin |

**Evidencia que Leidy no aporta y sí aportan finalistas:** reclutamiento masivo operativo (Laura); bienestar/cultura como eje (Alberto); frontera pedagógica (Lina); HSEQ puro (Daniel); nómina (María José).

**Evidencia que cuestiona el modelo inicial:** ISO/SST pueden existir **sin** GH (Daniel); inducción/capacitación aparecen en ops académica y pedagogía sin ser dominio GH.

---

## 7. Revisión de especialidades provisionales

| Especialidad | Dictamen MC1.9.1 | Nota |
|--------------|------------------|------|
| **HR_TALENT** | **CONFIRMED_AS_HYPOTHESIS** + **SHOULD_BE_SPLIT** (candidato) | Demasiado amplia: selección, capacitación, desempeño, bienestar. Estructura probable: especialidad “ciclo de talento” con **procesos** (skills), no 6 especialidades. |
| **HR_ORG_DEVELOPMENT** | **NEEDS_MORE_EVIDENCE** | Señal en Alberto/Yuri; mezclar con cultura/cambio sin más perfiles es prematuro. |
| **HR_SST** | **LIKELY_BOUNDARY** | En Leidy va con GH; en Daniel es HSEQ; en Yuri es formación. No auto-incluir en GH. |
| **HR_QUALITY_SYSTEMS** | **LIKELY_OTHER_DOMAIN** | Daniel demuestra Calidad/HSEQ independiente. En Leidy fue experiencia complementaria. |
| **HR_PEOPLE_ANALYTICS** | **NEEDS_MORE_EVIDENCE** / **LIKELY_BOUNDARY** | Lina usa Excel/R en contexto académico; no es people analytics. Dashboards≠dominio. |

### Procesos vs especialidades (estructura más probable)

| Elemento | Lectura provisional |
|----------|---------------------|
| Selección, contratación, inducción, capacitación, evaluación, retiro | **Procesos / skills** del ciclo de vida dentro de HR_TALENT (o sub-agrupaciones) |
| Administración de personal / nómina | Posible **especialidad COMPLEMENTARY** o skills de soporte |
| DO / cambio / cultura | Especialidad o eje, pendiente de más evidencia |
| SST / ISO | **Frontera** hacia HSEQ/Quality; no forzar dentro de GH |

No se cambian códigos en guía más allá de registrar estos dictámenes.

---

## 8. Fronteras prioritarias

| Concepto | Comparte | Diferencia | Evidencia que decide | FP típico |
|----------|----------|------------|----------------------|-----------|
| OPERATIONS (académica) | Capacitación de equipos, liderazgo | Núcleo = operación/servicio académico vs ciclo de talento | Responsabilidades de matrícula/calendario vs selección/desempeño | Cargo “Líder ops” |
| QUALITY_MANAGEMENT | Indicadores, procedimientos | Calidad de procesos ≠ gestión de personas | ISO/auditoría sin TH (Daniel) | “mejora continua” ágil |
| HSEQ / SST | Riesgos, matrices | SST puede ser disciplina propia | OHSAS/ISO14001 sin GH | Especialización SST en CV GH |
| DATA_ANALYTICS | Indicadores, dashboards | Analítica general ≠ people analytics | Excel/R académico (Lina); SQL (Camilo) | “analítica” + “talento” genérico |
| INSTRUCTIONAL_DESIGN | Capacitación, inducción | Pedagogía/diseño de aprendizaje ≠ TH | Evaluación pedagógica (Lina) | “formación” / “capacitación” |
| ORGANIZATIONAL_PSYCHOLOGY | Clima, cultura, competencias | Puede solaparse con DO | *(sin perfil claro aún)* | Soft skills listing |
| LABOR_RELATIONS | Contratos, disciplina | Jurídico/laboral vs GH general | *(sin perfil claro aún)* | “contratos” administrativos |

---

## 9. Score de utilidad (0–18)

| Candidato | Núcleo 0–3 | Evidencia 0–3 | Diversidad 0–3 | Especialidades 0–3 | Fronteras 0–3 | Cadena 0–3 | **Total** |
|-----------|------------|---------------|----------------|--------------------|---------------|------------|-----------|
| Laura García | 3 | 2 | 3 | 3 | 2 | 1 | **14** |
| Alberto Valencia | 3 | 2 | 2 | 3 | 2 | 1 | **13** |
| Daniel Rodríguez | 3 (HSEQ) | 3 | 3 | 2 | 3 | 1 | **15** |
| Lina Tristancho | 2 | 2 | 3 | 2 | 3 | 1 | **13** |
| Yuri Maecha | 2 | 2 | 2 | 2 | 3 | 1 | **12** |
| María José Algarín | 2 | 2 | 3 | 2 | 2 | 1 | **12** |
| Camilo Quintero | 3 (SW) | 3 | 3 | 1 | 3 | 3 | **16** |

---

## 10. Lista priorizada

| Prioridad | Documento | Nombre | Categoría | Utilidad | Cadena lista | Acción siguiente |
|-----------|-----------|--------|-----------|----------|--------------|------------------|
| 1 | 1000120580 | Laura A. García | MATCH | 14 | No | **PROCESS_CHAIN** |
| 2 | 1082955522 | Alberto M. Valencia | MATCH | 13 | No | **PROCESS_CHAIN** |
| 3 | 1020749844 | Daniel M. Rodríguez | OUTSIDE HSEQ | 15 | No | **PROCESS_CHAIN** |
| 4 | 1233497340 | Lina M. Tristancho | BORDERLINE | 13 | No | **PROCESS_CHAIN** |
| 5 | 1013588273 | Yuri A. Maecha | BORDERLINE | 12 | No | **PROCESS_CHAIN** |
| 6 | 1068658455 | María J. Algarín | COMPLEMENTARY | 12 | No | **PROCESS_CHAIN** |
| 7 | 1000518830 | Camilo Quintero | OUTSIDE Software | 16 | **Sí** | **USE_AS_OUTSIDE** |

**No procesar** en bloque: Diego García, Jenny Segura y similares (ruido léxico).

---

## 11. Recomendación de siguiente fase (MC1.9.2)

1. Completar cadena **solo** de prioridades 1–6 (con aprobación explícita).  
2. Dry-run documental / evidencia comparada vs Leidy (aún **sin** pack/PA2).  
3. Decidir si `HR_QUALITY_SYSTEMS` sale del dominio y si SST es frontera HSEQ.  
4. Mantener dominio **DISCOVERED** hasta ≥2 MATCH con cadena completa + 1 OUTSIDE HSEQ validado.

---

## 12. Verificaciones

| Check | Resultado |
|-------|-----------|
| Búsqueda sobre evidencia profesional | Sí |
| ≥10 candidatos iniciales | Sí (68 hits; 15 depurados en tabla) |
| Finalistas con evidencia +/− | Sí |
| ≥1 OUTSIDE | Sí (Daniel HSEQ + Camilo Software) |
| Cadenas completadas sin aprobación | **No** |
| Persistencia PA2 / mappings | **No** |
| Dominio sigue DISCOVERED | **Sí** |
| Cambios funcionales | Solo script RO + comando npm |

---

**Veredicto fase:** **GO**

El corpus permite validar Gestión Humana **sin** construirla alrededor de Leidy, pero exige procesar cadenas: hoy casi todos los MATCH/BORDERLINE útiles están en extracción sola.
