# MC1 — FASE 12J: Visual Design remaining siblings LIVE validation

**Decisión:** `VISUAL_DESIGN_REMAINING_SIBLINGS_VALIDATED_WITH_DRIFT`  
**Modo:** LIVE Gemini full pipeline · sin cambios a prompts/catálogo/mapper/R1/Gate/routing  
**Fingerprint:** `7f8451bd6269f6fc`  
**Artefactos:** `tmp/mc1-visual-design-remaining-12j/`

---

## Cohorte exacta (11)

Excluye 12B/12C (`DONE_PERSON_IDS`). Parent Fábrica `1206`.

| # | Persona | personId | snapshot | P0 |
|---|---------|----------|----------|-----|
| 1 | Danna Michelle | 1182 | 23 | REUSED |
| 2 | Dario Fernando | 1175 | 24 | REUSED |
| 3 | Diego Fernando | 1168 | 25 | REUSED |
| 4 | Doris Katherine | 1178 | 26 | REUSED |
| 5 | Hari Steffan | 1188 | 27 | REUSED |
| 6 | Juan Andres Hermida | 1187 | 28 | REUSED |
| 7 | Juan Andres Molano | 1169 | 29 | REUSED |
| 8 | Juliana Sofia | 1186 | 30 | REUSED |
| 9 | Laura Melisa | 1167 | 31 | REUSED |
| 10 | Luis Miguel | 1181 | 32 | REUSED |
| 11 | Oswaldo Enrique | 1170 | 33 | REUSED |

Errores de procesamiento: **0**.

---

## Configuración congelada

| Clave | Valor |
|-------|-------|
| Gemini | `gemini-3.6-flash` |
| Mapper | `VD_MAPPER_12E_SEMANTIC_BLOB_V1` |
| P4 contract | `1.1.0` |
| P4 prompt | `MC1.P4.PROMPT.FUNCTIONAL.1.1.0` |
| Routing policy | `12H.1` |
| Public skill filter | `OBSERVED_P3_PARENT_ONLY_12I` |
| Fingerprint | `7f8451bd6269f6fc` |

---

## Distribuciones

**Dominios (R1 primary):** VISUAL_DESIGN **10** · COMMUNICATIONS **1** (Doris)

**Specialties OBSERVED (VD):** GRAPHIC 10 · EDITORIAL 5 · BRAND 4 · UX 2 · ILLUSTRATION 2

---

## WEAK como ROUTING_CANDIDATE (uso)

| Persona | Candidates | Skills internas bajo WEAK (ej.) | ¿En profile público? |
|---------|------------|----------------------------------|----------------------|
| Darío | MOTION | video_editing, digital_animation | No |
| Diego | EDITORIAL, ILLUSTRATION | editorial + illustration | No |
| Hari | BRAND | (0 skills esta corrida) | — |
| Hermida | GRAPHIC | (0) | — |
| Molano | MOTION | 2d_animation | No |
| Juliana | ILLUSTRATION, BRAND | illustration | No |
| Laura | UX | (0) | — |
| Luis | BRAND, ILLUSTRATION | brand + illustration | No |
| Oswaldo | EDITORIAL, UX, MOTION | editorial + ux + motion | No |
| Danna | UX (+ AUDIO AV) | hints; skills OBSERVED 0 bajo UX | — |
| Doris | JOURNALISM, CORP_COMMS | (comms WEAK; no VD WEAK) | — |

---

## NOT_EMITTED (VD) — P4 no inventó

Ejemplos: Darío sin BRAND/EDITORIAL/ILLUSTRATION; Oswaldo sin BRAND/ILLUSTRATION; Doris casi todos siblings VD ausentes salvo GRAPHIC OBSERVED. Sin anomalía `P4_ROUTING_DRIFT` por invención.

---

## Validaciones específicas

| Check | Resultado |
|-------|-----------|
| GRAPHIC no absorbe cuando sibling WEAK soportado | **OK** en casos 12I (Diego editorial/ilustración, Darío/Oswaldo motion, Luis brand/ilustración). Hari BRAND WEAK sin skill esta corrida (variación LIVE). |
| Skills bajo WEAK internas / no públicas | **OK** — filtro 12I; p.ej. Darío/Diego/Luis/Oswaldo |
| Product UI por substring/tools | Sin `RADAR_DRIFT` de probe/mapper |
| Editorial solo por InDesign | Sin flag |
| Motion solo por tools video | Sin flag |
| NOT_EMITTED inventado | Sin flag |
| OBSERVED publica normalmente | **OK** — chips/skills bajo parents OBSERVED |

---

## Anomalías

| Código | Count | Notas |
|--------|------:|-------|
| `P1_EXTRACTION_DRIFT` | 11 | Todos: `EVIDENCE_WITHOUT_SPANS` (suave, sistémico P1) |
| `EXPECTED_VARIATION` | 1 | Oswaldo: wording brand bajo GRAPHIC con BRAND **NOT_EMITTED** (upstream, esperado) |
| `P4_ROUTING_DRIFT` | 0 | |
| `RADAR_DRIFT` / `PUBLICATION_DRIFT` | 0 | |
| `P2_DOMAIN_DRIFT` / `P3_SPECIALTY_DRIFT` | 0 | |

---

## Personas — revisión humana

Las 11 aparecen en `humanReview` porque el script trata cualquier `P1_EXTRACTION_DRIFT` como revisión. En la práctica el drift duro de routing/radar **no** reapareció; la revisión útil es selectiva:

- **Oswaldo** — identidad visual residual bajo GRAPHIC (BRAND ausente P3).
- **Hari** — BRAND WEAK sin skill emitida (posible thin evidence / variación modelo).
- **Todos** — alerta P1 spans (técnico, no bloqueante de specialties).

---

## Lectura

Tras 12E+12I el pipeline **generaliza** sobre remaining siblings: routing WEAK funciona, filtro público sostiene invariantes, Publication Gate estable. El veredicto WITH_DRIFT se debe al **drift suave P1** (`EVIDENCE_WITHOUT_SPANS` ×11), no a regresión de routing/mapper.

---

## Decisión

**VISUAL_DESIGN_REMAINING_SIBLINGS_VALIDATED_WITH_DRIFT**
