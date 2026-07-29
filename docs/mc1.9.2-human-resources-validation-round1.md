# MC1.9.2 — Gestión Humana · Candidate Chain Completion & Validation Round 1

**Fecha:** 2026-07-28  
**Dominio provisional:** `HUMAN_RESOURCES` (Gestión Humana)  
**Estado dominio (persistido / guía):** **DISCOVERED**  
**Recomendación documental de avance:** **no PROTOTYPE_READY** (falta segundo MATCH puro + ajustes de definición)  
**PA2 / catálogo / mapping pack:** **no ejecutados · no persistidos**  
**Script:** `npm run mc:validate-hr-round1` · `src/database/scripts/mc192-hr-validation-round1.ts`  
**Artefactos:** `tmp/mc192-hr-validation-final.json` · `tmp/mc192-hr-quality-summary.json`

---

## 0. Alcance y restricciones cumplidas

| Restricción | Cumplido |
|-------------|----------|
| Solo 6 documentos autorizados + refs Leidy/Camilo | Sí |
| Sin PA2 | Sí |
| Sin catálogo / mappings / aliases | Sí |
| Sin evaluación de dominio persistida | Sí |
| Sin inferir desde cargo/área | Sí |
| SST / Calidad / dashboards no auto-HR | Sí |
| No forzar 2 MATCH si evidencia no respalda | Sí (Laura degradada) |

**Documentos procesados:** `1000120580`, `1082955522`, `1233497340`, `1013588273`, `1020749844`, `1068658455`  
**Referencias (sin re-procesar):** `1070007550` (Leidy), `1000518830` (Camilo)

---

## 1. Auditoría previa → post

### 1.1 Tabla inicial (pre-enrichment)

| Documento | Persona | CV | Extraction | Enrichment | Evidence | Acción requerida |
|-----------|---------|----|------------|------------|----------|------------------|
| 1000120580 | Laura A. García (50) | activo 58 | **8** SUCCEEDED | — | — | NEED_ENRICHMENT |
| 1082955522 | Alberto M. Valencia (1352) | **inactivo** 168 | **204** SUCCEEDED | — | — | NEED_CV → luego enrichment |
| 1233497340 | Lina M. Tristancho (1201) | activo 129 | **137** SUCCEEDED | — | — | NEED_ENRICHMENT |
| 1013588273 | Yuri A. Maecha (1132) | activo 99 | **55** SUCCEEDED | — | — | NEED_ENRICHMENT |
| 1020749844 | Daniel M. Rodríguez (1101) | activo 112 | **31** SUCCEEDED | — | — | NEED_ENRICHMENT |
| 1068658455 | María J. Algarín (1263) | activo 136 | **166** SUCCEEDED | — | — | NEED_ENRICHMENT |

**Nota Alberto:** `person_cv` 168 estaba `is_active=false` (synced_at alineado con sync Drive 2026-07-24; md5 nulo; `drive_file_id` presente). Extracción 204 SUCCEEDED activa apuntaba a 168. No se re-extrajo. El CV quedó activo antes de enrichment (reactivación justificada / concurrencia); cadena final alineada cv **168** → ext **204**.

**Regla aplicada:** se reutilizaron extracciones SUCCEEDED activas; no se reemplazaron.

### 1.2 Cadenas finales

| Documento | Persona | CV | Ext | Enr | Ev | Alineada | Estado |
|-----------|---------|----|-----|-----|----|----------|--------|
| 1000120580 | Laura | 58 | 8 | **16** | **16** | Sí | COMPLETE |
| 1082955522 | Alberto | 168 | 204 | **17** | **17** | Sí | COMPLETE |
| 1233497340 | Lina | 129 | 137 | **18** | **18** | Sí | COMPLETE |
| 1013588273 | Yuri | 99 | 55 | **19** | **19** | Sí | COMPLETE |
| 1020749844 | Daniel | 112 | 31 | **20** | **20** | Sí | COMPLETE |
| 1068658455 | María José | 136 | 166 | **21** | **21** | Sí | COMPLETE |

**Cadenas completadas:** 6  
**Bloqueos:** 0  

**Warnings técnicos:** hash vivo ≠ extracción en Laura, Lina, Yuri, Daniel (enrichment vinculado al hash de extracción; PDF vivo analizado). Alberto y María José sin mismatch.

---

