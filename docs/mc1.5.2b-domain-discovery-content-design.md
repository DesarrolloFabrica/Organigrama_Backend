# MC1.5.2B — Enrichment, Evidence y descubrimiento profesional · Nidia

**Documento:** 1015482688 · **personId:** 1163 · **extracción:** 87  
**Modo:** pipeline Enrichment + Evidence + descubrimiento documental.  
**No se ejecutó** PA2 Software · **no** se creó catálogo / mappings / frontend.

Artefacto: `tmp/cv-attributes/mc1.5.2b-1015482688-enrichment-evidence.json`

---

## 1. Objetivo

Obtener una base de evidencia sólida para definir, en fases posteriores, el dominio profesional de Nidia sin forzarla a Software.

## 2. Perfil analizado

| Campo | Valor |
|-------|--------|
| Nombre | NIDIA MARCELA PRADA RAMIREZ |
| personId | 1163 |
| Documento | 1015482688 (único, activo) |
| Rol org. | Analista de diseño de contenidos |
| Área | Fábrica y desarrollo |
| personCvId | 7 (activo, PDF disponible) |

El cargo se usa solo como contexto; la identidad profesional se deriva de skills + evidencia.

## 3. Fuentes

- Extracción PA1 id **87** (SUCCEEDED, activa)
- Enrichment id **4** (SUCCEEDED, activa) — modelo `gemini-3.6-flash`
- Evidence Evaluation id **4** (SUCCEEDED, activa) — rules `er2`
- Enrichment id **3** (SUCCEEDED, **inactiva**): intento previo bloqueado al activar por drift de `pdfSha256`

## 4. Auditoría previa (antes de escribir)

Todos los checks OK:

- persona 1163 activa y documento único  
- CV 7 activo + PDF  
- extracción 87 SUCCEEDED activa vinculada a CV 7  
- sin Enrichment/Evidence activos previos  
- sin PA2 para extracción 87  

## 5. Estado del pipeline (después)

| Etapa | ID | Estado | Activa |
|-------|-----|--------|--------|
| CV | 7 | — | sí |
| Extracción | 87 | SUCCEEDED | sí (sin mutar) |
| Enrichment | 4 | SUCCEEDED | **sí** |
| Enrichment previo | 3 | SUCCEEDED | no |
| Evidence | 4 | SUCCEEDED | **sí** |
| PA2 | — | — | **cero** |

### Drift de PDF

| Hash | Origen |
|------|--------|
| `6c292f8c…` | extracción 87 |
| `467d7dbe…` | PDF vivo en Drive al enriquecer |

La extracción 87 puede estar **desactualizada** respecto al CV actual. Enrichment analizó el PDF vivo y se vinculó al hash de la extracción para poder activarse (ajuste CLI; inventario 87 intacto). **Recomendación MC1.6.x:** evaluar re-extracción.

## 6. Nueve skills (extracción + Evidence)

| Skill | Tipo | Evidencia EE | Strength | Conf. | Clasificación discovery |
|-------|------|--------------|----------|-------|-------------------------|
| Diseño publicitario | PROFESSIONAL_KNOWLEDGE | **MODERATE** | 45 | 0.86 | **PROFESSIONAL_CORE** |
| Inteligencia Artificial | TECHNOLOGY | **MODERATE** | 55 | 0.86 | PROFESSIONAL_SUPPORT |
| Optimización de prompts | METHODOLOGY | WEAK | 39 | 0.86 | AMBIGUOUS |
| Diseño editorial | PROFESSIONAL_KNOWLEDGE | WEAK | 5 | 0.80 | AMBIGUOUS |
| Diseño instruccional | PROFESSIONAL_KNOWLEDGE | WEAK | 2 | 0.43 | AMBIGUOUS |
| Edición audiovisual | PROFESSIONAL_KNOWLEDGE | **NONE** | 0 | 0.95 | INSUFFICIENT_EVIDENCE |
| Pensamiento estratégico en diseño | PROFESSIONAL_KNOWLEDGE | **NONE** | 0 | 0.95 | INSUFFICIENT_EVIDENCE |
| Planificación de contenido | PROFESSIONAL_KNOWLEDGE | **NONE** | 0 | 0.95 | INSUFFICIENT_EVIDENCE |
| Liderazgo creativo | SOFT_SKILL | **NONE** | 0 | 0.95 | INSUFFICIENT_EVIDENCE / TRANSVERSAL |

Resumen EE: **0 STRONG · 2 MODERATE · 3 WEAK · 4 NONE** · avgStrength ≈ 16.2

### Lectura de IA

Inteligencia Artificial (55 MODERATE) + Optimización de prompts (39 WEAK) muestran **uso instrumental / aplicado en flujo creativo** (responsabilidades + diversidad de fuentes), no una especialización funcional autónoma. **No** proponer todavía “IA aplicada a contenidos” como ACTIVE.

## 7. Agrupaciones profesionales

