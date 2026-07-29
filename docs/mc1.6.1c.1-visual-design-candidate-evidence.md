# MC1.6.1C.1 — Completar evidencia candidatos Diseño Visual

**Fase:** MC1.6.1C.1  
**Fecha:** 2026-07-27  
**Alcance:** completar cadena CV→extracción→enrichment→evidence para Garzón / Correa / Angulo; dry-run V1; **no** persistir PA2; **no** publicar V2 aún.  
**Artefactos:** `tmp/mc161c1-preflight.json`, `tmp/mc161c1-integrity.json`, `tmp/mc161c1-dryruns/*-v1.json`

---

## 1. Preflight por persona

Modelo/prompt aprobados: `gemini-3.6-flash` · `c2.1-2026-07-24` · extractor `1.1.0`.

| Campo | Garzón Toledo | Correa | Angulo |
|-------|---------------|--------|--------|
| person_id | **1166** | **1186** | **1184** |
| Nombre | GINNA MARCELA GARZON TOLEDO | JULIANA SOFIA CORREA ARAQUI | ANIBAL FERNANDO ANGULO ORTIZ |
| Documento | 1030646495 | 1002460888 | 1193092980 |
| Correo | ginna_garzon@cun.edu.co | juliana_correa@cun.edu.co | anibal_anguloor@cun.edu.co |
| Rol | ANALISTA DE DISEÑO DE CONTENIDOS | idem | idem |
| Área | FABRICA Y DESARROLLO | idem | idem |
| Activo | Sí | Sí | Sí |
| CV activo | **9** · `1030646495.pdf` | **28** · `1002460888.pdf` | **19** · `1193092980.pdf` |
| PDF bytes | 299 518 | 230 051 | 4 349 706 |
| PDF sha256 (Drive actual) | `a5491bcf…7778d` | `15dad8e2…2dfe04` | `e95931b4…9d88d` |
| Extracción previa | **92** (hash **distinto**, prompt `c1`, extractor `1.0.0`) | **115** (idem drift) | **114** (idem drift) |
| Enrichment previo | ninguno | ninguno | ninguno |
| Evidence previa | ninguno | ninguno | ninguno |
| PA2 previa | ninguna | ninguna | ninguna |
| Descarga OK / no vacío | Sí | Sí | Sí |
| RUNNING | 0 | 0 | 0 |
| Cadena completa previa | No | No | No |

**Hallazgo de preflight:** no se pueden reutilizar las extracciones 92/115/114: **hash PDF ≠ extracción** y versiones de prompt/extractor **obsoletas**. Plan de escritura: **re-extraer** con pipeline vigente → enrich → evidence. Sin PA2.

---

## 2. Ejecuciones realizadas

Orden: Garzón → Correa → Angulo (individual).

| Paso | Garzón | Correa | Angulo |
|------|--------|--------|--------|
| Extract `--persist` | **209** SUCCEEDED | **210** SUCCEEDED | **211** SUCCEEDED |
| Enrich `--persist --activate` | **7** active | **8** active | **9** active |
| Evidence `--persist --activate` | **7** active | **8** active | **9** active |
| PA2 | no | no | no |

Históricas: extracción 92 (Garzón) y 91 FAILED conservadas inactivas; 115 y 114 inactivas tras re-extracción.

---

## 3. Extracciones

| Persona | ext | skills | langs | certs | warnings | prompt | extractor |
|---------|-----|--------|-------|-------|----------|--------|-----------|
| Garzón | 209 | 18 | 1 | 0 | 1 (Community Manager/Management) | c2.1 | 1.1.0 |
| Correa | 210 | 22 | 1 | 0 | 1 | c2.1 | 1.1.0 |
| Angulo | 211 | 23 | 1 | 1 | 0 | c2.1 | 1.1.0 |

### Señales profesionales (sin inferir por cargo)

**Garzón:** identidad visual, diagramación editorial, community manager, edición video, IA; tools Adobe suite completa + Creative Cloud.  
**Correa:** diseño editorial, ilustración digital, maquetación/preprensa, diseño instruccional, redes; tools PS/AI/AE/Premiere + **suite Adobe**.  
**Angulo:** diseño gráfico institucional, maquetación editorial digital, producción AV académica, edición video, 3D; tools AI/PS/ID/AE/Premiere/Blender/ZBrush. **Sin Figma/UX** en la nueva extracción (a diferencia del inventario viejo 114).