## 2. Calidad de cada cadena

| Persona | Cats | Skills | Tools | Methods | Soft | STRONG | MOD | WEAK | NONE | Calidad HR | Notas |
|---------|------|--------|-------|---------|------|--------|-----|------|------|------------|-------|
| Laura | 4 | 13 | 1 | 0 | 4 | 0 | 5 | 3 | 5 | **LOW / INSUFFICIENT** | Skills TH solo listing (`ONLY_SKILLS_SECTION`); núcleo evidenciado = admin/docs |
| Alberto | 4 | 14 | 0+IA | 0 | 1 | 0 | 6 | 5 | 3 | **MEDIUM** | TH con work MODERATE; top = prácticas educativas |
| Lina | 4 | 11 | 0 | 1 | 1 | 0 | 3 | 2 | 6 | **LOW** (para HR) | Núcleo psicometría/evaluación; `Gestión del talento` NONE |
| Yuri | 4 | 14 | 3 | 2 | 3 | 0 | 6 | 3 | 5 | **MEDIUM** (frontera) | Capacitación + cambio + riesgos + ops académica |
| Daniel | 3 | 15 | 2 | 3 | 1 | 0 | 2 | 8 | 5 | **LOW** (cadena) / **útil OUTSIDE** | Inventario HSEQ/BI; ISO/OHSAS WEAK listing |
| María José | 4 | 21 | 4 | 0 | 6 | 0 | 2 | 13 | 6 | **LOW** | Nómina/seguridad social WEAK; soft MODERATE |
| Leidy (ref) | 5 | 27 | 3 | 3 | 10 | 1 | 4 | 10 | 12 | **MEDIUM-HIGH** | SG-SST STRONG 79; TH/DO MODERATE |
| Camilo (ref) | — | — | — | — | — | — | — | — | — | N/A HR | OUTSIDE Software (cadena previa) |

**Señales infladas por listas:** Laura (reclutamiento/gestión personal); Lina (gestión del talento); Daniel (ISO/OHSAS en listing); María José (nómina débil vs listing admin).

---

## 3. Lectura profesional individual

### 3.1 Laura Alejandra García Sarmiento · `1000120580`

| Campo | Lectura |
|-------|---------|
| Práctica principal | Gestión documental / administrativa de servicio |
| Problemas que resuelve | Digitalización, indexación, agendas, atención |
| Responsabilidades | Operación documental y de servicio |
| Entregables | Documentos digitalizados, agendas |
| Nucleares evidenciadas | Análisis de datos, digitalización, indexación, agendas (MODERATE) |
| Complementarias / listing | Reclutamiento y selección (WEAK listing); reclutamiento masivo / gestión personal (NONE) |
| Tools | Ofimática (WEAK) |
| Disciplina probable | Administración / servicio |
| Claridad del núcleo | Media-alta hacia admin; **baja hacia GH** |
| Tipo perfil | **PROFESSIONAL_TRANSITION** o admin con vocabulario TH residual |
| vs HUMAN_RESOURCES | **INSUFFICIENT** (no MATCH) |

### 3.2 Alberto Mario Valencia Zableh · `1082955522`

| Campo | Lectura |
|-------|---------|
| Práctica principal | Gestión de prácticas profesionales + dirección de talento (híbrido) |
| Problemas | Empleabilidad/prácticas; selección; cultura |
| Nucleares | Prácticas (MOD 63); Dirección estratégica TH (MOD 59); selección/cultura (MOD 40) |
| Complementarias | Acreditación calidad; convenios; IA (tool) |
| Disciplina | Multidisciplinar: TH + gestión educativa/prácticas |
| Tipo | **MULTIDISCIPLINARY** |
| vs HUMAN_RESOURCES | **MATCH** (con reserva: no es GH “puro”) |

### 3.3 Lina Marcela Tristancho Gómez · `1233497340`

| Campo | Lectura |
|-------|---------|
| Práctica principal | Evaluación pedagógica / psicometría / instrumentos de medición |
| Nucleares | Análisis cuantitativo/cualitativo; diseño de instrumentos (MODERATE) |
| HR listing | Gestión del talento NONE; desempeño organizacional WEAK |
| Disciplina | Pedagogía / evaluación educativa / DI |
| Tipo | **SPECIALIST** (evaluación educativa) |
| vs HUMAN_RESOURCES | **BORDERLINE** (frontera DI/pedagogía) |

