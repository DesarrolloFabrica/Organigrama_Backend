# MC1.6 — Baseline Diseño Visual (cuatro perfiles)

**Estado de ejecución:** `SCRIPT IMPLEMENTADO / AUDITORÍA CON DATOS REALES BLOQUEADA`  
**Modo usado:** fixtures históricos + dry-run PA2 in-memory (`pack 1.2.0`, `pa2-visual-design-1.1.0`)  
**Auditoría:** `VD-AUDIT-0.1.0` · `writes: 0`  
**CLI:** `npm run mc:audit-visual-design -- --fixture`  
**Artefacto:** `tmp/mc16-visual-design-four-profile-audit.json`

**Declaración:** este baseline **no** se persiste en tablas productivas.  
La expectativa humana de “pertenecen a Diseño Visual” **no** es evidencia MC1.

Documentos:

```text
1015482688
1000035262
1000590473
103154553
```

---

## 1. Propósito

Auditar por qué MC1 puede mostrar pocas competencias/especialidades, `SECONDARY_SIGNAL`/`OUTSIDE`, baja cobertura o evidencia no mapeada en perfiles visuales, **sin modificar** catálogo, mappings, PA2, thresholds, API ni frontend.

---

## 2. Personas (fixture / docs)

| Documento | person_id | Persona encontrada | CV | Extraction | Fuente |
| --------- | --------: | -----------------: | -- | ---------- | ------ |
| 1015482688 | 1163 | Sí (Nidia) | AVAILABLE | AVAILABLE | HISTORICAL_DOC mc1.6.0 |
| 1000035262 | — | Sí (Molano, parcial) | AVAILABLE | AVAILABLE | HISTORICAL_PARTIAL mc1.11.0 |
| 1000590473 | — | No en fixtures | MISSING | NOT_EXECUTED | FIXTURE_UNKNOWN → live required |
| 103154553 | — | Sí (Doris) | MISSING | OUTDATED | HISTORICAL_DOC mc1.10.2 NEED_CV |

Live PG: bloqueado en este entorno (Docker/WSL). Reintento:

```powershell
npm run mc:audit-visual-design -- --documents=1015482688,1000035262,1000590473,103154553 --i-confirm-readonly --env-file=.env.mc1-local
```

---

## 3. Cadena MC1 (fixture)

| Documento | CV | Extraction | Enrichment | Evidence | Visual evaluation | Evaluation Set |
| --------- | -- | ---------- | ---------- | -------- | ----------------- | -------------- |
| 1015482688 | AVAILABLE | AVAILABLE | AVAILABLE | AVAILABLE | AVAILABLE | NOT_EXECUTED |
| 1000035262 | AVAILABLE | AVAILABLE | AVAILABLE | AVAILABLE | AVAILABLE | NOT_EXECUTED |
| 1000590473 | MISSING | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED |
| 103154553 | MISSING | OUTDATED | MISSING | MISSING | NOT_EXECUTED | NOT_EXECUTED |

---

## 4. Dry-run VISUAL_DESIGN (pack 1.2.0)

| Documento | Qualification | Activas | Emergentes | Ocultas | Coverage | Warnings |
| --------- | ------------- | ------: | ---------: | ------: | -------: | -------- |
| 1015482688 | PRIMARY_MATCH | 1 | 1 | 3 | media specialty | DIGITAL EVALUATION_GAP / tools AV |
| 1000035262 | PRIMARY_MATCH | 1 | 1 | 3 | media specialty | adobe_creative_suite OUTSIDE |
| 1000590473 | NOT_AVAILABLE | — | — | — | NOT_AVAILABLE | NO_SKILLS |
| 103154553 | NOT_AVAILABLE | — | — | — | NOT_AVAILABLE | CHAIN_CV_MISSING |

### Especialidades (Nidia 1015482688)

| Especialidad | Estado | Fuerza | Hallazgo |
| ------------ | ------ | -----: | -------- |
| VISUAL_GRAPHIC | ACTIVE | ~45 | Núcleo `diseno_grafico` + tools |
| VISUAL_EDITORIAL | EMERGENT | ~5 | `diseno_editorial` WEAK → no ACTIVE |
| VISUAL_IDENTITY | HIDDEN | 0 | `comunicacion_visual` NONE |
| VISUAL_DIGITAL_ASSETS | HIDDEN | ~2 | tool-led / anti-tool |
| VISUAL_UI | HIDDEN | 0 | RESERVED, 0 mappings |

