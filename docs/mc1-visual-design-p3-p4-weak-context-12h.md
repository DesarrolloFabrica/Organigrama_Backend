# MC1 — FASE 12H: Diseño contractual WEAK como routing context (P3→P4)

**Fase:** 12H  
**Modo:** DISEÑO ONLY (sin implementación, sin Gemini, sin cambios productivos)  
**Partida:** 12G `P4_DRIFT_ROOT_CAUSE_IDENTIFIED` → causa dominante `P3_CONTEXT_LOSS`  
**Decisión:** `P3_P4_WEAK_CONTEXT_DESIGN_READY`

No se modifica: mapper 12E, Publication Gate, catálogo, prompts productivos (solo se especifica el delta de prompt para 12I).

---

## 1. Problema a resolver

```
Evidence → sibling WEAK en P3
        → WEAK excluido de specialtiesEvaluated (P4)
        → GRAPHIC único (o residual) OBSERVED
        → skill específica absorbida por GRAPHIC
```

Objetivo del diseño: **evitar la pérdida de destino de clasificación** sin:

- promover WEAK→OBSERVED;
- permitir que P4 autorice specialties publicables;
- inventar specialties NOT_EMITTED.

---

## 2. Semántica P3 preservada (inmutable)

| Status P3 | Significado | Publicable como specialty | ¿Routing P4? (propuesto) |
|-----------|-------------|---------------------------|---------------------------|
| **OBSERVED** | Evidencia suficiente para specialty | Sí (vía Profile desde P3) | Sí — destino autoritativo |
| **WEAK** | Plausible, evidencia insuficiente para OBSERVED | **No** | Sí — **solo** candidato de routing |
| **NOT_EMITTED / ausente** | No propuesta por P3 | No | **No** — P4 no inventa |

Regla dura del diseño:

> WEAK en input P4 ≠ OBSERVED.  
> WEAK routing eligible ≠ specialty publishable.

---

## 3. Autoridad por capa (modelo elegido)

| Preocupación | Autoridad | Notas |
|--------------|-----------|-------|
| Existencia de specialty candidata | **P3** | Solo códigos de catálogo emitidos por P3 |
| Evidence status (OBSERVED/WEAK) | **P3** | P4 no muta status |
| Placement skill → specialty | **P4** | Entre destinos *permitidos* (OBSERVED + routing WEAK) |
| Field resolution | **R1** | Sin cambio |
| Publishability Field tab | **Publication Gate** | Sin cambio; usa specialties OBSERVED de P3 |
| Publishability specialty chips | **Profile Assembly ← P3 OBSERVED only** | Hoy ya es así (`listObservedP3Specialties`) |
| Radar axes | **Profile + mapper 12E** | Skills OBSERVED de P4, incl. las colocadas bajo parent WEAK |

### Contradicciones con contratos actuales

| Contrato actual | Tensión | Resolución de diseño |
|-----------------|---------|----------------------|
| `resolveObservedSpecialties` solo OBSERVED | Impide routing a WEAK | Extender input; **no** cambiar significado de OBSERVED |
| Prompt: “emit a result for each specialty evaluated” | Si WEAK entra como evaluated “igual”, se confunde con autorización | Separar roles: `AUTHORITATIVE` vs `ROUTING_CANDIDATE` |
| Normalize: skill debe coincidir bucket specialty | OK si WEAK es bucket de routing | Permitir `specialtyResults` para routing candidates **sin** marcar specialty OBSERVED |
| `p3Unchanged: true` en P4 | Impide promoción in-place | Mantener; corroboración es señal **lateral**, no mutación P3 |
| Profile lista specialties solo P3 OBSERVED | Skills bajo parent WEAK no tienen chip OBSERVED | **Deseable**; documentar presentación (skill visible, specialty no promovida) |

No hay contradicción con Publication Gate (opera a nivel Field + count de specialties OBSERVED del block, alimentado por P3).

---

## 4. Caso crítico: GRAPHIC OBSERVED + MOTION WEAK + evidencia Motion inequívoca

### Alternativas

