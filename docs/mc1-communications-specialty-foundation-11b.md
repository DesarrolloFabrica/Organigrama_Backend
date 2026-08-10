# FASE 11B — COMMUNICATIONS SPECIALTY FOUNDATION

**Estado:** COMMUNICATIONS_SPECIALTY_CATALOG_READY  
**Decisión:** COMMUNICATIONS_SPECIALTY_CATALOG_ACCEPTED  
**Catálogo unificado:** `1.6.0` (COMM V1 `1.0.0`)  
**JSON:** `src/mc-pipeline/catalog/mc1-specialties-communications-v1.json`  
**No ejecutado:** P3, P4, regeneración P0/P1/P2, cambios R1, Cloud.

Git-safe. Cohorte 11A = contraste conceptual, no plantilla del catálogo.

---

## 1. Principio taxonómico

```
Professional Field → Specialty → Skill → Tool/Technology
Evidence + Skills → Competency Dimensions → Radar
```

Comunicación = informar, narrar, representar, relacionar.  
No = producir AV; no = marketing de crecimiento; no = diseño visual.

---

## 2. Revisión de granularidad

| candidate | decisión | destino | justificación |
| --- | --- | --- | --- |
| CORPORATE_COMMUNICATIONS | KEEP_AS_SPECIALTY | — | Identidad estable institucional/corporativa |
| DIGITAL_COMMUNICATIONS | KEEP_AS_SPECIALTY | — | Comunicar en canales digitales ≠ Marketing |
| JOURNALISM | KEEP_AS_SPECIALTY | — | Identidad periodística distinta |
| PUBLIC_RELATIONS | KEEP_AS_SPECIALTY | — | Relacionamiento/reputación estable |
| CONTENT_COMMUNICATION | REJECT | — | Genérico (riesgo DIGITAL_CONTENT) |
| ON_CAMERA_PRESENTATION | MOVE_TO_SKILL | oral presentation | Capability transversal, no identidad V1 |
| COPYWRITING | MOVE_TO_SKILL | writing | Craft de escritura |
| COMMUNITY_COMMUNICATION | DEFER / skills | DIGITAL_COMMUNICATIONS | Engagement como skill |
| INTERNAL_COMMUNICATIONS | MERGE_INTO_OTHER_SPECIALTY | CORPORATE_COMMUNICATIONS | Evitar granularidad extra |
| CONTENT_PRESENTER / HOST | REJECT | — | Label de cargo; no Specialty |

### Respuestas críticas

1. **ON_CAMERA_PRESENTATION:** Skill/capability (dimensión oral), no Specialty V1.  
2. **CONTENT_COMMUNICATION:** rechazado (genérico).  
3. **DIGITAL_COMMUNICATIONS vs DIGITAL_MARKETING:** intención comunicar vs crecer/convertir.  
4. **INTERNAL:** absorbido en CORPORATE.  
5. **COPYWRITING:** Skill.  
6. **JOURNALISM:** Specialty con frontera editorial/informativa.

---

## 3. Catálogo Specialty V1

| code | nombre | frontera |
| --- | --- | --- |
| CORPORATE_COMMUNICATIONS | Comunicación corporativa / institucional | ≠ solo PR; ≠ marketing |
| DIGITAL_COMMUNICATIONS | Comunicación digital | ≠ performance marketing |
| PUBLIC_RELATIONS | Relaciones públicas | ≠ solo boletines internos |
| JOURNALISM | Periodismo | ≠ copy comercial; ≠ solo host |

---

## 4. Skills (reservadas / conceptuales)

| concepto | destino |
| --- | --- |
| presentación frente a cámara / conducción / locución | skill → oral |
| entrevista / moderación | skill |
| guion / redacción / storytelling / copywriting | skill → writing |
| vocería | skill → corporate/PR |
| comunicación para redes / adaptación de mensajes | skill → digital |
| planeación de contenidos | skill → planning |
| community engagement / manejo de audiencia | skill → audience |
| cámara / edición / iluminación / post | **otro Field** AV |

---

## 5. Tools (nunca Specialty)

Teleprompter, OBS, cámaras, micrófonos, CapCut, Premiere, Canva, Meta Business Suite, plataformas sociales.

---

## 6. Dimensiones (7)

| code | nombre | decisión |
| --- | --- | --- |
| COMM_MESSAGE_NARRATIVE | Mensaje y narrativa | KEEP |
| COMM_ORAL_PRESENTATION | Comunicación oral / presentación | KEEP |
| COMM_WRITING | Escritura y redacción | KEEP |
| COMM_AUDIENCE_RELATIONS | Relación con audiencias | KEEP |
| COMM_PLANNING | Planeación de comunicación | KEEP |
| COMM_DIGITAL_CHANNELS | Canales digitales | KEEP |
| COMM_SPOKESPERSONSHIP | Vocería / representación | KEEP |

Investigación/contextualización: contribuye vía skills a Mensaje/Escritura (sin eje aparte V1).

`PROFILE_DIMENSIONS_VERSION = 8C.5`

---

## 7. Fronteras

### COMMUNICATIONS ↔ AUDIOVISUAL_PRODUCTION

Presentar/entrevistar/redactar ≠ producir/editar/capturar AV. MULTI_FIELD ok.

### COMMUNICATIONS ↔ DIGITAL_MARKETING

Informar/narrar/relacionar ≠ campañas/conversión/growth/performance.

### COMMUNICATIONS ↔ VISUAL_DESIGN

Comunicar con apoyo visual ≠ diseñar sistemas/piezas visuales.

---

## 8. Contraste 11A (sin P3)

| persona | cobertura | riesgo |
| --- | --- | --- |
| Katherin | COMM secondary sin absorber MKT primary | forzar DIGITAL_COMM como Marketing |
| Danna | CORPORATE/DIGITAL + oral skills; AV secondary | absorber cámara/edición en COMM |
| Linda | COMM amplio + MKT + AV | CONTENT_COMMUNICATION genérico |
| Alejandra | guion/presentación vs AV production | mezclar guion COMM con craft AV |

---

## 9. Riesgos

1. Redes/engagement → Marketing por defecto.  
2. On-camera → Specialty inventada.  
3. CONTENT_COMMUNICATION reaparece.  
4. Absorber AV craft.  
5. PR vs Corporate solapados.  
6. Copywriting como Specialty.  
7. Cargo “Presentador” como evidencia.  
8. Mapper COMM deferred a 11C.

---

## 10. Validaciones

| check | |
| --- | --- |
| catálogo para cohorte | no |
| role como evidencia | no |
| tools → Specialty | no |
| upstream | no |
| Gemini / persistencia / Cloud | no |

## Próxima

**FASE 11C — COMMUNICATIONS SPECIALTY APPLICATION + FOUR PERSON VALIDATION**