| Agrupación | Skills | Estado documental |
|------------|--------|-------------------|
| Diseño editorial y gráfico | editorial, publicitario | **ACTIVE_CANDIDATE** |
| Diseño instruccional | diseño instruccional | EMERGING_CANDIDATE |
| IA en flujo creativo | IA, prompts | EMERGING_CANDIDATE (soporte) |
| Producción audiovisual | edición audiovisual | **INSUFFICIENT** |
| Estrategia de contenidos | planificación, pensamiento estratégico | **INSUFFICIENT** |
| Liderazgo creativo | liderazgo creativo | TRANSVERSAL / INSUFFICIENT |

## 8. Comparación de nombres de área

| Opción | Veredicto |
|--------|-----------|
| **Diseño y producción de contenidos** | **Recomendada** — clara, incluye editorial/instruccional/audiovisual |
| Diseño de contenidos | Demasiado corta; pierde “producción” |
| Creación y producción de contenidos | Válida; “creación” es más vaga |
| Comunicación y producción de contenidos | Se solapa con Comunicación corporativa |

## 9. Área recomendada

**Diseño y producción de contenidos**

Justificación: cobija las actividades centrales respaldadas (diseño publicitario/editorial) y deja espacio para instruccional y audiovisual cuando la evidencia mejore, sin caer en Marketing, UX/UI o Software.

## 10. Especialidades candidatas

### Diseño editorial y gráfico — ACTIVE_CANDIDATE

- **Definición:** composición de piezas editoriales y publicitarias.  
- **Skills:** Diseño editorial, Diseño publicitario.  
- **Evidencia:** publicitario MODERATE (45); editorial WEAK (5, solo resumen).  
- **Límites:** no pauta, no brand strategy, no UX.  
- **Solape:** Marketing creativo (bajo).

### Diseño instruccional — EMERGING_CANDIDATE

- Evidencia WEAK/genérica; no basta sola como especialidad estable.  
- Mantener como candidata emergente hasta re-extracción/más evidencia.

### IA aplicada a contenidos — EMERGING_CANDIDATE (no ACTIVE)

- Uso instrumental documentado; faltan skills coherentes de especialización.  
- No crear especialidad ACTIVE solo por ChatGPT/prompts.

### Producción audiovisual — INSUFFICIENT

- Skill extraída pero Evidence NONE. Gap probable de extracción/enrichment.

### Estrategia y planificación de contenidos — INSUFFICIENT

- Skills en inventario con Evidence NONE.

## 11. Límites del dominio (fuera)

Marketing estratégico / pauta / analítica de campañas · UX research · desarrollo frontend · programación · gestión administrativa · pedagogía general · comunicación corporativa amplia · Software.

## 12. Gaps de extracción

1. **Drift PDF** — CV Drive ≠ hash extracción 87.  
2. **4 skills NONE** en Evidence pese a estar en PA1 (audiovisual, planificación, pensamiento estratégico, liderazgo).  
3. **Herramientas** (Adobe, CapCut, Figma, etc.) no aparecen en las 9 skills.  
4. Evidencia de varias skills es **corta / name-only / solo resumen**.  
5. Enrichment id=3 quedó histórico inactivo por el bug de hash (corregido en CLI).

## 13. Riesgos

- Definir dominio con una sola skill CORE (publicitario) sería frágil.  
- Forzar 5–7 especialidades “tipo Software” inventaría radar vacío.  
- Confundir IA instrumental con especialidad.  
- Usar el cargo como sustituto de evidencia.

## 14. Recomendación para MC1.6.1

1. **Re-extraer** el CV actual (nuevo `extractionId`) por drift de PDF.  
2. Re-enriquecer y re-evaluar evidencia sobre la extracción nueva.  
3. Con evidencia reforzada, redactar **contrato funcional** del área *Diseño y producción de contenidos* con:  
   - 1 especialidad ACTIVE (editorial/gráfico)  
   - 1–2 EMERGING (instruccional; IA soporte)  
   - audiovisuales/estrategia solo si Evidence ≥ WEAK sustancial  
4. **No** PA2 / mappings / frontend hasta aprobar el contrato.

## 15. Integridad

| Check | Resultado |
|-------|-----------|
| Extracción 87 sin mutar | sí |
| Una Enrichment activa (4) | sí |
| Una Evidence activa (4) | sí |
| Cero PA2 Software | sí |
| Cero clasificaciones/mappings MC nuevos | sí |
| Cero cambios frontend / catálogo Software | sí |

## 16. Respuesta al criterio de éxito

> ¿Qué actividades profesionales estables construyen la identidad de Nidia?

Con la evidencia actual: **diseño publicitario/editorial** como núcleo; **IA y prompting** como soporte instrumental del flujo creativo; **instruccional** emergente débil; **audiovisual, estrategia y liderazgo** aún insuficientes para especialidad pese a aparecer en la extracción.

Organización propuesta para un futuro dominio MC1:

**Área:** Diseño y producción de contenidos  
→ **Especialidad ACTIVE candidata:** Diseño editorial y gráfico  
→ **Emergentes:** Diseño instruccional; IA en flujo creativo (soporte)  
→ **Skill → Evidencia** cuando la re-extracción refuerce NONE/WEAK.
