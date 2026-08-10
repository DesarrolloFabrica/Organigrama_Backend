# FASE 10B — AUDIOVISUAL PRODUCTION SPECIALTY FOUNDATION

**Estado:** AUDIOVISUAL_SPECIALTY_CATALOG_READY  
**Decisión:** AUDIOVISUAL_SPECIALTY_CATALOG_ACCEPTED  
**Catálogo unificado:** `1.5.0` (AV V1 `1.0.0`)  
**JSON:** `src/mc-pipeline/catalog/mc1-specialties-audiovisual-production-v1.json`  
**No ejecutado:** P3, P4, regeneración P0/P1/P2, cambios R1, Cloud, Publisher.

Git-safe. La cohorte 10A (Santiago / Juan Pablo / Camilo Ramírez) es **contraste conceptual**, no plantilla del catálogo.

---

## 1. Principio taxonómico

```
Professional Field → Specialty → Skill → Tool/Technology
Evidence + Skills → Competency Dimensions → Radar
```

| Nivel | Pregunta |
| --- | --- |
| Specialty | ¿Qué tipo reconocible de profesional audiovisual representa esta práctica? |
| Skill | ¿Qué sabe hacer concretamente dentro de esa práctica? |
| Dimension | ¿En qué aspecto de la práctica AV se concentra la evidencia? |

No convertir cada actividad audiovisual en Specialty.

---

## 2. Revisión de granularidad

| candidate | decisión | destino | justificación |
| --- | --- | --- | --- |
| VIDEO_PRODUCTION | KEEP_AS_SPECIALTY | — | Identidad estable de producción/realización de video |
| VIDEO_POST_PRODUCTION | KEEP_AS_SPECIALTY | — | Identidad estable de edición/montaje/acabado; skills internas (edit, color, compose) |
| MOTION_GRAPHICS | MOVE_TO_OTHER_FIELD | VISUAL_DESIGN → MOTION_DESIGN | Evitar duplicar motion-as-design |
| ANIMATION | DEFER | futuro / borde VD | AE/Blender no definen Specialty; frontera con Motion Design |
| PHOTOGRAPHY | KEEP_AS_SPECIALTY | — | Identidad fotográfica profesional (≠ cámara ocasional en rodaje) |
| AUDIO_PRODUCTION | KEEP_AS_SPECIALTY | — | Audio al servicio de piezas AV; no Field musical ahora |
| LIVE_PRODUCTION | DEFER | skills bajo VIDEO_PRODUCTION | Streaming/multicam aún sin masa de identidad V1 |
| CONTENT_PRODUCTION | REJECT | — | Genérico; contamina Marketing/Comms/VD/AV |
| AUDIOVISUAL_DIRECTION | DEFER | capability avanzada | No inferir por cargo; capa senior, no Specialty V1 |
| CINEMATOGRAPHY | MERGE_INTO_OTHER_SPECIALTY | VIDEO_PRODUCTION | Lenguaje de cámara/luz como craft/skills |

### Fronteras internas

**Video production:** identidad de producir/realizar piezas de video. Actividades puntuales (grabar, operar cámara, iluminar, editar) = Skills.

**Post-production:** Specialty propia cuando la práctica dominante es edición/acabado. Edición, montaje, color, composición, finishing = Skills bajo esa Specialty (no Specialties independientes).

**Motion:** `VISUAL_DESIGN` → `MOTION_DESIGN` = diseñar en movimiento. AV no reintroduce motion graphics. Editar video sin diseño en movimiento ≠ Motion Design.

**Photography:** práctica fotográfica profesional vs uso de cámara en producción de video.

**Audio:** audio para productos AV vs ingeniería musical (futuro Field posible; no crear ahora).

**Direction:** capability avanzada dentro de producción; no Specialty V1.

**Content production:** rechazado.

---

## 3. Catálogo Specialty V1 recomendado

| code | nombre | definición | frontera |
| --- | --- | --- | --- |
| VIDEO_PRODUCTION | Producción de video | Producir/realizar piezas de video como práctica dominante | ≠ solo post; ≠ solo foto; ≠ motion de diseño |
| VIDEO_POST_PRODUCTION | Postproducción de video | Editar/montar/acabar video como práctica dominante | ≠ solo rodaje; ≠ Motion Design |
| PHOTOGRAPHY | Fotografía | Fotografía profesional como identidad | ≠ cámara ocasional en video |
| AUDIO_PRODUCTION | Producción de audio audiovisual | Audio para piezas AV | ≠ mastering musical como Field propio |

Aliases legacy PA2: `AV_PRODUCTION`→VIDEO_PRODUCTION, `AV_EDITING`/`AV_POST`→VIDEO_POST_PRODUCTION, `AV_PHOTOGRAPHY`→PHOTOGRAPHY, `AV_SOUND`→AUDIO_PRODUCTION. `AV_MOTION` **no** se reintroduce en AV.

---

## 4. Conceptos movidos a Skill