| | Comportamiento | Circularidad | Riesgo publicación | Veredicto |
|---|----------------|--------------|--------------------|-----------|
| **A** | Skill bajo MOTION; specialty sigue WEAK/no publicable | Baja | Bajo si Profile no promueve | Viable |
| **B** | Igual que A + señal `specialtyCorroborationHints` para fase posterior (sin mutar P3) | Baja | Bajo | **Elegida** |
| **C** | P4 promueve MOTION→OBSERVED | Alta (P4 reclasifica specialties) | Alto (tabs/chips silenciosos) | **Rechazada** |

### Elección: **B** (con placement de A)

1. P4 coloca la skill bajo `MOTION_DESIGN` (routing candidate).  
2. P3 permanece `MOTION=WEAK`.  
3. P4 emite hint opcional de corroboración (evidencia + specialtyCode), **sin** segundo clasificador de specialties y **sin** write-back a P3.  
4. Una fase posterior (p.ej. P3 re-eval / “corroboration consumer”) *puede* usar el hint; 12H no lo implementa.

Esto evita circularidad: P4 no decide existence/status; solo placement + señal auditabe.

---

## 5. Routing anti catch-all GRAPHIC

Política propuesta (prompt/contract, no hardcoded por persona):

Cuando existan **routing candidates** o OBSERVED más específicos que `GRAPHIC_DESIGN`, y la evidencia/práctica de la skill sea **claramente** de ese sibling, P4 **debe preferir** ese destino frente a GRAPHIC.

Ejemplos canónicos (catálogo, no personas):

| Práctica | Destino preferido |
|----------|-------------------|
| maquetación / diagramación editorial | EDITORIAL_DESIGN |
| branding / identidad / lineamientos | BRAND_IDENTITY_DESIGN |
| ilustración digital / personajes | ILLUSTRATION |
| motion graphics / animación gráfica | MOTION_DESIGN |

`GRAPHIC_DESIGN` permanece válido para práctica gráfica transversal (piezas, producción gráfica general, advertising layout genérico).

Regla de desempate: **más específico gana** si el candidato está en `routingEligible`; si solo hay GRAPHIC OBSERVED y el sibling es NOT_EMITTED → GRAPHIC (no inventar).

---

## 6. Casos UPSTREAM_DRIFT (NOT_EMITTED)

| Caso 12G | P3 | ¿WEAK context ayuda? |
|----------|----|--------------------|
| Luis — Ilustración Gráfica… | ILLUSTRATION **ausente** | **No** — no hay routing candidate |
| Oswaldo — Diseño de Identidad Visual | BRAND **ausente** | **No** |

**No** ampliar P4 para inventar specialties NOT_EMITTED.

Fase posterior sugerida: **P3** (umbrales / cobertura de señales) o auditoría de catálogo de specialties — **no** P4 placement.

---

## 7. Reproducción conceptual cohorte 12G (8 confirmados)

Convención:

- **Placement esperado:** skill bajo sibling específico.  
- **Publication consequence:** specialty chips / Gate **sin** promover WEAK; skill sí puede alimentar radar.

| # | Evidence (práctica) | P3 | P4 input actual | Placement actual | P4 input propuesto | Placement esperado | Publication |
|---|---------------------|----|-----------------|------------------|--------------------|--------------------|-------------|
| 1 | Animación / edición video+animación (Darío) | GRAPHIC+UX OBS; **MOTION WEAK** | GRAPHIC+UX (+EDU) | GRAPHIC | + MOTION as routing | **MOTION** | MOTION no chip OBSERVED; skill→radar Motion si wording lo permite |
| 2 | Ilustración digital (Diego) | GRAPHIC+BRAND OBS; **ILLUSTRATION WEAK** | GRAPHIC+BRAND | GRAPHIC | + ILLUSTRATION routing | **ILLUSTRATION** | ILLUSTRATION no publicada como OBSERVED |
| 3 | Editorial + graphic production (Diego) | **EDITORIAL WEAK** | sin EDITORIAL | GRAPHIC | + EDITORIAL routing | **EDITORIAL** (o split si híbrida) | EDITORIAL no chip OBSERVED |
| 4 | Branding / identidad (Hari) | GRAPHIC+EDITORIAL OBS; **BRAND WEAK** | sin BRAND | GRAPHIC | + BRAND routing | **BRAND** | BRAND no chip OBSERVED |
| 5 | Maquetación editorial (Luis) | GRAPHIC OBS; **EDITORIAL WEAK** | solo GRAPHIC | GRAPHIC | + EDITORIAL routing | **EDITORIAL** | idem |
| 6 | Motion Graphics (Oswaldo) | GRAPHIC+EDITORIAL OBS; **MOTION WEAK** | sin MOTION | GRAPHIC | + MOTION routing | **MOTION** | idem |
| 7 | Ilustración (Luis) | ILLUSTRATION **NOT_EMITTED** | solo GRAPHIC | GRAPHIC | *igual* (sin candidate) | GRAPHIC | **Sin cambio** — fuera de alcance WEAK context |
| 8 | Identidad visual (Oswaldo) | BRAND **NOT_EMITTED** | sin BRAND | GRAPHIC | *igual* | GRAPHIC | **Sin cambio** — UPSTREAM |

