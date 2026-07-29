# MC1.5.1 — Descubrimiento de dominio · documento 1015482688

**Modo:** descubrimiento / solo lectura.  
**No se crearon** tablas, seeds, códigos canónicos, mappings, PA2 ni frontend.

Artefacto JSON: `tmp/cv-attributes/mc1.5.1-1015482688-profile-audit.json`

---

## 1. Identidad mínima

| Campo | Valor |
|-------|-------|
| personId | 1163 |
| Documento | 1015482688 (único, activo) |
| Nombre | NIDIA MARCELA PRADA RAMIREZ |
| Correo institucional | nidia_prada@cun.edu.co |
| Rol | ANALISTA DE DISEÑO DE CONTENIDOS |
| Área | FABRICA Y DESARROLLO |
| Escuela | DESARROLLO |
| Programa | — |
| En organigrama activo | Sí |
| Jefe inmediato | Vacante de coordinación Fábrica de Contenidos (relación org presente) |

Identidad única verificada: **1** persona con ese documento. Sin duplicados.

---

## 2. Pipeline

| Etapa | Existe | Estado | Activa | ID |
|-------|--------|--------|--------|-----|
| CV | Sí | ACTIVE | Sí | person_cv **7** (`1015482688.pdf`) |
| Extraction | Sí | SUCCEEDED | Sí | **87** (9 skills) |
| Extraction (reintento) | Sí | FAILED | No | 88 (idempotencia vs 87) |
| Enrichment | No | — | — | — |
| Evidence evaluation | No | — | — | — |
| PA2 | No | — | — | — |

**Decisión de procesamiento:** `REUSE_EXISTING_EXTRACTION` (id=87).  
No se re-extrajo ni se ejecutó enrichment/evidence/PA2 (requieren confirmación y, para Software, no aplican).

CV sincronizado 2026-07-24; documento en `person_cv` coincide con 1015482688; `drive_file_id` presente.

---

## 3. Extracción utilizada (PA1)

- **extractionId:** 87  
- **Skills totales:** 9  

### Por tipo

| Tipo | Cantidad |
|------|----------|
| PROFESSIONAL_KNOWLEDGE | 6 |
| TECHNOLOGY | 1 |
| METHODOLOGY | 1 |
| SOFT_SKILL | 1 |

### Por categoría del extractor

| Categoría | Cantidad |
|-----------|----------|
| Diseño y Producción Visual | 4 |
| Inteligencia Artificial | 2 |
| Estrategia y Marketing | 2 |
| Liderazgo y Gestión | 1 |

### Skills (evidencia en CV, no inferidas por cargo)

1. Liderazgo creativo  
2. Diseño editorial  
3. Diseño instruccional  
4. Diseño publicitario  
5. Edición audiovisual  
6. Optimización de prompts  
7. Pensamiento estratégico en diseño  
8. Planificación de contenido  
9. Inteligencia Artificial  

Idiomas / certificaciones en extracción: ninguno listado.

---

## 4. Relación con dominio SOFTWARE

**Resultado: `DOMAIN_DISCOVERY_REQUIRED`**

Evidencia:

- **0** mappings activos hacia especialidades Software.
- **0** clasificaciones `mc_skill_domain_classification` para Software.
- **0** hits de keywords técnicas Software (JS, React, Node, SQL, etc.).

El rol organizacional (diseño de contenidos) **coincide** con las skills, pero la clasificación se basa en la hoja de vida, no en el cargo.

**No ejecutar PA2 Software.**  
La API de competencias Software debe permanecer **NOT_EVALUATED** para esta persona (salvo definición explícita de producto).

### Parte H — No forzar Software

Verificado que **no** ocurrió:

- mapear ofimática → Ingeniería y calidad  
- liderazgo → Backend  
- gestión de proyectos → Cloud  
- comunicación → APIs  
- automatización/IA genérica → IA aplicada Software  
- clasificar solo por cargo  
- rellenar especialidades para evitar radar vacío  

Skills transversales (liderazgo, pensamiento estratégico, IA genérica) **no** se empujaron al heptágono Software.

---

## 5. Agrupaciones profesionales observadas

| Agrupación | Skills |
|------------|--------|
| Diseño de contenidos / visual | Diseño editorial, publicitario, instruccional |
| Producción audiovisual | Edición audiovisual |
| Estrategia de contenido | Planificación de contenido, pensamiento estratégico en diseño |
| IA aplicada a contenidos | Inteligencia Artificial, optimización de prompts |
| Liderazgo creativo | Liderazgo creativo (transversal) |

---

## 6. Área y especialidades candidatas (propuesta de descubrimiento)

**Área candidata (nombre de trabajo):**  
`CONTENT_DESIGN` — Diseño y producción de contenidos

**Especialidades candidatas (no canónicas todavía):**

1. Diseño editorial y publicitario  
2. Diseño instruccional / aprendizaje  
3. Producción audiovisual  
4. Estrategia y planificación de contenidos  
5. IA para creación de contenidos (emergente / parcial)

**Skills transversales:** liderazgo creativo, pensamiento estratégico.  
**Ambiguas:** “Inteligencia Artificial” / “Optimización de prompts” (podrían vivir en un dominio IA general o como especialidad de contenidos).  
**Fuera de Software:** la totalidad del set actual.  
**Huecos de catálogo:** no existen especialidades MC para diseño de contenidos; faltan mappings y clasificaciones de dominio.

---

## 7. Recomendación para siguiente fase

1. **No** crear todavía seeds/códigos/PA2 del nuevo dominio.  
2. Abrir fase de modelado (p. ej. MC1.5.2) para catálogo `CONTENT_DESIGN` tras validación de producto.  
3. Opcional: enrichment + evidence **solo** cuando exista dominio/mappings; no aporta un radar Software vacío.  
4. En Explorador: mantener persona sin área Software evaluada; evitar forzar default SOFTWARE.

---

## 8. Confirmaciones

- Perfil **no** forzado a Desarrollo de Software.  
- Extracción 87 reutilizada; **sin** escrituras de pipeline en esta fase.  
- Documento de descubrimiento únicamente.