### 3.4 Yuri Astrid Maecha Garzón · `1013588273`

| Campo | Lectura |
|-------|---------|
| Práctica principal | Operación académica + capacitación de equipos + riesgos laborales |
| Nucleares | Gestión académica/admin; capacitación; riesgos laborales; cambio org. (MODERATE) |
| Tools | Zoho WEAK; Teams/CRM NONE |
| Disciplina | Operaciones académicas con overlapping GH/SST |
| Tipo | **MULTIDISCIPLINARY** |
| vs HUMAN_RESOURCES | **BORDERLINE** |

### 3.5 Daniel Mauricio Rodríguez Pinzón · `1020749844`

| Campo | Lectura |
|-------|---------|
| Práctica principal | Calidad / HSEQ / analítica (inventario) con evidencia aplicada débil en ISO |
| Nucleares inventariadas | ISO 9001, OHSAS, auditoría, matrices, BI/tools |
| Evidencia top | Data mining / análisis de datos (MODERATE) — no people analytics |
| Disciplina | HSEQ / Quality / Data |
| Tipo | **SPECIALIST** (calidad/sistemas) con mezcla datos |
| vs HUMAN_RESOURCES | **OUTSIDE** |

### 3.6 María José Algarín Álvarez · `1068658455`

| Campo | Lectura |
|-------|---------|
| Práctica principal | Administración operativa con señales de nómina/seguridad social |
| Nucleares candidatas | Gestión de nómina, liquidación seguridad social (WEAK + responsabilidad) |
| Soft | Organización, comunicación (MODERATE) |
| Tools | SIIGO, MaGister, WhatsApp (WEAK) — no definen la práctica |
| Distinción contabilidad | Facturación electrónica NONE; SIIGO puede ser contable/admin |
| Distinción admin genérica | Nómina + seguridad social como eje diferenciador débil |
| Tipo | **GENERALIST_WITHIN_DISCIPLINE** (admin de personal junior) |
| vs HUMAN_RESOURCES | **COMPLEMENTARY** |

---

## 4. Validación conceptual vs HUMAN_RESOURCES

| Persona | Clasificación | Evidencia a favor | Evidencia en contra | Riesgo FP | Confianza |
|---------|---------------|-------------------|---------------------|-----------|-----------|
| Leidy `1070007550` | **MATCH** (semilla) | TH MOD; DO MOD; ciclo talento; onboarding/desempeño en CV | STRONG es SG-SST; ISO MOD; cargo ≠ GH | Absorber HSEQ por semilla | Media-alta |
| Laura `1000120580` | **INSUFFICIENT** | Skills nominales de reclutamiento | Solo listing; núcleo admin evidenciado | Activar HR_TALENT por lista | Alta (en el no-MATCH) |
| Alberto `1082955522` | **MATCH** | Dirección TH, selección, cultura con work | Top = prácticas educativas; IA listing | Contaminar GH con ops prácticas | Media |
| Lina `1233497340` | **BORDERLINE** | Vocabulario desempeño/talento | Núcleo evaluación pedagógica; talento NONE | Capacitación/desempeño → HR | Alta frontera |
| Yuri `1013588273` | **BORDERLINE** | Capacitación equipos; cambio org. | Núcleo ops académica; riesgos ≠ TH | Ops + SST → HR | Media |
| Daniel `1020749844` | **OUTSIDE** | — | ISO/OHSAS/auditoría sin ciclo talento | Calidad/SST → HR | Alta |
| María José `1068658455` | **COMPLEMENTARY** | Nómina + seguridad social | Evidencia WEAK; soft genéricas | Admin/SIIGO → HR | Media-baja |
| Camilo `1000518830` | **OUTSIDE** | — | Software; datos/tools sin personas | Dashboards → People Analytics | Alta |

**MATCH defendibles en ronda:** Leidy + Alberto (1 híbrido). **No** Laura.

---

## 5. Comparación con Leidy