**Cobertura del diseño:** corrige los **6** `P3_CONTEXT_LOSS`; **no** los 2 `UPSTREAM_DRIFT`.

---

## 8. Publication Gate — invariantes

Verificación explícita:

| Riesgo | ¿Introducido por WEAK routing? | Mitigación |
|--------|--------------------------------|------------|
| Tabs vacíos | No | Gate Field-level; specialties del block siguen siendo P3 OBSERVED |
| Specialties nuevas visibles | No si Profile no lista WEAK | Mantener `listObservedP3Specialties` |
| Secondary fields incorrectos | No | R1 + Gate intactos |
| Cambios silenciosos de dominio | No | P4 no toca R1 (`r1Unchanged`) |
| Skill bajo specialty “fantasma” | Presentación | UI: mostrar skill con `parentSpecialtyCode` + flag `p3Status=WEAK` / no listar en chips OBSERVED |

**Invariante contractual:**

```
routingCandidate (WEAK)  =/=>  publishable specialty
routingCandidate (WEAK)  =/=>  P3 status mutation
skill.parentSpecialtyCode = WEAK code  =>  allowed for placement + radar
                           =/=>  specialty appears in Profile.specialties[]
```

---

## 9. Contrato P4 propuesto (mínimo)

### 9.1 Before (actual `1.0.0`)

```json
{
  "specialtiesEvaluated": [
    {
      "fieldCode": "VISUAL_DESIGN",
      "specialtyCode": "GRAPHIC_DESIGN",
      "p3Status": "OBSERVED",
      "p3Confidence": 0.9
    }
  ]
}
```

Solo OBSERVED. Prompt: evaluar exactamente esa lista.

### 9.2 After (propuesto `1.1.0` conceptual)

Opción elegida: **un solo arreglo tipado con rol**, más simple que dos listas paralelas y compatible con normalize actual.

```json
{
  "specialtiesEvaluated": [
    {
      "fieldCode": "VISUAL_DESIGN",
      "specialtyCode": "GRAPHIC_DESIGN",
      "p3Status": "OBSERVED",
      "p3Confidence": 0.9,
      "evaluationRole": "AUTHORITATIVE_TARGET",
      "routingEligible": true,
      "publishableFromP3": true
    },
    {
      "fieldCode": "VISUAL_DESIGN",
      "specialtyCode": "MOTION_DESIGN",
      "p3Status": "WEAK",
      "p3Confidence": 0.55,
      "evaluationRole": "ROUTING_CANDIDATE",
      "routingEligible": true,
      "publishableFromP3": false
    }
  ],
  "routingPolicyVersion": "12H.1",
  "specialtyResults": [
    {
      "fieldCode": "VISUAL_DESIGN",
      "specialtyCode": "MOTION_DESIGN",
      "observedSkills": [ { "skillCode": "motion_graphics_design", "parentSpecialtyCode": "MOTION_DESIGN", "status": "OBSERVED", "...": "..." } ],
      "notes": "routing_candidate_bucket"
    }
  ],
  "specialtyCorroborationHints": [
    {
      "fieldCode": "VISUAL_DESIGN",
      "specialtyCode": "MOTION_DESIGN",
      "p3Status": "WEAK",
      "supportingEvidenceUnitIds": ["ceu_..."],
      "hintCode": "SKILL_EVIDENCE_CORROBORATES_WEAK_SPECIALTY",
      "doesNotMutateP3": true
    }
  ],
  "r1Unchanged": true,
  "p3Unchanged": true
}
```

