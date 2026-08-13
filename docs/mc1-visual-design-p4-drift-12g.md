# MC1 — FASE 12G: Diagnóstico de drift P4 (placement bajo GRAPHIC_DESIGN)

**Fase:** 12G  
**Modo:** DIAGNÓSTICO (sin Gemini, sin cambios productivos)  
**Decisión:** `P4_DRIFT_ROOT_CAUSE_IDENTIFIED`  
**Fingerprint cohorte 12F:** `5e7c14e464289c51`  
**Mapper:** `VD_MAPPER_12E_SEMANTIC_BLOB_V1` (no implicado)

Artefactos: `tmp/mc1-visual-design-p4-drift-12g/`

---

## 1. Pregunta

Cuando existe evidencia de una práctica especializada (Brand / Editorial / Motion / Illustration), ¿P4 conserva la relación evidencia → sibling P3 → skill?

---

## 2. Hallazgo dominante

**Causa primaria:** `P3_CONTEXT_LOSS` en la frontera **P3 → P4**.

`resolveObservedSpecialties()` (`p4-context-loader.ts`) **solo pasa specialties con status OBSERVED**. Las specialties **WEAK se excluyen** de `specialtiesEvaluated`.

Consecuencia: si P3 marca `EDITORIAL_DESIGN` / `BRAND_IDENTITY_DESIGN` / `MOTION_DESIGN` / `ILLUSTRATION` como WEAK, P4 **no puede** emitir skills bajo ese sibling. La práctica especializada queda forzada bajo el único bucket residual disponible — casi siempre `GRAPHIC_DESIGN`.

Esto no es un fallo del radar mapper (12E).

---

## 3. Mecanismo contractual / prompt (H7)

| Elemento | Comportamiento actual |
|----------|------------------------|
| Prompt P4 | Evalúa **exactamente** la lista `SPECIALTIES TO EVALUATE` (OBSERVED only) |
| Regla 6 | Skills deben quedarse bajo la specialty evaluada |
| Normalize | Fuerza `parentSpecialtyCode = specialtyCode` del bucket; dropea mismatches |
| Catálogo skills global | **No existe** en P4 8D (códigos provisionales de artefacto) → H5 N/A |

El prompt **no** instruye “asignar cada evidencia al sibling más específico disponible”. Cuando varios OBSERVED coexisten, GRAPHIC puede actuar como atractor (`P4_SPECIALTY_COLLAPSE` / H2). En la cohorte 12F auditada, ese patrón fue **menos frecuente** que el corte WEAK→excluido.

---

## 4. Métricas (cohorte drift 12F + 3 controles)

| Métrica | Valor |
|---------|-------|
| Personas drift | 6 |
| Controles | 3 (Hermida, Juliana, Laura Melisa) |
| Skills drift auditadas | ~19 |
| Sospechosas | 8–16 según umbral wording |
| **Drift confirmado** | **8** |
| False positive / no drift | resto (p.ej. piezas gráficas genéricas; AV sin motion explícito) |
| `P3_CONTEXT_LOSS` | **6 (75%)** |
| `UPSTREAM_DRIFT` | **2 (25%)** — sibling nunca emitido por P3 |
| % P3 ya tenía sibling OBSERVED | **0%** entre confirmados |
| % P4 recibió ese sibling | **0%** entre confirmados |
| % terminó bajo GRAPHIC | **100%** de confirmados |
| Catalog reuse | 0 (provisional only) |

---

## 5. Trazas representativas

Formato: evidencia → P3 → P4 input → skill → specialty asignada

1. **Luis — Diagramación y Maquetación Editorial**  
   Evidencia: maquetación / publicaciones editoriales → P3: GRAPHIC OBSERVED, **EDITORIAL WEAK** → P4 recibe solo GRAPHIC → skill editorial → **GRAPHIC**  
   Root: `P3_CONTEXT_LOSS`

2. **Hari — Branding y Diseño de Identidad Visual**  
   Evidencia: branding / comunicación visual → P3: GRAPHIC+EDITORIAL OBSERVED, **BRAND WEAK** → P4 no recibe BRAND → skill brand → **GRAPHIC**  
   Root: `P3_CONTEXT_LOSS`

3. **Diego — Editorial Design & Graphic Production**  
   Evidencia: medios editoriales → P3: **EDITORIAL WEAK** → P4 sin EDITORIAL → skill híbrida editorial+graphic → **GRAPHIC**  
   Root: `P3_CONTEXT_LOSS` (+ wording híbrido)

4. **Diego — Digital Illustration**  
   Evidencia: ilustración digital → P3: **ILLUSTRATION WEAK** → P4 sin ILLUSTRATION → skill → **GRAPHIC**  
   Root: `P3_CONTEXT_LOSS`

5. **Oswaldo — Motion Graphics**  
   Evidencia: motion graphics (EXPLICIT/SS) → P3: **MOTION WEAK** → P4 sin MOTION → skill → **GRAPHIC**  
   Root: `P3_CONTEXT_LOSS`

6. **Darío — Edición de Video y Animación Digital**  
   Evidencia: fundamentos de animación → P3: **MOTION WEAK** → P4 sin MOTION → skill → **GRAPHIC**  
   Root: `P3_CONTEXT_LOSS`