| Perfil | Coincidencia con Leidy | Diferencia principal | Aporte al dominio | Riesgo |
|--------|------------------------|----------------------|-------------------|--------|
| Laura | Léxico selección/talento | Sin práctica TH evidenciada | Antipatron: listing ≠ MATCH | Ampliar dominio por skills list |
| Alberto | TH estratégico, selección, cultura | Menos SST/ISO; más prácticas/educación | Confirma TH sin HSEQ | Híbrido prácticas |
| Lina | Inducción/desempeño léxico | Pedagogía/psicometría | Frontera DI | FP capacitación |
| Yuri | Capacitación, cambio, riesgos | Ops académica dominante | Frontera OPERATIONS/SST | Misma zona gris cargo |
| Daniel | Sistemas/riesgos léxico | HSEQ sin personas | OUTSIDE Calidad | Meter ISO en HR |
| María José | Administración de personas | Nómina junior vs dirección GH | COMPLEMENTARY nómina | SIIGO/admin |
| Camilo | Ninguna real | Software | OUTSIDE tools/datos | People Analytics por tools |

**Vocabulario nuevo vs Leidy:** reclutamiento operativo (nominal Laura); prácticas profesionales (Alberto); psicometría/instrumentos (Lina); Zoho/CRM ops (Yuri); OHSAS/ISO14001-like HSEQ puro (Daniel); nómina/SIIGO/seguridad social (María José).

**Señales que deben permanecer fuera:** ISO/auditoría genérica; dashboards/BI/Python/Tableau; evaluación pedagógica; gestión académica; ofimática sola; soft skills sin contexto TH.

---

## 6. Auditoría de especialidades provisionales

| Especialidad | Decisión | Madurez máx. recomendada | Motivo |
|--------------|----------|--------------------------|--------|
| **HR_TALENT** | **REFINE** (mantener amplia; no split prematuro) | **SUPPORTED** (doc) | Leidy+Alberto; procesos como skills |
| **HR_ORG_DEVELOPMENT** | **KEEP** / más evidencia | **EMERGENT** | DO Leidy; cultura Alberto; cambio Yuri — poca diversidad |
| **HR_SST** | **MOVE_TO_BOUNDARY** | **RESERVED** | STRONG en Leidy ≠ pertenencia automática; Daniel OUTSIDE |
| **HR_QUALITY_SYSTEMS** | **REMOVE** del núcleo HR | **DEPRECATED** (en HR) | Daniel demuestra disciplina distinta; en Leidy fue complemento |
| **HR_PEOPLE_ANALYTICS** | **INSUFFICIENT_EVIDENCE** | **HYPOTHESIS** | Nadie con rotación/ausentismo/headcount real; tools ≠ PA |
| **Nómina / admin personal** (conceptual) | **KEEP** como COMPLEMENTARY | **EMERGENT** | María José; no código definitivo |

### 6.1 HR_TALENT — ¿split?

| Agrupación conceptual | Lectura |
|-----------------------|---------|
| HR_TALENT_ACQUISITION | Práctica diferenciable (selección) — skill/proceso dentro de TALENT |
| HR_LEARNING_DEVELOPMENT | Diferenciable pero solapa pedagogía/DI — **frontera**; no especialidad aún |
| HR_PERFORMANCE | Proceso/skill (desempeño) |
| HR_WELLBEING_CULTURE | Señal en Alberto (cultura MOD; bienestar WEAK) — puede convivir en TALENT/OD |
| HR_PERSONNEL_ADMINISTRATION | Cercano a nómina/COMPLEMENTARY |
| HR_COMPENSATION_PAYROLL | Ver §8 |

**Decisión:** no crear códigos de split. Mantener **HR_TALENT** como especialidad mayor; procesos = skills.

### 6.2 HR_ORG_DEVELOPMENT

Evidencia de clima/cultura/cambio/estructura/engagement/EX/DO/competencias: **parcial** (cultura Alberto; DO/competencias Leidy; cambio Yuri). Distinguir de capacitación (Yuri/Lina), bienestar (débil), calidad (Daniel), planeación estratégica genérica.

→ Mantener **EMERGENT**; no promover.

### 6.3 HR_SST · perfil 1020749844

| Pregunta | Respuesta |
|----------|-----------|
| ¿SG-SST en núcleo GH? | **No automáticamente** |
| ¿Especialidad compartida? | Posible frontera compartida GH↔HSEQ |
| ¿Principalmente HSEQ? | En Daniel **sí** |
| ¿Frontera? | **Sí — MOVE_TO_BOUNDARY** |
| ¿En Leidy? | Experiencia **fuerte** pero puede ser **complementaria/senior mix**, no definición del dominio |

### 6.4 HR_QUALITY_SYSTEMS