### Especialidades (Molano 1000035262, parcial)

| Especialidad | Estado | Fuerza | Hallazgo |
| ------------ | ------ | -----: | -------- |
| VISUAL_GRAPHIC | ACTIVE | ~37 | gráfico + ilustración + tools |
| VISUAL_IDENTITY | EMERGENT | 55 | `diseno_de_marca` (alias 1.2.0) — fuerza alta pero cardinalidad |
| Resto | HIDDEN | — | — |

---

## 5. Skills / evidencia no aprovechada (resumen)

| Skill/evidencia | Personas | Brecha | Capa |
| --------------- | -------: | ------ | ---- |
| adobe_creative_suite / suite genérica | Molano (+corpus) | UNMAPPED_SKILL (OUTSIDE pack) | Mappings/policy |
| diseno_de_piezas_publicitarias (sintético / típico CV) | ≥1 patrón | ALIAS_GAP | Aliases |
| Premiere / CapCut | Nidia | CROSS_DOMAIN_ONLY | Separación AV |
| After Effects listing | Nidia | visualish sin práctica | CONTEXT_DEPENDENT |
| SCORM / LMS / diseño instruccional | Nidia | NOT Visual core | Skill catalog |
| QA / prompting | Nidia | TRANSVERSAL / MISSING_SPECIALTY | Specialties |
| Figma / UX-UI | pack policy | TRANSVERSAL sin mapping UI | VISUAL_UI RESERVED |
| CV ausente | Doris | CHAIN_INCOMPLETE | Extraction |

---

## 6. Catálogo VISUAL_DESIGN (estático)

| Especialidad | Skills/mappings | Cobertura en fixtures con eval | Diagnóstico |
| ------------ | --------------: | -----------------------------: | ----------- |
| VISUAL_GRAPHIC | 18 mappings | 2/2 evaluables | EXISTS — núcleo sólido |
| VISUAL_IDENTITY | 10 | 1 | EXISTS — mejora post-1.2.0; ACTIVE exige ≥2 skills |
| VISUAL_EDITORIAL | 10 | 1 | EXISTS — evidencia CV suele ser WEAK |
| VISUAL_DIGITAL_ASSETS | 4 | 0 | DEPRECATED_IN_DOCS |
| VISUAL_UI | 0 | 0 | RESERVED |

Prácticas humanas vs modelo:

| Práctica | Estado modelo |
| -------- | ------------- |
| Diseño gráfico | ya existe |
| Identidad / branding | existe (aliases 1.2.0) |
| Diseño editorial | existe; umbral/evidencia frágil |
| Ilustración | parcialmente vía GRAPHIC |
| Diseño publicitario | faltan aliases/skills dedicadas |
| Contenido gráfico digital | mezclado / DIGITAL deprecated |
| Fotografía y retoque | parcial (retoque→GRAPHIC) |
| Motion graphics | frontera AV; no especialidad Visual |
| Diseño UI | RESERVED sin mappings |
| Dirección de arte | falta |

---

## 7. Separación de dominios

| Skill | Clasificación | Distinción |
| ----- | ------------- | ---------- |
| Illustrator | VISUAL_ONLY | — |
| Photoshop | SHARED | estático Visual vs frames AV |
| After Effects | CONTEXT_DEPENDENT | piezas gráficas vs video |
| Premiere | AUDIOVISUAL_ONLY | no forzar Visual |
| Figma / UX-UI | CONTEXT_DEPENDENT | UI visual ≠ frontend Software |
| Fotografía | CONTEXT_DEPENDENT | retoque vs rodaje |

---

## 8. Diagnóstico por persona

### 1015482688

- Resultado fixture: **PRIMARY_MATCH** (GRAPHIC ACTIVE, EDITORIAL EMERGENT).
- Desaprovechado: e-learning (SCORM/LMS), Premiere/AE listing, QA/prompting transversal, DIGITAL débil.
- Veredicto: `RESULT_REASONABLE` + `MAPPING_GAP`/`DOMAIN_MODEL_GAP` menores.
- Corrección: no urgente para PRIMARY; reforzar editorial/identidad si se busca más amplitud.