| concepto | destino | razón |
| --- | --- | --- |
| video editing / non-linear editing | skill → VIDEO_POST_PRODUCTION | capacidad concreta de montaje |
| camera operation | skill → VIDEO_PRODUCTION | operar cámara ≠ Specialty |
| lighting | skill → VIDEO_PRODUCTION / dim Captura | craft de captura |
| color correction / color grading | skill → VIDEO_POST_PRODUCTION | finishing, no Specialty |
| audio editing / sound design | skill → AUDIO_PRODUCTION | craft de audio AV |
| storyboarding / script development | skill → VIDEO_PRODUCTION | preproducción |
| streaming / multicamera | skill → VIDEO_PRODUCTION (V1) | live diferido como Specialty |
| compositing / VFX | skill → VIDEO_POST_PRODUCTION | no Specialty V1 independiente |
| encoding / export / technical delivery | skill / dim Entrega | entrega técnica |

---

## 5. Tools / Technologies (nunca Specialty)

Premiere Pro, After Effects, DaVinci Resolve, Audition, Photoshop, Illustrator, Blender, OBS, CapCut, Final Cut, Avid, cámaras específicas, codecs específicos.

La herramienta no decide Field ni Specialty.

---

## 6. Dimensiones de radar (7)

No coinciden 1:1 con Specialties. Objetivo: radars distintos bajo el mismo Field/Specialty.

| code | nombre | definición | decisión |
| --- | --- | --- | --- |
| AV_PREPRODUCTION | Preproducción | Planificación, guion, storyboard | KEEP |
| AV_CAPTURE | Captura | Cámara, toma, iluminación en captura | KEEP |
| AV_PRODUCTION_REALIZATION | Producción / realización | Coordinar/realizar la producción | KEEP |
| AV_EDITING_MONTAGE | Edición / montaje | Timeline, ritmo, estructura | KEEP |
| AV_VISUAL_FINISHING | Acabado visual | Color, composición/VFX liviano | KEEP (separado de edición) |
| AV_AUDIO | Audio | Captación/edición/diseño sonoro AV | KEEP |
| AV_DELIVERY | Entrega / publicación | Export, formatos, entrega técnica | KEEP |

**Dirección / narrativa:** no dimensión propia V1 — se refleja en Preproducción + Producción/realización.

Version dimensiones: `PROFILE_DIMENSIONS_VERSION = 8C.4`.

---

## 7. Fronteras entre Fields

### AUDIOVISUAL_PRODUCTION ↔ VISUAL_DESIGN

Diseñar una pieza visual/motion ≠ producir una pieza audiovisual.  
After Effects / Blender / Photoshop no determinan el Field.  
Motion-as-design permanece en `MOTION_DESIGN` (VD).

### AUDIOVISUAL_PRODUCTION ↔ DIGITAL_MARKETING

Crear/producir el contenido ≠ estrategia de distribución, crecimiento, campañas o performance.

### AUDIOVISUAL_PRODUCTION ↔ COMMUNICATIONS

Producción audiovisual ≠ comunicación institucional/editorial/periodística.  
MULTI_FIELD es legítimo; no absorber esas prácticas en AV.

---

## 8. Contraste cohorte 10A (sin P3)

| persona | Field AV | cobertura conceptual | riesgos |
| --- | --- | --- | --- |
| Santiago | primary AV + secondary VD | VIDEO_PRODUCTION / VIDEO_POST_PRODUCTION posibles sin absorber VD | forzar motion en AV |
| Juan Pablo | secondary AV + primary VD | AV secondary sin convertir VD primary en AV | AV_MOTION / animación mal clasificada |
| Camilo Ramírez | primary AV dominante | perfil AV claro con catálogo V1 | Marketing/Comms como bleed |

Resultado válido en 10C: varias specialties, una, o abstención.

---

## 9. Prueba de generalización

| perfil | representación |
| --- | --- |
| A. videógrafo / productor | VIDEO_PRODUCTION |
| B. editor / postproductor | VIDEO_POST_PRODUCTION |
| C. fotógrafo | PHOTOGRAPHY |
| D. integral | co-obs VIDEO_PRODUCTION + VIDEO_POST_PRODUCTION (± PHOTO/AUDIO) |
| E. AV + diseño visual | MULTI_FIELD (motion en VD) |
| F. AV + marketing | MULTI_FIELD |

---

## 10. Riesgos

1. Confundir Motion Design (VD) con post/edición AV.  
2. Inflar VIDEO_PRODUCTION por mención de cámara/herramienta.  
3. CONTENT_PRODUCTION reapareciendo vía evidencia “contenido digital”.  
4. Inferir dirección por cargo.  
5. Separar edición vs finishing en radar sin evidencia suficiente (mitigado: dimensiones; no specialties).  
6. Audio musical absorbido en AUDIO_PRODUCTION.  
7. PHOTOGRAPHY por fotos ocasionales en rodaje.  
8. Mapper de skills→dimensiones AV aún deferred a 10C (dimensiones definidas; mapping runtime pendiente).

---

## 11. Validaciones

| check | valor |
| --- | --- |
| catálogo diseñado específicamente para cohorte | no |
| tools convertidas en Specialty | no |
| skills convertidas indiscriminadamente en Specialty | no |
| upstream modificado | no |
| Gemini | no |
| persistencia | no |
| Cloud | no |

---

## Próxima fase

**FASE 10C — AUDIOVISUAL SPECIALTY APPLICATION + THREE PERSON VALIDATION**  
(No implementada en esta fase.)