ISO 9001 / auditoría / mejora / SGC / procedimientos / documental: en Daniel = disciplina Calidad; en Leidy = complemento GH.  
→ **REMOVE** del núcleo HR (o **MOVE_TO_BOUNDARY** hacia dominio Quality futuro).

### 6.5 HR_PEOPLE_ANALYTICS

Sin evidencia de rotación, ausentismo, headcount, indicadores de selección/formación, predictivo o segmentación de talento.  
Excel/R (Lina académico), Power BI/Tableau (Daniel), dashboards (Leidy WEAK) **no** cuentan.  
→ Permanecer **HYPOTHESIS**.

---

## 7. Nómina y administración de personal · `1068658455`

| Pregunta | Respuesta |
|----------|-----------|
| ¿Nómina especialidad independiente? | **Candidata COMPLEMENTARY**, no núcleo GH todavía |
| ¿Agrupar con compensación? | Provisionalmente **sí** a nivel conceptual (payroll/comp) |
| ¿Agrupar con admin laboral? | **Sí** en “Administración de personal y nómina” |
| Distinción contabilidad | Seguridad social + nómina vs solo facturación/SIIGO contable |
| Distinción admin genérica | Ciclo de pagos/aportes de personas |
| Skills nucleares | Gestión de nómina; liquidación seguridad social (aún WEAK) |
| Tools sin definir práctica | SIIGO, MaGister, WhatsApp, ofimática |
| Nombre conceptual (sin código) | **Administración de personal y nómina** |

---

## 8. Perfiles BORDERLINE (fronteras)

### Lina `1233497340`

- Disciplina principal: **evaluación pedagógica / psicometría**
- Comparte con GH: léxico desempeño/talento (no evidenciado)
- FP: “formación”, “desempeño”, “talento”, e-learning → HR_L&D
- Excluir de mappings futuros: instrumentos de medición académicos, psicometría educativa, juego serio, diseño tecno-pedagógico sin contexto de colaboradores

### Yuri `1013588273`

- Disciplina principal: **operación académica / gestión administrativa educativa**
- Comparte: capacitación de equipos; cambio organizacional; riesgos laborales (formación)
- FP: capacitación + liderazgo + SST → HR
- Excluir: gestión académica, trade marketing, CRM/Zoho ops sin contexto TH

---

## 9. Perfiles OUTSIDE (evidencia negativa)

### Daniel HSEQ `1020749844`

Términos compartidos con GH: SST/OHSAS, capacitación (e-learning NONE), indicadores/datos, auditoría, riesgos, cumplimiento.  
**Núcleo HSEQ/Quality/Data**, no ciclo de talento: ausencia total de selección/onboarding/desempeño/bienestar de personas.

### Camilo Software `1000518830`

Confirma: dashboards, datos, herramientas, automatización, indicadores **no** activan People Analytics ni GH sin contexto profesional de personas.

---

## 10. Definición revisada del dominio (provisional)

**Gestión Humana** es la práctica de **atraer, incorporar, desarrollar, evaluar, compensar administrativamente y retener colaboradores**, y de **diseñar sistemas de personas** (competencias, cultura, desarrollo organizacional) cuando la evidencia muestra **aplicación profesional sobre el ciclo de vida del colaborador**.

| Pertenece | No pertenece |
|-----------|--------------|
| Selección, inducción, desempeño, desarrollo, cultura/bienestar de colaboradores | Calidad/HSEQ como disciplina (ISO/auditoría/OHSAS sin TH) |
| DO / cambio / competencias (con evidencia) | Pedagogía / evaluación educativa / DI |
| Dirección de TH | Operación académica genérica |
| Nómina/admin de personal como **complemento** | Software, BI, dashboards sin contexto de personas |
| | Soft skills o listados de skills sin aplicación |

**Relación estrategia–operación:** perfiles senior (Leidy/Alberto) mezclan dirección TH con otras disciplinas; el prototipo debe exigir evidencia de **práctica de personas**, no de cargo.

**Definición:** **requiere ajustes** (quitar sobrepeso SST/ISO de la semilla; no tratar listing como MATCH).

---

## 11. Vocabulario consolidado (no persistido)