### 1000035262

- Resultado fixture (post-aliases 1.2.0): **PRIMARY_MATCH**; IDENTITY EMERGENT pese a strength alta.
- Desaprovechado: suite Adobe genérica (OUTSIDE intencional).
- Veredicto: `RESULT_REASONABLE`; cardinalidad PA2 explica IDENTITY no ACTIVE.
- Corrección: VD-5 validar si segunda skill de identidad existe en CV live.

### 1000590473

- Sin inventario en repo.
- Veredicto: `LIVE_DATA_REQUIRED`.
- Corrección: ejecutar modo read-only local cuando PG esté disponible.

### 103154553

- NEED_CV histórico.
- Veredicto: `CHAIN_INCOMPLETE` / `INSUFFICIENT_CV_EVIDENCE`.
- Corrección: capa Extraction (CV activo → re-extract), **no** mappings.

---

## 9. Causa raíz global (impacto)

1. **Cadena incompleta** (Doris; posible 1000590473) — sin CV no hay dominio.
2. **Aliases / vocabulario CV** — publicitario, compuestos no canónicos (patrón corpus 1.11.0).
3. **Cardinalidad PA2 (≥2 skills evidenciadas)** — IDENTITY/EDITORIAL fuertes pero EMERGENT.
4. **Especialidades reservadas/pobres** — UI 0 mappings; DIGITAL deprecated; publicitario/motion ausentes.
5. **Evidencia débil de tools** — Illustrator/PS WEAK no sostienen especialidad solas.
6. **Frontend** — **no** es causa primaria si backend ya entrega PRIMARY con 1 ACTIVE.

---

## 10. Respuestas a decisiones de la auditoría

1. **¿Dónde nace la pobreza?** Mixto: Extraction (Doris) → Aliases/Mappings (vocabulario) → PA2 cardinalidad → Specialties incompletas. No es FE primero.
2. **Skills visuales repetidas no reconocidas:** piezas publicitarias, suites Adobe genéricas, a veces compuestos de identidad/editorial pre-1.2.0.
3. **Especialidades pobres:** EDITORIAL (evidencia WEAK), DIGITAL (deprecated), IDENTITY (cardinalidad).
4. **Faltan:** publicitario dedicado, dirección de arte, motion-as-visual, foto profesional, UI mappings.
5. **Aliases faltantes:** formulaciones publicitarias / entregables; validar live en 1000590473.
6. **¿Se va a AV/Software?** Premiere/CapCut → AV; Figma/UX no auto-Software (TRANSVERSAL); AE contextual.
7. **Mayor cobertura sin FP:** VD-1 aliases observados en ≥2 perfiles + VD-3 mappings PRIMARY cuidadosos; **no** bajar thresholds; **no** mapear suite Adobe genérica.
8. **Primera fase:** **VD-1 aliases faltantes**, condicionada a inventario live de los cuatro.

---

## 11. Plan de fortalecimiento (no implementado)

| Fase | Cambio | Resultado esperado |
| ---- | ------ | ------------------ |
| VD-1 | Aliases CV | Más keys canónicas |
| VD-2 | Skills canónicas | Menos ALIAS_GAP |
| VD-3 | Mappings | Más ACTIVE reales |
| VD-4 | Especialidades | Cubrir publicitario/UI con política |
| VD-5 | Validación PA2 | Separar PA2_GAP vs mapping |
| VD-6 | Reevaluación + controles | Baseline delta |
| VD-7 | Ficha FE | Solo si backend mejora |

---

## 12. Versiones baseline

| Componente | Versión |
| ---------- | ------- |
| Audit | VD-AUDIT-0.1.0 |
| Catalog | mc1.8-2026-07-28 (constante repo) |
| Mapping pack | visual-design-mappings **1.2.0** |
| PA2 | pa2-visual-design-1.1.0 |
| Qualification | classifyDomainConceptually (DQ vigente) |

---

## 13. Próximo paso operativo

1. Desbloquear PG local.  
2. Re-ejecutar CLI en `--i-confirm-readonly`.  
3. Actualizar este baseline con filas `LIVE_PG` (sin PII innecesaria).  
4. Abrir VD-1 solo con aliases repetidos en ≥2 de los cuatro perfiles reales.
