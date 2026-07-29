# MC1.6.1C — Auditoría hermanos Diseño Visual + propuesta V2

**Fase:** MC1.6.1C  
**Modo hasta este documento:** auditoría + propuesta (sin mutar V1; **sin publicar pack/regla nuevos todavía**)  
**Fecha:** 2026-07-27  
**Artefacto RO:** `tmp/mc161c-candidate-audit.json`  
**Semilla histórica intacta:** Nidia evaluación `#3` (`VISUAL_DESIGN`, pack `mc1.6-visual-nidia-2026-07-27`, regla `pa2-visual-design-1.0.0`)

---

## 1. Resumen ejecutivo

La muestra con **cadena completa** (CV → extracción → enrichment → evidence) en roles de diseño/contenido/AV/UX es solo **dos personas: Nidia y Juan Pablo**. Los demás candidatos del brief tienen CV y, en varios casos, extracción, pero **carecen de enrichment y/o evidence**.

Con evidencia defendible:

| Persona | Clasificación conceptual | Dominio recomendado |
|---------|--------------------------|---------------------|
| Nidia | **MATCH** | `VISUAL_DESIGN` (ya evaluada #3) |
| Juan Pablo | **BORDERLINE → OUTSIDE para Visual V1** | Producción Audiovisual (futuro); no persistir Visual |
| 6 hermanos del brief | **INSUFFICIENT_EVIDENCE** | Completar pipeline antes de PA2 |
| Camacho / Acuña | **INSUFFICIENT_EVIDENCE** (frontera UX) | Completar pipeline; candidatos a frontera UX/UI |
| Garzón Ortiz | **INSUFFICIENT_EVIDENCE** | CV sin extracción vigente |

**Dry-run V1 de Juan Pablo (extracción 208):** `ACTIVE=0`, `EMERGENT=2` (`VISUAL_DIGITAL_ASSETS`, `VISUAL_EDITORIAL`), ambos **solo por tool `adobe_indesign`**. No hay principal. Las competencias AV fuertes no entran al pack (correcto), pero InDesign **sí infla** ejes visuales sin competencia profesional mapeada.

**Veredicto de fase (estado actual):** **DISEÑO VISUAL SIGUE EN CONSTRUCCIÓN**  
No se puede consolidar ni validar el dominio con ≥3 MATCH reales hasta completar enrichment+evidence de una muestra diversa.

**Siguiente acción única recomendada:**  
**Corregir una brecha concreta antes de continuar** → completar enrichment + evidence de **3 perfiles prioritarios** (Garzón Toledo, Correa, Angulo) y solo entonces publicar/implementar Visual V2.

**No se implementa pack/regla V2 en este entregable** (§16: detenerse tras la propuesta).

---

## 2. Candidatos auditados

| Persona | person_id | Rol | CV | Cadena completa | Evaluación previa | Candidato viable |
|---------|-----------|-----|----|-----------------|-------------------|------------------|
| NIDIA MARCELA PRADA RAMIREZ | 1163 | ANALISTA DE DISEÑO DE CONTENIDOS | 7 | **Sí** (ext 207 / enr 5 / ev 5) | VISUAL_DESIGN#3 | **Sí** |
| JUAN PABLO SANABRIA DIAZ | 1176 | ANALISTA DE DISEÑO DE CONTENIDOS | 104 | **Sí** (ext 208 / enr 6 / ev 6) | — | **Sí** (solo dry-run frontera) |
| ANIBAL FERNANDO ANGULO ORTIZ | 1184 | ANALISTA DE DISEÑO DE CONTENIDOS | 19 | No (ext 114; sin enr/ev) | — | No |
| GINNA MARCELA GARZON TOLEDO | 1166 | ANALISTA DE DISEÑO DE CONTENIDOS | 9 | No (ext 92; sin enr/ev) | — | No |
| JULIANA SOFIA CORREA ARAQUI | 1186 | ANALISTA DE DISEÑO DE CONTENIDOS | 28 | No (ext 115; sin enr/ev) | — | No |
| DANNA MICHELLE POVEDA CAÑON | 1182 | ANALISTA DE DISEÑO DE CONTENIDOS | 4 | No (ext 111; sin enr/ev) | — | No |
| BLANCA ALEJANDRA HERRERA DUCUARA | 1190 | ANALISTA DE DISEÑO DE CONTENIDOS | 12 | No (ext 120; sin enr/ev) | — | No |
| ALISON JULIETH CASTRO SUAREZ | 1180 | ANALISTA DE DISEÑO DE CONTENIDOS | 24 | No (ext 108; sin enr/ev) | — | No |
| JOSE ALEJANDRO CAMACHO COBOS | 4 | DISEÑADOR UX/UI | sí | No (ext sí; sin enr/ev) | — | No |
| ZUANY ALEJANDRO ACUÑA VELEZ | 3 | DISEÑADOR UX/UI | sí | No (ext sí; sin enr/ev) | — | No |
| CHRISTIAN GARZON ORTIZ | 1309 | DISEÑADOR INTEGRAL IA | 186 | No (**sin extracción**) | — | No |

**Cadena completa en roles diseño/contenido/AV/UX en Cloud:** únicamente Nidia + Juan Pablo.

Área/jefe/cargo **no** se usaron como prueba de pertenencia; solo contexto.

---

## 3. Muestra seleccionada

Objetivo: 3–5 perfiles con diversidad. **Disponibles con cadena completa: 2.**

| # | Perfil | Rol en muestra | Justificación |
|---|--------|----------------|---------------|
| 1 | **Nidia** | Gráfico / assets / editorial débil | MATCH semilla; núcleo `diseno_grafico` MODERATE |
| 2 | **Juan Pablo** | Frontera AV (+ identidad parcial) | Cadena completa; evidencia AV dominante; **no** forzar Visual |
| 3–5 | *(pendientes)* | — | Requieren enrichment+evidence |

**Prioridad para completar pipeline (diversidad conceptual desde extracción):**

| Prioridad | Persona | Diversidad esperada | Señales en extracción |
|-----------|---------|---------------------|------------------------|
| P1 | **Garzón Toledo** | Gráfico + identidad | `diseno_grafico`, `creacion_de_identidad_visual`, `manuales_de_marca`, `piezas_graficas` (+ AV tools) |
| P2 | **Correa** | Editorial / ilustración / frontera DI | `diseno_editorial`, `ilustracion`, `maquetacion`, `comunicacion_visual`, `diseno_instruccional*` |
| P3 | **Angulo** | Gráfico + frontera UX/UI | `diseno_grafico`, `diseno_ux`, `figma`, Illustrator/Photoshop (+ 3D/AV) |
| Reserva UX | Camacho Cobos | Frontera UX/UI fuerte | prototipado, piezas gráficas, React/Tailwind, motion |
| Reserva UX | Acuña | UX más “producto” | interfaces accesibles, prototipado, frontend |

**No** se usa Juan Pablo como MATCH de Diseño Visual: su evidencia profesional apunta a **animación / video / audio / streaming**, con identidad y mockups como secundarios.

---

## 4. Evidencia individual (perfiles con cadena o extracción útil)

### 4.1 Nidia (MATCH) — cadena completa

| Elemento | Tipo | Evidencia | Fuerza | Dominio probable | Acción propuesta |
|----------|------|-----------|--------|------------------|------------------|
| Diseño Gráfico | Profesional | EDUCATION+WORK+… | MODERATE 66 | Visual / GRAPHIC | REUTILIZAR mapping PRIMARY 1.0 |
| Diseño editorial | Profesional | PROFILE | WEAK 5 | Visual / EDITORIAL | REUTILIZAR; umbral estricto |
| Comunicación Visual | Profesional | listing | NONE 0 | Visual / IDENTITY | Mantener; HIDDEN si NONE |
| QA | Profesional | MODERATE 50 | Visual apoyo / GRAPHIC | Revisar peso 0.45 (posible bajar) |
| Illustrator / Photoshop / InDesign | TOOL | WEAK 2 | Visual apoyo | Peso bajo; no especialidad |
| Canva / Genially | TOOL | NONE 0 | Digital assets | Peso mínimo; listing débil |
| Premiere / AE / CapCut | TOOL | NONE | AV | Mantener OUTSIDE Visual |
| Diseño instruccional / LMS / SCORM | Otro dominio | WEAK–MODERATE | Instruccional | Mantener OUTSIDE |
| Prompting / IA | Transversal | MODERATE | Transversal | No radar Visual |
| Soft skills | Soft | — | Transversal | Fuera del radar V1/V2 |

**Aporte tools vs profesional (suma strength cruda):** profesional ~354 · tools ~6 → tools no dominan.

### 4.2 Juan Pablo (BORDERLINE→OUTSIDE Visual) — cadena completa

| Elemento | Tipo | Evidencia | Fuerza | Dominio probable | Acción propuesta |
|----------|------|-----------|--------|------------------|------------------|
| Animación 2D/3D | Profesional | MODERATE 64.5 | **AV** | No mapear a Visual V2 |
| Edición de video | Profesional | WEAK 1 | **AV** | Fuera Visual |
| Masterización audio / Streaming | Profesional | WEAK | **AV** | Fuera Visual |
| Fotografía comercial / Retoque | Profesional | MODERATE ~54 | Frontera foto / Visual parcial | No especialidad Visual V1; evaluar foto en AV o transversal |
| Manuales de identidad corporativa | Profesional | MODERATE 50 | Visual / IDENTITY | **AGREGAR** mapping IDENTITY si se publica V2 |
| Mockups publicitarios | Profesional | WEAK 34 | Visual / GRAPHIC o publicidad | Valorar PRIMARY bajo a GRAPHIC en V2 |
| E-mail marketing | Profesional | MODERATE 40 | Marketing | OUTSIDE Visual |
| After Effects / Premiere / CapCut | TOOL | MODERATE 40–50 | **AV** | OUTSIDE; no pack Visual fuerte |
| InDesign | TOOL | MODERATE 40 | Editorial/assets | V1 lo mapea → **infla EMERGENT**; bajar peso o exigir companion profesional |
| iSpring | TOOL | MODERATE 40 | Instruccional | OUTSIDE |
| Soft “liderar equipos creativos” | Soft | NONE | Soft | Fuera radar |

**Aporte tools vs profesional:** profesional ~323.5 · tools ~227 → **tools pesan demasiado** en el perfil global; en V1 Visual solo InDesign contribuye y aún así crea 2 EMERGENT.

### 4.3 Extracción-only (no PA2) — señales para prioridad

- **Garzón:** gráfico + identidad + postproducción/AV → MATCH probable Visual con frontera AV en tools.
- **Correa:** editorial + ilustración + DI → MATCH editorial / posible BORDERLINE DI.
- **Angulo:** gráfico + UX + Figma + 3D → BORDERLINE Visual↔UX.
- **Poveda:** gráfico + identidad + marketing + web → BORDERLINE Visual↔Marketing.
- **Herrera:** DI + e-learning + multimedia → más Instruccional/AV que Visual puro.
- **Castro:** extracción corta (ilustración/video/IA) → evidencia pobre hasta enrichment.
- **Camacho / Acuña:** fuerte UX/producto; útiles para probar `VISUAL_UI`, no para forzar MATCH Visual.
- **Garzón Ortiz:** CV sin extracción → no auditable aún.

---

## 5. Clasificación MATCH / BORDERLINE / OUTSIDE / INSUFFICIENT

| Persona | Clasificación | Especialidad principal probable | Secundarias | Tools apoyo | Transversales | Frontera |
|---------|---------------|---------------------------------|-------------|-------------|---------------|----------|
| Nidia | **MATCH** | VISUAL_GRAPHIC | EDITORIAL, DIGITAL_ASSETS | AI, PS, ID, Canva, Genially | IA, prompting, QA, gestión | DI (OUTSIDE pack) |
| Juan Pablo | **OUTSIDE** Visual (BORDERLINE AV↔Visual) | — (AV futuro) | identidad/mockups como secundarios AV/Visual | Premiere, AE, CapCut, InDesign | — | **Visual ↔ Producción Audiovisual** |
| Angulo / Garzón / Correa / Poveda / Herrera / Castro | **INSUFFICIENT_EVIDENCE** | — | — | — | — | Completar cadena |
| Camacho / Acuña | **INSUFFICIENT_EVIDENCE** | — | — | — | — | Visual ↔ UX/UI |
| Garzón Ortiz | **INSUFFICIENT_EVIDENCE** | — | — | — | — | Sin extracción |

---

## 6. Catálogo actual (especialidades V1)

| Especialidad | Evidencia en muestra | Cobertura | Problema | Acción recomendada |
|--------------|----------------------|-----------|----------|--------------------|
| VISUAL_GRAPHIC | Nidia sí; Juan Pablo no (sin `diseno_grafico`); Garzón/Angulo/Poveda en extracción | Alta en semilla | Pack sesgado a Nidia | **Conservar**; ampliar mappings profesionales de hermanos |
| VISUAL_IDENTITY | Nidia listing NONE; Juan Pablo `manuales_de_identidad_*` no mapeado; Garzón/Poveda extracción | Baja en V1 | Mapping solo `comunicacion_visual` | **Conservar**; agregar identidad/marca |
| VISUAL_EDITORIAL | Nidia WEAK; Correa extracción; Juan Pablo solo InDesign tool | Baja | Tool puede crear EMERGENT falso | **Conservar**; bajar peso InDesign; exigir skill editorial |
| VISUAL_DIGITAL_ASSETS | Nidia tools débiles; Juan Pablo InDesign → EMERGENT | Frágil | Demasiado tool-driven | **Conservar** con pesos más estrictos |
| VISUAL_UI | Sin mappings V1; Angulo/Camacho/Acuña extracción | 0 en V1 | Especialidad vacía | **Conservar HIDDEN** hasta evidencia UI defendible; no mover a dominio UX aún |

---

## 7. Nuevas especialidades evaluadas

| Candidata | ¿Cumple umbral de creación? | Decisión |
|-----------|-----------------------------|----------|
| Ilustración | Aparece en Correa/Castro extracción; aún no multi-perfil con evidence | **No crear aún**; reevaluar tras P2 Correa |
| Dirección de arte | Sin evidencia explícita multi-perfil | **Descartar V2** |
| Diseño publicitario | Mockups/campañas puntuales | **Descartar**; cubrir vía GRAPHIC/IDENTITY |
| Motion graphics | Claramente temporal/AV; Juan Pablo AE/animación | **Mover a Producción Audiovisual** (no Visual V2) |
| Diseño de presentaciones | Genially/Canva ya en DIGITAL | **No especialidad nueva** |
| Visualización de información | Sin evidencia | **Descartar** |

---

## 8. Skills y aliases

| Skill detectada | Catálogo actual | Acción | Especialidad | Peso propuesto | Justificación |
|-----------------|-----------------|--------|--------------|----------------|---------------|
| diseno_grafico | Sí | REUTILIZAR | GRAPHIC | 1.0 | Núcleo |
| diseno_editorial | Sí | REUTILIZAR | EDITORIAL | 1.0 | Núcleo editorial |
| comunicacion_visual | Sí | REUTILIZAR | IDENTITY | 1.0 | Identidad |
| control_de_calidad_(qa) | Sí | AJUSTAR | GRAPHIC | 0.30–0.35 | Evitar inflar GRAPHIC |
| adobe_illustrator / photoshop | Sí TOOL | REUTILIZAR | GRAPHIC | ≤0.25 | Tool apoyo |
| adobe_indesign | Sí TOOL | AJUSTAR | DIGITAL PRIMARY / EDITORIAL SECONDARY | ≤0.25 / ≤0.10 | Evitar EMERGENT solo-tool |
| canva / genially | Sí TOOL | REUTILIZAR | DIGITAL | ≤0.25 | Assets |
| premiere / AE / capcut | OUTSIDE | MANTENER FUERA | — | — | Frontera AV |
| lms / scorm / DI / ispring | OUTSIDE | MANTENER FUERA | — | — | Frontera DI |
| manuales_de_identidad_corporativa | En CV Juan Pablo | **AGREGAR** | IDENTITY | 0.9–1.0 | Evidencia profesional IDENTITY |
| creacion_de_identidad_visual / manuales_de_marca / identidad_corporativa | Extracción hermanos | **AGREGAR** (+ aliases) | IDENTITY | 0.8–1.0 | Tras evidence |
| piezas_graficas / diseno_de_piezas_graficas | Extracción | **AGREGAR** o alias → diseno_grafico | GRAPHIC | 0.7–1.0 | Sinónimo operativo |
| mockups_publicitarios | Juan Pablo | AGREGAR cauteloso | GRAPHIC | 0.4–0.6 | No publicidad como especialidad |
| ilustracion | Extracción Correa/Castro | NORMALIZAR; no especialidad aún | GRAPHIC SECONDARY | 0.5 | Hasta multi-evidence |
| diseno_ux / prototipado / figma | Extracción Angulo/Camacho/Acuña | No forzar Visual; Figma TOOL UI futuro | VISUAL_UI (futuro) | tool ≤0.25 | Frontera UX |
| adobe / adobe_creative_cloud | Herrera | **NO alias** a todas las apps | — | — | Adobe genérico ambiguo |
| Soft skills / creatividad | Varios | TRANSVERSAL / fuera radar | — | — | §21 |
| animacion_2d/3d, edicion_de_video, motion_graphics | JP / Camacho | MOVER A OTRO DOMINIO (AV) | — | — | §9 |

**Aliases seguros propuestos (V2):**  
`diseno_de_piezas_graficas` / `piezas_graficas` → `diseno_grafico`  
`diseno_ui` / `diseno_de_interfaces*` → skill UI canónica (cuando exista evidence)  
`manuales_de_marca` / `identidad_corporativa` → familia IDENTITY  

**Aliases rechazados:** `Adobe` / `Creative Cloud` / `Adobe Suite` ≡ Illustrator+Photoshop+InDesign+Premiere.

---

## 9. Mappings V1 auditados (`visual-design-mappings` @ `mc1.6-visual-nidia-2026-07-27`)

| Skill | Especialidad | Tipo | Peso | Evidencia en muestra | Mantener | Ajustar | Eliminar |
|-------|--------------|------|------|----------------------|----------|---------|----------|
| diseno_grafico | GRAPHIC | PRIMARY | 1.0 | Nidia sí | ✓ | | |
| adobe_illustrator | GRAPHIC | PRIMARY | 0.25 | Nidia WEAK | ✓ | | |
| adobe_photoshop | GRAPHIC | PRIMARY | 0.25 | Nidia WEAK | ✓ | | |
| control_de_calidad_(qa) | GRAPHIC | PRIMARY | 0.45 | Nidia MODERATE | | ✓ bajar | |
| diseno_editorial | EDITORIAL | PRIMARY | 1.0 | Nidia WEAK | ✓ | | |
| comunicacion_visual | IDENTITY | PRIMARY | 1.0 | Nidia NONE | ✓ | | |
| adobe_indesign | DIGITAL | PRIMARY | 0.55 | Nidia WEAK; **JP MODERATE → EMERGENT falso** | | ✓ bajar fuerte | |
| adobe_indesign | EDITORIAL | SECONDARY | 0.20 | idem | | ✓ bajar | |
| canva | DIGITAL | PRIMARY | 0.25 | Nidia NONE | ✓ | | |
| canva | GRAPHIC | SECONDARY | 0.10 | Nidia NONE | ✓ | | |
| genially | DIGITAL | PRIMARY | 0.25 | Nidia NONE | ✓ | | |
| *(ninguno)* | VISUAL_UI | — | — | sin evidencia semilla | ✓ vacío | | |

Pack V1 **inmutable** (política MC1.6.1B.2). Cambios ⇒ nueva versión.

---

## 10. Propuesta V2 (no implementada aún)

### Catálogo
- **Conservar:** GRAPHIC, IDENTITY, EDITORIAL, DIGITAL_ASSETS, UI (UI sigue sin mappings fuertes hasta evidencia).
- **No crear** Ilustración / Motion / Publicidad / Dirección de arte en V2.
- **No** crear dominio Producción Audiovisual en esta fase.

### Skills / aliases
- Agregar mappings profesionales IDENTITY/GRAPHIC detectados en hermanos **solo tras evidence**.
- Aliases seguros de piezas gráficas / identidad.
- Rechazar Adobe genérico.

### Mappings (contenido esperado de `visual-design-mappings` **1.1.0** o `mc1.6.1c-visual-siblings-…`)
- **Añadir:** `manuales_de_identidad_corporativa` → IDENTITY; tras pipeline: identidad/marca/piezas gráficas.
- **Modificar:** bajar `adobe_indesign` (p.ej. DIGITAL ≤0.25, EDITORIAL ≤0.10); bajar QA GRAPHIC.
- **Eliminar:** ninguno crítico de V1; AV/DI siguen OUTSIDE.
- Regla heurística documental: **tool sola no debe producir ACTIVE**; idealmente tampoco EMERGENT dominante sin profesional companion (puede requerir ajuste PA2).

### PA2
- Umbral `minimumActiveStrength=20` **se conserva** (Nidia ACTIVE legítimo; Juan Pablo sin ACTIVE).
- Si se endurece tratamiento de tools / EMERGENT solo-tool → publicar **`pa2-visual-design-1.1.0`** (MINOR).
- Si solo cambian mappings → pack nuevo; regla puede permanecer `1.0.0` **salvo** que se cambie semántica tool/EMERGENT.

### Impacto esperado
| Perfil | Impacto |
|--------|---------|
| Nidia | Dry-run V2 comparable a #3; #3 intacta; nueva eval solo si V2 se publica oficialmente |
| Juan Pablo | Dry-run OK; **no persistir** Visual; candidato AV |
| Hermanos incompletos | Sin persistencia |
| Software / Camilo | Sin cambio |
| Fronteras | AV y UX documentadas; DI excluida |

### Criterio de implementación
Implementar V2 **solo después** de:
1. Enrichment+evidence de ≥3 perfiles prioritarios, **o**
2. Aprobación explícita de publicar V2 solo con ajustes anti-tool (InDesign/QA) + dry-run Nidia/JP.

---

## 11. Pack y regla publicados

| Artefacto | Estado |
|-----------|--------|
| `visual-design-mappings` @ `mc1.6-visual-nidia-2026-07-27` | **PUBLISHED inmutable** (V1) |
| `pa2-visual-design-1.0.0` | **Vigente** |
| Pack V2 / PA2 1.1.0 | **No publicados** (propuesta pendiente) |

---

## 12. Dry-runs

### Nidia V1 (referencia histórica #3)
| specialty | status | strength (ref) |
|-----------|--------|----------------|
| VISUAL_GRAPHIC | ACTIVE (principal) | ~45.9 |
| VISUAL_EDITORIAL | EMERGENT | ~4.5 |
| VISUAL_DIGITAL_ASSETS | EMERGENT | ~2.0 |
| VISUAL_IDENTITY / UI | HIDDEN | 0 |

### Juan Pablo V1 (extracción 208, dry-run 2026-07-27)
| specialty | status | Motivo |
|-----------|--------|--------|
| VISUAL_DIGITAL_ASSETS | EMERGENT | Solo InDesign TOOL w=0.55 |
| VISUAL_EDITORIAL | EMERGENT | Solo InDesign SECONDARY w=0.20 |
| VISUAL_GRAPHIC / IDENTITY / UI | HIDDEN | Sin mappings aplicables |
| default | **null** | NO_DEFAULT_SPECIALTY |

**Decisión:** no persistir.

---

## 13. Comparación Nidia V1 / V2

Pendiente hasta publicar V2.

| Métrica | Nidia V1 (#3) | Nidia V2 | Diferencia | Justificación |
|---------|---------------|----------|------------|---------------|
| principal | VISUAL_GRAPHIC | TBD | — | — |
| ACTIVE/EMERGENT/HIDDEN | 1/2/2 | TBD | — | — |

---

## 14. Resultados por hermano

| Persona | Rol | Cadena | Clasificación | Dominio recomendado | Persistencia |
|---------|-----|--------|---------------|---------------------|--------------|
| Nidia | Analista diseño contenidos | Completa | MATCH | VISUAL_DESIGN | Ya #3; no tocar |
| Juan Pablo | Analista diseño contenidos | Completa | OUTSIDE Visual | AV futuro | **No** |
| Angulo…Castro | Analista diseño contenidos | Incompleta | INSUFFICIENT | — | **No** |
| Camacho / Acuña | Diseñador UX/UI | Incompleta | INSUFFICIENT | Frontera UX | **No** |
| Garzón Ortiz | Diseñador Integral IA | Sin extracción | INSUFFICIENT | — | **No** |

Detalle contribuciones/radar: solo Nidia (histórico) y dry-run JP (§12).

---

## 15. Persistencia

Ninguna evaluación nueva en esta fase.  
No se forzó dominio en BORDERLINE/OUTSIDE.

---

## 16. Históricas

Evaluación Nidia `#3` permanece vigente e intacta (contexto, hashes, pack, regla).

---

## 17. API

Sin cambios de contrato. Esperado:

- Camilo → SOFTWARE  
- Nidia → VISUAL_DESIGN (#3)  
- Juan Pablo / hermanos → sin evaluación Visual nueva (`NOT_EVALUATED` salvo otros dominios)  
- Johan → NOT_EVALUATED  

---

## 18. Frontend

Sin rediseño. Sin verificación FE nueva (no hay hermanos persistidos). Software no afectado.

---

## 19. Tests

No se añadieron tests de pack V2 (no implementado).  
V1 permanece cubierto por specs existentes (`mc-catalog.visual-design.spec.ts`, etc.).

---

## 20. Builds

Audit script + dry-run JP ejecutados tras `nest build` OK.

---

## 21. Métricas de dominio

| Métrica | Resultado |
|---------|-----------|
| Candidatos auditados | 11 |
| Cadenas completas | **2** |
| MATCH | 1 (Nidia) |
| BORDERLINE | 0 persistibles (JP tratado OUTSIDE Visual) |
| OUTSIDE | 1 (Juan Pablo para Visual) |
| INSUFFICIENT_EVIDENCE | 8 |
| Perfiles persistidos (fase) | **0** |
| Especialidades confirmadas | 5 existentes (UI vacía) |
| Especialidades nuevas | **0** |
| Skills nuevas | 0 (propuestas pendientes) |
| Aliases nuevos | 0 (propuestos) |
| Mappings nuevos | 0 |
| Mappings retirados | 0 |
| Pack publicado | solo V1 |
| Regla PA2 publicada | solo 1.0.0 |

---

## 22. Riesgos

1. **Sesgo de semilla única:** pack V1 = patrón Nidia; hermanos incompletos no validan cobertura.  
2. **Tools EMERGENT:** InDesign MODERATE crea ejes Visual sin competencia profesional mapeada.  
3. **Falsa pertenencia por organigrama:** mismo rol/área ≠ mismo dominio (JP).  
4. **Adobe genérico / Creative Cloud** en extracciones futuras.  
5. **Motion/animación** tentación de meter en Visual → contaminaría frontera AV.  
6. **QA** con peso alto puede sostener GRAPHIC sin diseño explícito en otros perfiles.  
7. Publicar V2 antes de ≥3 cadenas completas **no** cumple criterio de consolidación.

---

## 23. Veredicto

### DISEÑO VISUAL SIGUE EN CONSTRUCCIÓN

Razones: un solo MATCH con evidencia completa; segundo perfil completo es OUTSIDE Visual; UI sin mappings; pack no validado en diversidad real.

### Siguiente acción (única)

**Corregir una brecha concreta antes de continuar:**  
completar **enrichment + evidence** de **Garzón Toledo, Correa y Angulo** (reserva: Camacho para frontera UI), re-auditar evidencia, y solo entonces implementar `visual-design-mappings` V2 (+ `pa2-visual-design-1.1.0` si se endurece tools).

**No** iniciar Producción Audiovisual todavía (salvo track paralelo documental).  
**No** procesar todo el organigrama.

---

## Apéndice — Cómo reproducir auditoría

```bash
npx nest build
node dist/database/scripts/mc161c-candidate-audit.js
# dry-run frontera AV
npm run mc:evaluate -- --extraction-id=208 --domain=VISUAL_DESIGN --rules-version=pa2-visual-design-1.0.0 --dry-run
```

Script: `src/database/scripts/mc161c-candidate-audit.ts`  
Salida: `tmp/mc161c-candidate-audit.json`

---

## Addendum MC1.6.1C.1 (2026-07-27) — evidencia completada

Documento completo: [`docs/mc1.6.1c.1-visual-design-candidate-evidence.md`](./mc1.6.1c.1-visual-design-candidate-evidence.md).

### Cadenas nuevas (sin PA2)

| Persona | ext | enr | ev | source_hash | Clasificación conceptual |
|---------|-----|-----|----|-------------|--------------------------|
| Garzón Toledo | 209 | 7 | 7 | `a5491bcf…` | **MATCH** (identidad) |
| Correa | 210 | 8 | 8 | `15dad8e2…` | **BORDERLINE** Visual↔DI |
| Angulo | 211 | 9 | 9 | `e95931b4…` | **INSUFFICIENT_EVIDENCE** |

Extracciones previas 92/115/114 **no reutilizadas** (drift hash + prompt `c1` / extractor `1.0.0`).

### Dry-run V1 (muestra de 5)

| Persona | Resultado V1 | Nota |
|---------|--------------|------|
| Nidia | ACTIVE GRAPHIC 1/2/2 | Reproducible |
| Juan Pablo | 0 ACTIVE / 2 EMERGENT (solo InDesign) | OUTSIDE; no persistir |
| Garzón | 0/0/5 HIDDEN | Falso negativo: keys distintas (`diseno_de_identidad_visual`) |
| Correa | 0/0/5 HIDDEN | Editorial NONE + gap maquetación |
| Angulo | 0/0/5 HIDDEN | Sin ancla MODERATE |

### InDesign: ¿caso aislado?

El **síntoma** InDesign MODERATE→EMERGENT es **solo Juan Pablo** en la muestra.  
El **mecanismo** (EMERGENT solo-tool) también aparece en Nidia `VISUAL_DIGITAL_ASSETS` → **sistémico**.

### Actualización de veredicto (post C.1)

- MATCH conceptuales con cadena: **Nidia + Garzón** (aún <3 para consolidar).  
- Decisión C.1: **EVIDENCIA SUFICIENTE — PUBLICAR VISUAL DESIGN V2** (propuesta; no implementada).  
- Propuesta: `visual-design-mappings-1.1.0` + `pa2-visual-design-1.1.0` (anti-tool companion).  
- Nidia `#3` intacta; ningún PA2 nuevo en hermanos.