| Concepto | Tipo | Personas | Fuerza | Especialidad probable | Riesgo |
|----------|------|----------|--------|----------------------|--------|
| Gestión del talento humano | CORE | Leidy, Alberto | MOD | HR_TALENT | Medio |
| Selección de personal | CORE | Alberto (Laura listing) | MOD / WEAK | HR_TALENT | FP listing |
| Cultura organizacional | CORE | Alberto | MOD | TALENT / OD | Bajo |
| Desarrollo organizacional | CORE | Leidy | MOD | HR_ORG_DEVELOPMENT | Medio |
| Onboarding / desempeño | SUPPORTING | Leidy | WEAK | HR_TALENT | Listing |
| Capacitación de equipos | AMBIGUOUS | Yuri | MOD | frontera L&D/ops | Alto FP |
| Evaluación pedagógica / instrumentos | OUTSIDE | Lina | MOD | DI/pedagogía | Alto |
| SG-SST / OHSAS | AMBIGUOUS→OUTSIDE | Leidy STRONG; Daniel WEAK | — | BOUNDARY HSEQ | Crítico |
| ISO 9001 / SGC / auditoría | OUTSIDE | Leidy MOD; Daniel WEAK | — | Quality | Alto |
| Gestión de nómina / seguridad social | SUPPORTING / COMPLEMENTARY | María José | WEAK | Admin personal | Medio |
| Dashboards / Power BI / Tableau / Python | TOOL / OUTSIDE | Leidy, Daniel, Camilo | WEAK/NONE | ≠ People Analytics | Alto |
| Analítica de datos (genérica) | AMBIGUOUS | Laura, Daniel, Lina | MOD | Data | Alto |
| SIIGO / MaGister / ofimática | TOOL | María José, Laura | WEAK | — | Tool-led |
| Soft skills (liderazgo, empatía…) | TRANSVERSAL | varios | — | MC2 | No activan HR |

---

## 12. Matriz general de perfiles

| Persona | Clasificación | Núcleo profesional | Especialidad probable | Cadena | Calidad | Confianza |
|---------|---------------|--------------------|----------------------|--------|---------|-----------|
| Leidy `1070007550` | MATCH | GH + SST senior | HR_TALENT (+ SST boundary) | FULL | MEDIUM-HIGH | Media-alta |
| Laura `1000120580` | INSUFFICIENT | Admin / documental | — | FULL 8/16/16 | LOW | Alta (no-MATCH) |
| Alberto `1082955522` | MATCH | TH + prácticas | HR_TALENT | FULL 204/17/17 | MEDIUM | Media |
| Lina `1233497340` | BORDERLINE | Evaluación pedagógica | — (frontera DI) | FULL 137/18/18 | LOW→HR | Alta frontera |
| Yuri `1013588273` | BORDERLINE | Ops académica + capacitación | frontera OD/SST | FULL 55/19/19 | MEDIUM | Media |
| Daniel `1020749844` | OUTSIDE | HSEQ / Quality / Data | — | FULL 31/20/20 | LOW cadena | Alta OUTSIDE |
| María José `1068658455` | COMPLEMENTARY | Admin + nómina junior | Admin personal/nómina | FULL 166/21/21 | LOW | Media-baja |
| Camilo `1000518830` | OUTSIDE | Software | — | FULL (previa) | N/A | Alta |

---

## 13. Estado del dominio (Domain Blueprint)

| Criterio PROTOTYPE_READY | ¿Cumple? |
|--------------------------|----------|
| ≥2 MATCH defendibles | **Parcial** (Leidy + Alberto híbrido; Laura falló) |
| ≥1 BORDERLINE útil | Sí (Lina, Yuri) |
| ≥1 OUTSIDE claro | Sí (Daniel, Camilo) |
| Definición estable | **No** — requiere ajustes |
| Núcleo especialidades defendible | Parcial (TALENT sí; OD débil; SST/Quality fuera) |
| Fronteras identificadas | Sí |
| Tools ≠ skills | Sí |
| Sin contradicciones críticas | **No** — semilla STRONG en SST; MATCH candidatos frágiles |

→ **Permanecer DISCOVERED**.  
→ **No** recomendar PROTOTYPE_READY todavía.

---

## 14. Madurez de especialidades (Specialty Blueprint · máx. SUPPORTED)