Campos nuevos mínimos:

| Campo | Dónde | Propósito |
|-------|-------|-----------|
| `evaluationRole` | input evaluated | AUTHORITATIVE_TARGET \| ROUTING_CANDIDATE |
| `routingEligible` | input | bool explícito |
| `publishableFromP3` | input | espejo de semántica; P4 no lo interpreta como permiso de publicación |
| `specialtyCorroborationHints` | output opcional | señal B sin mutar P3 |
| `routingPolicyVersion` | payload | auditabilidad |

**ABSTAIN:** si no hay ningún `AUTHORITATIVE_TARGET` (cero OBSERVED), P4 sigue absteniéndose (`ABSTAINED_NO_OBSERVED_SPECIALTY`). WEAK solo no autoriza corrida P4.

### 9.3 Delta de prompt (especificación, no aplicar aún)

Añadir bloque corto:

- Distinguir AUTHORITATIVE vs ROUTING_CANDIDATE.  
- Preferir sibling específico eligible sobre GRAPHIC cuando la práctica sea inequívoca.  
- No tratar ROUTING_CANDIDATE como specialty confirmada.  
- Emitir skills bajo el destino elegido; hints de corroboración opcionales.

Versión prompt sugerida en 12I: `MC1.P4.PROMPT.FUNCTIONAL.1.1.0` (bump menor).

---

## 10. Impacto de implementación (12I — no ahora)

| Área | ¿Cambia? | Notas |
|------|----------|-------|
| `p4-context-loader.ts` | **Sí** | Incluir WEAK como ROUTING_CANDIDATE |
| `p4.types.ts` | **Sí** | v contrato `1.1.0` + campos rol/hints |
| `p4-prompt-v1.ts` | **Sí (mínimo)** | Política routing; no reescribir misión |
| `p4-normalize.ts` | **Sí (mínimo)** | Aceptar buckets routing; no promover publishable |
| `p4-runner.ts` | Menor | Pasar nuevos campos a fingerprint |
| Catálogo specialties | No | |
| R1 / Publication Gate | No | |
| Mapper 12E | No | |
| Profile Assembly | **Opcional mínimo** | Asegurar specialties[] solo P3 OBSERVED (ya); posiblemente flag UI skill↔WEAK |
| Persistencia productiva | No (ARTIFACT_ONLY) | |
| Runs anteriores | Compat | Packs `1.0.0` sin `evaluationRole` ⇒ tratar todos como AUTHORITATIVE |
| Tests | Sí | Loader WEAK→routing; no abstenerse solo-WEAK; placement MOTION; Gate/Profile no publican WEAK; fingerprint |

### Cambio mínimo favorecido

1. Loader + types + fingerprint.  
2. Prompt delta pequeño.  
3. Normalize permite results en routing candidates.  
4. Profile: **cero cambio** si ya filtra specialties OBSERVED (verificar con test de caracterización).  
5. Hints de corroboración: opcionales en el mismo slice o slice 12I.1.

---

## 11. Decisión

**`P3_P4_WEAK_CONTEXT_DESIGN_READY`**

Justificación:

- Causa 12G atacada directamente sin degradar semántica WEAK.  
- Autoridad clara (opción B).  
- 6/8 casos corregibles; 2 UPSTREAM diferidos a P3.  
- Gate/mapper/catálogo intactos.  
- Contrato mínimo y versionable.

**No** `REQUIRES_RETHINK`: el modelo de autoridad es coherente.  
**No** `P3_ROOT_CAUSE_REQUIRES_FIX_FIRST`: no hace falta promover WEAK en P3 para desbloquear routing.

---

## 12. Siguiente fase (12I) — fuera de alcance

Implementar contrato `1.1.0`, tests, re-assembly Profile-only sobre packs 12F drift (sin Gemini si se mockea normalize; con Gemini solo si se valida prompt live en slice controlado).

**DETENERSE.** No implementar 12H.