7. **Luis — Ilustración Gráfica y Bocetado**  
   Evidencia: bocetos/ilustraciones → P3: ILLUSTRATION **no emitido** → P4 solo GRAPHIC → skill → **GRAPHIC**  
   Root: `UPSTREAM_DRIFT`

8. **Oswaldo — Diseño de Identidad Visual**  
   Evidencia: identidad visual → P3: BRAND **no emitido** → skill brand → **GRAPHIC**  
   Root: `UPSTREAM_DRIFT`

9. **Danna — Producción y edición audiovisual** (no confirmado como drift VD)  
   Evidencia AV sin motion graphics explícita → MOTION NOT_EMITTED → bajo GRAPHIC  
   Root: `EVIDENCE_AMBIGUITY` / `NO_ACTUAL_DRIFT` para siblings VD

10. **Control Juliana — Maquetación y diseño editorial**  
    P3 EDITORIAL **OBSERVED** → P4 recibe EDITORIAL → skill bajo **EDITORIAL_DESIGN**  
    Contraste directo con Luis.

---

## 6. Drift vs controles

| Factor | Drift (p.ej. Luis/Hari) | Control (Juliana/Laura/Hermida) |
|--------|-------------------------|----------------------------------|
| Sibling especializado | WEAK o ausente | OBSERVED |
| `specialtiesEvaluated` P4 | Sin el sibling | Incluye el sibling |
| Placement | Bajo GRAPHIC | Bajo Brand/Editorial/UX/Illustration |
| Evidencia | Similar explícita | Similar explícita |

Conclusión: la diferencia operativa no es “falta de evidencia”, sino **si el sibling llegó OBSERVED hasta P4**.

---

## 7. GRAPHIC_DESIGN como catch-all

**Sí, en dos modos:**

1. **Residual (dominante aquí):** único OBSERVED → absorbe prácticas cuyo sibling quedó WEAK.  
2. **Atractor (secundario / prompt):** con varios OBSERVED, el modelo puede seguir emitiendo práctica especializada bajo GRAPHIC si no hay routing “most specific”.

---

## 8. Motion check

| Persona | P3 MOTION | Evidencia motion explícita | Veredicto |
|---------|-----------|----------------------------|-----------|
| Mayoría cohorte | NOT_EMITTED | 0 | `MOTION_0_EXPECTED` |
| Darío, Oswaldo | WEAK | sí | evidencia presente → **excluida de P4** |
| Hermida (control) | NOT_EMITTED | señales AV/animación en units | `MOTION_EVIDENCE_PRESENT_BUT_P3_NOT_OBSERVED` |

Premiere/CapCut solos **no** se usaron como prueba de Motion.

---

## 9. Hipótesis

| ID | Resultado |
|----|-----------|
| H1 P3_CONTEXT_LOSS | **CONFIRMADA — dominante** |
| H2 P4_SPECIALTY_COLLAPSE | Posible / secundaria (menos en confirmados 12F) |
| H3 SKILL_ASSOCIATION_ERROR | Secundaria (bucket estructural) |
| H4 HYBRID_SKILL_WORDING | Presente en minoría |
| H5 CATALOG_REUSE_BIAS | N/A (P4 8D provisional) |
| H6 EVIDENCE_AMBIGUITY | Presente (AV sin motion) |
| H7 PROMPT/CONTRACT BIAS | Parcial — gate OBSERVED-only + falta routing específico |

---

## 10. Capa exacta donde nace el drift

**Primaria:** frontera **P3 → P4** (`resolveObservedSpecialties` excluye WEAK).  
**Secundaria:** generación P4 / prompt (falta de routing most-specific; GRAPHIC atractor).  
**No:** mapper radar 12E.

---

## 11. Recomendación 12H (sin implementar aquí)

1. **Fix A (mínimo, alinea con causa dominante):** permitir a P4 ver specialties WEAK como *routing hints* (sin obligar emisión) **o** política P3 más estricta WEAK→OBSERVED cuando la práctica editorial/brand/motion sea recurrente y explícita.  
2. **Fix B (separado):** instrucción/contrato P4 de asignación evidencia → sibling más específico entre OBSERVED.  
3. **No tocar** mapper 12E ni Publication Gate en el primer slice.  
4. Motion: solo práctica motion graphics/animación; no tools.

---

## 12. Archivos

- `scripts/mc1-visual-design-p4-drift-12g.ts` (diagnóstico temporal)
- `tmp/mc1-visual-design-p4-drift-12g/diagnosis-report.json`
- `tmp/mc1-visual-design-p4-drift-12g/skill-traces.json`
- `tmp/mc1-visual-design-p4-drift-12g/root-cause-summary.json`
- `tmp/mc1-visual-design-p4-drift-12g/motion-check.json`
- `tmp/mc1-visual-design-p4-drift-12g/analysis-notes.json`
- `tmp/mc1-visual-design-p4-drift-12g/phase-verdict.json`
- `docs/mc1-visual-design-p4-drift-12g.md` (este documento)

**DETENERSE.** No implementar 12H en esta fase.