| Especialidad | Estado | Evidencia | Diversidad | Fronteras | FP | Siguiente gate |
|--------------|--------|-----------|------------|-----------|-----|----------------|
| HR_TALENT | **SUPPORTED** (rec. doc.) | Leidy+Alberto MOD work | 2 perfiles | vs ops/prácticas/listing | skills list | +1 MATCH puro selección/ciclo |
| HR_ORG_DEVELOPMENT | **EMERGENT** | Leidy DO; Alberto cultura; Yuri cambio | Baja | vs L&D/ops | cambio genérico | +1 perfil DO claro |
| HR_SST | **RESERVED** (boundary) | Leidy STRONG; Daniel OUTSIDE | Conflicto | HSEQ | auto-HR | Decisión dominio HSEQ |
| HR_QUALITY_SYSTEMS | **DEPRECATED** en HR | Daniel OUTSIDE | — | Quality | ISO→HR | No mapear en pack HR |
| HR_PEOPLE_ANALYTICS | **HYPOTHESIS** | Ninguna real | 0 | Data/BI | tools | Perfil con KPIs de personas |
| Admin personal / nómina (conceptual) | **EMERGENT** | María José WEAK | 1 | Contabilidad/admin | SIIGO | +1 perfil nómina MOD+ |

**No declarar STABLE ni CONSOLIDATED.**

---

## 15. Riesgos y próximos pasos

### Riesgos

1. Construir el dominio alrededor de Leidy (SST/ISO).  
2. Tratar Alberto como MATCH puro sin acotar prácticas educativas.  
3. Activar mappings por listing (Laura).  
4. Incluir Quality/SST automáticamente.  
5. People Analytics por tools.

### Próximos pasos (MC1.9.3 sugerido)

1. Buscar **≥1 MATCH adicional** de selección/ciclo de talento con evidencia MODERATE+ en work (no listing).  
2. Opcional: 1 perfil nómina más fuerte.  
3. Redactar definición v0.2 sin SST/Quality en núcleo.  
4. Solo entonces diseñar prototipo (catálogo + pack + PA2).

---

## 16. Verificación final

| Check | Resultado |
|-------|-----------|
| Solo 6 docs procesados | Sí |
| Cadenas completas o bloqueos documentados | 6/6 completas |
| Sin PA2 | Sí |
| Sin evaluaciones persistidas de dominio | Sí |
| Leidy semilla intacta | Sí |
| Positivos y negativos | Sí |
| SST/Calidad como frontera | Sí |
| Nómina evaluada profesionalmente | Sí |
| People Analytics no por tools | Sí |
| Dominio no STABLE/CONSOLIDATED | Sí |

---

## 17. Entregable final — resumen ejecutivo

| Ítem | Valor |
|------|-------|
| Cadenas completadas | **6** |
| Bloqueos | **0** |
| MATCH | `1082955522` Alberto (+ semilla Leidy `1070007550`) |
| BORDERLINE | `1233497340` Lina · `1013588273` Yuri |
| OUTSIDE | `1020749844` Daniel · `1000518830` Camilo |
| COMPLEMENTARY | `1068658455` María José |
| INSUFFICIENT | `1000120580` Laura |
| Definición del dominio | **requiere ajustes** |
| Especialidades recomendadas | HR_TALENT **SUPPORTED**; HR_ORG_DEVELOPMENT **EMERGENT**; Admin/nómina conceptual **EMERGENT** |
| Retiradas / frontera | HR_QUALITY_SYSTEMS **REMOVE/DEPRECATED**; HR_SST **MOVE_TO_BOUNDARY/RESERVED**; HR_PEOPLE_ANALYTICS **HYPOTHESIS** |
| Nómina | COMPLEMENTARY · especialidad conceptual “Administración de personal y nómina” |
| SST | Frontera GH↔HSEQ · no auto-HR |
| Quality Systems | Fuera del núcleo HR |
| People Analytics | Sin evidencia profesional |
| Estado del dominio | **DISCOVERED** |
| Persistencia dominio/PA2/pack | **no** |
| Veredicto | **GO CON AJUSTES** |

**Conclusión:** la hipótesis de Gestión Humana **se sostiene** frente a diversidad MATCH/BORDERLINE/OUTSIDE/COMPLEMENTARY, pero **aún no** tiene diversidad MATCH suficiente ni definición estable para diseñar el prototipo técnico sin sobreajustar a Leidy.

---

**Documento:** MC1.9.2 · Validation Round 1 · HUMAN_RESOURCES · 2026-07-28