---

## 4. Enrichments

| Persona | enr | extraction | in/out | pdf_sha256 alineado | activo |
|---------|-----|------------|--------|---------------------|--------|
| Garzón | 7 | 209 | 18/18 | sí | sí |
| Correa | 8 | 210 | 22/22 | sí | sí |
| Angulo | 9 | 211 | 23/23 | sí | sí |

Normalización automática del enricher; **sin edición manual** para forzar Visual.

Observaciones: aparecen `adobe_creative_cloud` / `suite_adobe` (Adobe genérico); sinónimos distintos a Nidia (`diseno_de_identidad_visual`, `diagramacion_editorial`, `diseno_grafico_institucional`, `maquetacion_editorial_digital`).

---

## 5. Evidence

| Persona | ev | enrichment | niveles S/M/W/N | avgStrength |
|---------|----|------------|-----------------|-------------|
| Garzón | 7 | 7 | 0 / 3 / 3 / 12 | ~15.8 |
| Correa | 8 | 8 | 0 / 3 / 8 / 11 | (artifact) |
| Angulo | 9 | 9 | 0 / 0 / 9 / 14 | — |

### Evidencias fuertes / débiles (resumen)

| Persona | Fuertes (MODERATE) | Débiles (WEAK) | Notable NONE |
|---------|--------------------|----------------|--------------|
| Garzón | identidad visual 63, IA 66, community 47 | diagramación 37, edición video 37, Creative Cloud 34 | PS/AI/ID/Premiere/AE listing |
| Correa | IA 55, automatización 42, suite Adobe 45 | maquetación 37, DI 29, redes 39 | `diseno_editorial` **0**, ilustración 0, PS/AI |
| Angulo | *(ninguna MODERATE profesional)* | maquetación editorial 32, video 29, 3D 29, interactivos 29 | gráfico institucional 0, AV académica 0, todas tools 0 |

---

## 6. Source hashes

| Persona | source_hash (vigente) | CV→ext→enr→ev |
|---------|----------------------|---------------|
| Garzón | `a5491bcf70de510ecd40e8af6dd490f9c5c2557ad1da13adf7fb4f191167778d` | OK |
| Correa | `15dad8e2c2a2c7e56e2dd9f93e012b9575bc0b19bdefcfaeed1f9bd60e2dfe04` | OK |
| Angulo | `e95931b4e51772485737eb3b2ca5a5a2228ffe4d0c4274d6b38f492dd439d88d` | OK |
| Nidia (ref) | `467d7dbe…f86f3a6` | OK (#3) |
| Juan Pablo (ref) | `0078bc04…5113ec81` | OK |

---

## 7. Auditoría individual

### Garzón Toledo
- **Rol:** Analista de diseño de contenidos  
- **Trayectoria:** identidad/branding + editorial + marketing digital; tools Adobe amplias; toque AV  
- **Competencias principales:** diseño de identidad visual; diagramación editorial  
- **Herramientas:** Creative Cloud / PS / AI / ID / Premiere / AE / Lightroom / Audition  
- **Transversales:** IA, gestión proyectos creativos, soft skills  
- **AV:** edición de video multiplataforma (WEAK)  
- **UX/UI:** no  
- **Instruccional:** no  
- **Dominio principal probable:** **VISUAL_DESIGN** (IDENTITY)

### Correa
- **Trayectoria:** editorial / ilustración / preprensa + DI + redes  
- **Principales:** maquetación y preprensa (WEAK evidenciada); DI (WEAK); editorial listado sin fuerza  
- **Tools:** suite Adobe (MODERATE genérico); apps individuales NONE  
- **AV:** Premiere/AE listing  
- **UX/UI:** no  
- **Instruccional:** diseño instruccional WEAK 29  
- **Dominio principal probable:** frontera **Visual editorial ↔ Diseño Instruccional**

### Angulo
- **Trayectoria:** gráfico institucional + editorial digital + AV académica + 3D  
- **Principales:** todo WEAK o NONE; sin MODERATE visual  
- **Tools:** Adobe + Blender/ZBrush (todas NONE en evidence)  
- **AV:** edición video WEAK; producción AV académica NONE  
- **UX/UI:** no en cadena nueva  
- **Instruccional:** no  
- **Dominio principal probable:** evidencia **insuficiente** para Visual firme; mezcla AV/3D

---

## 8. Clasificación conceptual (pre-PA2)

| Persona | Clasificación | Justificación |
|---------|---------------|---------------|
| Nidia | **MATCH** | `diseno_grafico` MODERATE + pack V1 |
| Juan Pablo | **OUTSIDE** Visual | Núcleo animación/video/audio; identidad secundaria |
| Garzón | **MATCH** | Identidad visual MODERATE defendible |
| Correa | **BORDERLINE** | Maquetación visual débil + DI + Adobe genérico; editorial sin fuerza |
| Angulo | **INSUFFICIENT_EVIDENCE** | Solo WEAK/NONE; sin ancla profesional MODERATE visual |

---

## 9. Dry-run V1 (`mc1.6-visual-nidia-2026-07-27` + `pa2-visual-design-1.0.0`)

| Persona | default | ACTIVE | EMERGENT | HIDDEN | Mappings hallados | Excluidos relevantes |
|---------|---------|--------|----------|--------|-------------------|----------------------|
| Nidia | VISUAL_GRAPHIC | 1 | 2 | 2 | gráfico/editorial/assets/QA/tools | DI/LMS/SCORM/AV tools |
| Juan Pablo | null | 0 | **2** | 3 | **solo InDesign** → DIGITAL+EDITORIAL | identidad/animación/AV |
| Garzón | null | 0 | 0 | 5 | PS/AI/ID listing NONE | **identidad / diagramación** (keys distintas) |
| Correa | null | 0 | 0 | 5 | PS/AI + `diseno_editorial` NONE | maquetación, ilustración, suite_adobe |
| Angulo | null | 0 | 0 | 5 | PS/AI/ID NONE | gráfico institucional, maquetación editorial |

**Falsos negativos V1:** Garzón MATCH conceptual queda todo HIDDEN por sinónimos no mapeados.  
**Falsos positivos V1:** Juan Pablo EMERGENT solo-tool; Nidia `VISUAL_DIGITAL_ASSETS` EMERGENT tool-driven.

Artefactos: `tmp/mc161c1-dryruns/{nidia,juanpablo,garzon,correa,angulo}-v1.json`.

---

## 10. Efecto de tools

| Persona | Aporte profesional (Σ strength) | Aporte tools | % tools | Resultado V1 sin tools* | Resultado V1 con tools | Riesgo |
|---------|----------------------------------|--------------|---------|-------------------------|------------------------|--------|
| Nidia | 354 | 6 | 1.7% | GRAPHIC seguiría ACTIVE (pro) | ACTIVE+EMERGENT assets/editorial | DIGITAL EMERGENT tool-led |
| Juan Pablo | 323.5 | 227 | **41%** | todo HIDDEN | 2 EMERGENT InDesign | **Alto FP Visual** |
| Garzón | 250 | 34 | 12% | HIDDEN (gap keys) | HIDDEN (tools NONE) | Bajo tool; alto gap pack |
| Correa | 210 | 45 | 18% | HIDDEN | HIDDEN | `suite_adobe` MODERATE fuera pack |
| Angulo | 171 | 0 | 0% | HIDDEN | HIDDEN | Tools no aportan |

\*Simulación conceptual: quitar contribuciones TOOL del pack.

**Patrones:**  
- InDesign MODERATE genera EMERGENT **solo en Juan Pablo** en esta muestra.  
- Garzón/Angulo tienen InDesign con **NONE** → no EMERGENT.  
- **Nidia DIGITAL_ASSETS** también es EMERGENT con evidencia casi solo tool → el problema es **sistémico de regla**, no solo JP.  
- QA solo aparece en Nidia (contexto visual/pedagógico); no contaminó hermanos.

---

## 11. Auditoría InDesign

| Pregunta | Respuesta |
|----------|-----------|
| ¿A qué especialidades aporta? | DIGITAL PRIMARY 0.55 + EDITORIAL SECONDARY 0.20 |
| ¿Qué evidence requiere hoy? | Cualquier nivel con strength>0 cuenta; NONE no activa |
| ¿Puede aportar con NONE/listing? | Mapea pero strength 0 → HIDDEN |
| ¿Genera EMERGENT solo? | **Sí** (Juan Pablo MODERATE) |
| ¿Requiere companion profesional? | **Debería** (propuesta V2/PA2) |
| ¿Desempate vs primaria? | Preferible SECONDARY bajo / desempate |
| ¿Pesos distintos Editorial vs Digital? | Sí, pero ambos demasiado altos si tool-sola |
| ¿Problema InDesign o tools? | **Regla general de tools** (confirmado también en Nidia DIGITAL) |

---

## 12. Auditoría QA

| Perfil | ¿Tiene QA? | Lectura |
|--------|------------|---------|
| Nidia | `control_de_calidad_(qa)` MODERATE 50 | QA de contenidos/visual en flujo pedagógico; ya mapeado GRAPHIC 0.45 |
| Garzón / Correa / Angulo / JP | No | — |

**Decisión:** no mapear QA genérico a Visual. Mantener solo con contexto visual/editorial explícito; **bajar peso** en V2 (p.ej. 0.30) para no sostener GRAPHIC sin diseño.

---

## 13. Catálogo comparado

| Especialidad | Nidia | Juan Pablo | Garzón | Correa | Angulo | Evidencia suficiente | Acción |
|--------------|-------|------------|--------|--------|--------|----------------------|--------|
| VISUAL_GRAPHIC | ACTIVE | HIDDEN | HIDDEN* | HIDDEN | HIDDEN* | Solo Nidia en V1; Angulo listing institucional | Aliases + keys `diseno_grafico*` |
| VISUAL_IDENTITY | HIDDEN (listing) | HIDDEN* | HIDDEN* (identidad MODERATE) | — | — | **Sí en Garzón** si se mapea | Mapping `diseno_de_identidad_visual` / manuales |
| VISUAL_EDITORIAL | EMERGENT | FP tool | HIDDEN* (diagramación) | HIDDEN (`diseno_editorial` NONE) | HIDDEN* (maquetación) | Parcial | Aliases diagramación/maquetación; bajar ID |
| VISUAL_DIGITAL_ASSETS | EMERGENT tool | FP tool | HIDDEN | — | HIDDEN | Frágil | Anti-tool + pesos |
| VISUAL_UI | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | No | Seguir vacía |

\*HIDDEN por **gap de keys**, no por ausencia conceptual.

---

## 14. Simulaciones anti-tool (conceptuales)

Regla candidata: *no ACTIVE/EMERGENT solo por tools sin competencia profesional evidenciada.*

| Variante | Nidia | JP | Garzón | Correa | Angulo |
|----------|-------|----|--------|--------|--------|
| **V1 actual** | GRAPHIC ACTIVE; DIGITAL/EDITORIAL EMERGENT | 2 EMERGENT tool | all HIDDEN | all HIDDEN | all HIDDEN |
| **V1 + bajar pesos ID** | DIGITAL/EDITORIAL más débiles; GRAPHIC igual | Posible seguir EMERGENT (cardinalidad 1 skill) | igual | igual | igual |
| **V1 + requisito profesional** | GRAPHIC ACTIVE; DIGITAL → HIDDEN; EDITORIAL OK (tiene `diseno_editorial`) | **0 EMERGENT** (correcto OUTSIDE) | igual HIDDEN hasta aliases | igual | igual |
| **V2 aliases + anti-tool** | estable | OUTSIDE limpio | IDENTITY emerge | EDITORIAL débil posible | sigue débil |

**No adoptar** anti-tool que exija tools profesionales fuertes: Nidia/Garzón legítimos se apoyan en knowledge, no en tools.

---

## 15. Propuesta V2 (no implementada)

### Decisión: **Resultado C — V2 mappings + PA2**

Publicar propuesta (siguiente fase de implementación):

1. **`visual-design-mappings-1.1.0`**
   - Añadir: `diseno_de_identidad_visual`, `manuales_de_identidad_corporativa`, `diagramacion_editorial`, `maquetacion_y_preprensa`, `maquetacion_editorial_digital`, `diseno_grafico_institucional` (+ aliases piezas gráficas).
   - Ajustar: InDesign pesos ↓; QA ↓; excluir/no mapear `adobe_creative_cloud` / `suite_adobe` como equivalentes multi-app.
   - Mantener AV/DI tools OUTSIDE.
2. **`pa2-visual-design-1.1.0`**
   - Regla: especialidad no ACTIVE/EMERGENT **solo por TOOL** sin ≥1 skill profesional (o evidencia de experiencia) mapeada a esa especialidad.
   - Conservar `minimumActiveStrength=20` salvo prueba contraria tras dry-run V2.

**No** mutar V1 in-place. **No** crear evals PA2 de hermanos hasta aprobar e implementar.

### Alternativa rechazada
- Mantener V1: deja a Garzón (MATCH) invisible y conserva FP tool en JP/Nidia DIGITAL.

---

## 16. Integridad

| Check | Resultado |
|-------|-----------|
| 1 extracción activa / persona | OK (209/210/211) |
| 1 enrichment activo | OK (7/8/9) |
| 1 evidence activa | OK (7/8/9) |
| mismo source_hash | OK |
| RUNNING | 0 |
| Históricas conservadas | Sí (92/115/114…) |
| PA2 hermanos | **ninguna** |
| Nidia #3 | **intacta** ACTIVE VISUAL_GRAPHIC |
| Juan Pablo PA2 | ninguna |

---

## 17. Tests (ejecutados / cubiertos por corrida)

| Caso | Resultado |
|------|-----------|
| Pipeline individual ×3 | OK |
| Idempotencia extract (hash+prompt+extractor) | OK (nuevos IDs por drift) |
| Descarga PDF / no vacío | OK preflight |
| Cadena incompleta aborta PA2 | N/A hermanos (no PA2) |
| Source hash mismatch previo detectado | OK → re-extract |
| Adobe genérico detectado | OK (`suite_adobe`, Creative Cloud) |
| Dry-run PA2 sin persistencia ×5 | OK |
| Nidia V1 reproducible | OK (1/2/2 GRAPHIC) |
| JP no persistido | OK |
| Soft regression Software | sin cambios en esta fase |

Suite unitaria backend completa: no re-ejecutada end-to-end aquí; builds Nest OK en cada CLI.

---

## 18. Builds

`nest build` OK en extract/enrich/evidence/evaluate/integrity.

---

## 19. Riesgos

1. Pack V1 **sobreajusta a keys de Nidia** → falsos negativos en MATCH reales.  
2. Tools-only EMERGENT (JP + Nidia DIGITAL) → semántica PA2 insuficiente.  
3. Adobe genérico con evidence MODERATE (Correa) si se mapea mal inflaría Visual.  
4. Angulo sin ancla MODERATE: forzar MATCH sería error.  
5. Correa BORDERLINE DI: persistir Visual prematuro.  
6. Re-extracción cambió inventario Angulo (perdió UX/Figma del extract viejo): usar solo cadena nueva.

---

## 20. Veredicto

### ¿InDesign FP es caso aislado?

**Parcialmente.** El síntoma InDesign MODERATE→EMERGENT aparece **solo en Juan Pablo** en la muestra de 5.  
Pero el mecanismo (**especialidad emergente solo por tool**) también afecta a **Nidia DIGITAL_ASSETS** → **no es un bug de una sola skill**, es regla sistémica.

### Decisión de salida

**EVIDENCIA SUFICIENTE — PUBLICAR VISUAL DESIGN V2**  
(propuesta lista; **implementación pendiente de aprobación**)

Razones: (1) gap de mappings/aliases demostrado en ≥2 perfiles MATCH/potencial; (2) patrón tools en ≥2 perfiles; (3) aún **no consolidar** dominio (solo 2 MATCH conceptuales: Nidia + Garzón).

### Siguiente acción única

**Implementar `visual-design-mappings-1.1.0` + `pa2-visual-design-1.1.0` (anti-tool companion), dry-run de los 5, y persistir solo MATCH defendibles (Nidia nueva eval si cambia resultado; Garzón si V2 lo sostiene; no JP/Angulo; Correa solo dry-run o no persistir).**
