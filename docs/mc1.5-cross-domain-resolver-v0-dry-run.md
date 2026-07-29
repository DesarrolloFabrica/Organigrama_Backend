# MC1.5 — Cross-Domain Resolver v0 (dry-run)

**Estado:** CDR v0 implementado · validación PG no requerida para fixtures  
**Versiones:** `resolverVersion = CDR-0.1.0` · `policyVersion = CDRP-0.1.0`  
**Declaración:** **CDR v0 es diagnóstico y no publicable.**

---

## 1. Propósito

Consumir un **Evaluation Set** completo y producir una propuesta de **Professional Classification** determinística, explicable y reproducible, **sin persistir** ni alterar publicación (`is_active`, Publication Policy, API).

Pipeline conceptual:

```text
gates determinísticos
  → reglas estructurales (qualifications)
  → Affinity Vector (métricas normalizadas)
  → clasificación profesional provisional
```

---

## 2. Contrato de entrada

```ts
interface McCrossDomainResolverInput {
  evaluationSet: McEvaluationSetSnapshot;
  policy: McCrossDomainResolverPolicy;
}
```

El snapshot incluye como mínimo: `evaluationSetId`, `personId`, `setStatus`, `schemaVersion`, `qualificationPolicyVersion`, `candidateDomains`, outcomes por dominio, evaluaciones/especialidades vinculadas, `contextHash`, `warnings`.

**No** se usan evaluaciones sueltas ni el flag `is_active`.

---

## 3. Elegibilidad

Función: `assessEvaluationSetResolverEligibility`.

| Estado del set | Resoluble (v0 default) |
| -------------- | ---------------------: |
| COMPLETE       |                    sí |
| PARTIAL        |                    no (`PARTIAL_SET_NOT_ALLOWED`) |
| RUNNING        |                    no |
| FAILED         |                    no |

Resolver-ready mínimo: una persona, candidatos congelados, sin duplicados, outcomes terminales, evaluaciones vinculadas en `SUCCEEDED`, qualifications válidas, sin dominio `FAILED` (≠ `OUTSIDE`).

`allowPartialSets = false` por defecto (experimental si se activa).

---

## 4. Qualifications como gates

Solo dominios `SUCCEEDED` con qualification válida participan en comparación.

| Outcome dominio | Semántica CDR |
| --------------- | ------------- |
| SUCCEEDED       | comparable si qualification presente |
| FAILED          | set no resoluble |
| SKIPPED / NOT_EVALUATED | no resoluble salvo política parcial |
| OUTSIDE (qualification) | fuera del universo; no es FAILED |
| NOT_EVALUATED (status) | ≠ falta de afinidad |

---

## 5. Affinity Vector v0

Vector **diagnóstico**. No score final. Dimensiones sin fuente real → `NOT_AVAILABLE`.

| Dimensión | Disponible | Uso | Normalización |
| --------- | ---------: | --- | ------------- |
| qualificationLevel | USABLE | gate ordinal | 0–3 |
| activeSpecialtyCount | DIAGNOSTIC_ONLY | no decide | raw |
| emergentSpecialtyCount | DIAGNOSTIC_ONLY | diagnóstico | raw |
| hiddenSpecialtyCount | DIAGNOSTIC_ONLY | diagnóstico | raw |
| activeSpecialtyRatio | USABLE | comparación | active / specialtyCount (null si den=0) |
| bestSpecialtyStrength | USABLE | comparación | max strength |
| topKSpecialtyStrength | USABLE | comparación | avg top-K |
| evidenceCoverage | USABLE | comparación | mean coverage |
| evidenceConfidence | USABLE | comparación | mean confidence |
| mappedEvidenceRatio | DIAGNOSTIC_ONLY | warning | evidenced/mapped |
| evidenceQuality | NOT_AVAILABLE | — | — |
| unmappedEvidenceRatio | NOT_AVAILABLE | — | — |

**Prohibido** decidir dominancia por cardinalidades crudas (`activeCount`, más specialties, más mappings).

---

## 6. Reglas v0

| Regla | Patrón | Resultado provisional |
| ----- | ------ | --------------------- |
| R1 | 1 PRIMARY, resto OUTSIDE | `DOMINANT_PRACTICE` |
| R2 | 1 PRIMARY + ≥1 SECONDARY | `PRIMARY_WITH_COMPLEMENTARY` (salvo conflicto de fuerza) |
| R3 | 2 PRIMARY | comparación multidimensional → HYBRID / COMPLEMENTARY / AMBIGUOUS |
| R4 | ≥3 PRIMARY | `AMBIGUOUS` |
| R5 | todos SECONDARY | `AMBIGUOUS` (SECONDARY ≠ ausencia) |
| R6 | todos OUTSIDE | `NO_SUPPORTED_DOMAIN` |
| R7 | todos INSUFFICIENT | `INSUFFICIENT_EVIDENCE` |
| R8 | INSUFFICIENT + OUTSIDE sin positivos | `INSUFFICIENT_EVIDENCE` |
| F12 | PRIMARY débil vs SECONDARY fuerte | `AMBIGUOUS` + `QUALIFICATION_STRENGTH_CONFLICT` |

Dos PRIMARY no implican híbrido automático. Híbrido conservador emite `HYBRID_INDEPENDENCE_NOT_FULLY_VERIFIED`.

Dominancia entre dos PRIMARY: ≥ `minimumComparableDimensions` (2) con margen relativo `dominanceMargin` (0.15) y 0 victorias del otro.

---

## 7. Professional Classification

| Tipo | Regla v0 |
| ---- | -------- |
| DOMINANT_PRACTICE | R1 |
| PRIMARY_WITH_COMPLEMENTARY | R2 o R3 unbalanced |
| HYBRID_PRACTICE | R3 comparable + warning independencia |
| AMBIGUOUS | R4, R5, conflicto fuerza, métricas insuficientes |
| INSUFFICIENT_EVIDENCE | R7, R8 |
| NO_SUPPORTED_DOMAIN | R6 |
| UNRESOLVED | set no elegible |

---

## 8. Posiciones de dominio

`DOMINANT` · `CO_DOMINANT` · `COMPLEMENTARY` · `SUPPORTED` · `WEAK_SIGNAL` · `NON_REPRESENTATIVE` · `INSUFFICIENT` · `NOT_COMPARABLE`

---

## 9. Explicación

Plantillas + códigos estables (`summaryCode`). Sin IA, sin PII, sin cargo/área/CV.

Códigos: `SINGLE_PRIMARY_REST_OUTSIDE`, `PRIMARY_WITH_SECONDARY_SUPPORT`, `MULTIPLE_PRIMARY_COMPARABLE`, `MULTIPLE_PRIMARY_UNBALANCED`, `MULTIPLE_PRIMARY_UNRESOLVED`, `THREE_PRIMARY_UNRESOLVED`, `ALL_SECONDARY_AMBIGUOUS`, `ALL_OUTSIDE`, `ALL_INSUFFICIENT`, `MIXED_INSUFFICIENT_AND_OUTSIDE`, `PARTIAL_SET_NOT_ALLOWED`, `FAILED_DOMAIN_PRESENT`, `QUALIFICATION_STRENGTH_CONFLICT`, …

---

## 10. Confidence bands

No es probabilidad.

| Banda | Cuándo |
| ----- | ------ |
| HIGH | R1 estructural clara |
| MEDIUM | dominante + complemento / desbalance claro |
| LOW | híbrido, conflicto, ≥3 PRIMARY, todos SECONDARY |
| NOT_APPLICABLE | UNRESOLVED / sin dominio / evidencia insuficiente |

---

## 11. Policy

```ts
DEFAULT_CDR_V0_POLICY = {
  resolverVersion: 'CDR-0.1.0',
  policyVersion: 'CDRP-0.1.0',
  allowPartialSets: false,
  hybridMode: 'CONSERVATIVE',
  comparisonDimensions: [...],
  minimumComparableDimensions: 2,
  topK: 2,
  dominanceMargin: 0.15,
}
```

---

## 12. Fixtures

| Fixture | Resultado v0 | Confidence | Regla |
| ------- | ------------ | ---------- | ----- |
| F01 | DOMINANT_PRACTICE | HIGH | SINGLE_PRIMARY_REST_OUTSIDE |
| F02 | PRIMARY_WITH_COMPLEMENTARY | MEDIUM | PRIMARY_WITH_SECONDARY_SUPPORT |
| F03 | HYBRID_PRACTICE | LOW | MULTIPLE_PRIMARY_COMPARABLE |
| F04 | PRIMARY_WITH_COMPLEMENTARY | MEDIUM | MULTIPLE_PRIMARY_UNBALANCED |
| F05 | AMBIGUOUS | LOW | THREE_PRIMARY_UNRESOLVED |
| F06 | AMBIGUOUS | LOW | ALL_SECONDARY_AMBIGUOUS |
| F07 | NO_SUPPORTED_DOMAIN | N/A | ALL_OUTSIDE |
| F08 | INSUFFICIENT_EVIDENCE | N/A | ALL_INSUFFICIENT |
| F09 | INSUFFICIENT_EVIDENCE | N/A | MIXED_INSUFFICIENT_AND_OUTSIDE |
| F10 | UNRESOLVED | N/A | PARTIAL_SET_NOT_ALLOWED |
| F11 | UNRESOLVED | N/A | FAILED_DOMAIN_PRESENT |
| F12 | AMBIGUOUS | N/A→LOW | QUALIFICATION_STRENGTH_CONFLICT |
| F13 | UNRESOLVED | N/A | MISSING_CANDIDATE_OUTCOME |
| F14 | UNRESOLVED | N/A | DUPLICATE_DOMAIN |
| F15 | = F01 (orden invertido) | HIGH | SINGLE_PRIMARY_REST_OUTSIDE |

---

## 13. Pruebas y CLI

```powershell
npx jest --testPathPatterns=mc-cross-domain-resolver.spec --runInBand
npm run mc:resolve-set:dry -- --fixture=F01
npm run mc:resolve-set:dry -- --fixture=all
```

Modo `--evaluation-set-id` es **read-only** y requiere `--i-confirm-readonly` + PG local (sigue bloqueado en este entorno).

---

## 14. Limitaciones

- No score escalar definitivo / no calibración.
- Independencia de evidencia cross-domain **no verificable** hoy (no se inventa).
- `unmappedEvidenceRatio` / `evidenceQuality` no disponibles en snapshot.
- No persistencia, no publicación, no API.
- Visual Design no se favorece artificialmente; warnings de cobertura/madurez son diagnósticos.

---

## 15. Riesgos

- Margen `0.15` provisional.
- Catálogos de distinto tamaño pueden sesgar ratios → `DOMAIN_CARDINALITY_IMBALANCE`.
- SECONDARY global → AMBIGUOUS (tratamiento definitivo abierto).

---

## 16. Decisiones cerradas

- Consume Evaluation Sets, no evaluaciones sueltas.
- PARTIAL no se resuelve por defecto.
- PRIMARY_MATCH no domina automáticamente en conflictos de fuerza.
- Dos PRIMARY_MATCH no implican híbrido.
- Todos OUTSIDE → NO_SUPPORTED_DOMAIN; todos INSUFFICIENT → INSUFFICIENT_EVIDENCE.
- Explicación determinística; resultado independiente de `is_active`.
- v0 no persiste ni publica.

---

## 17. Decisiones abiertas

- Fórmula definitiva de afinidad y deltas.
- Mínimo de evidencia para híbrido e independencia semántica.
- Tratamiento definitivo de todos SECONDARY.
- Resolución opcional de PARTIAL.
- Confidence cuantitativa / calibración por dominio.
- Reglas publicables y persistencia de classification.

---

## 18. Siguiente fase recomendada

**1C.6 — Domain Affinity Vector formal**, antes de un dataset de calibración amplio (1C.5).

Motivo: el v0 ya expone qué dimensiones son `USABLE` vs `NOT_AVAILABLE`. Formalizar el vector (fuentes, normalización cross-domain, independencia de evidencia) reduce ambigüedad estructural antes de calibrar pesos estadísticos sobre datos incompletos.

---

## Métricas auditadas (contrato real)

| Métrica | Existe | Nivel | Tipo | Comparable | Uso v0 |
| ------- | -----: | ----- | ---- | ---------: | ------ |
| domainQualification | sí | dominio | enum | sí (ordinal) | USABLE |
| activeCount / emergent / hidden | sí | evaluación | int | no crudo | DIAGNOSTIC_ONLY |
| specialtyCount | sí | evaluación | int | denominador | USABLE (ratio) |
| specialty strength / coverage / confidence | sí | specialty | number | sí (norm.) | USABLE |
| mapped/evidenced skill counts | sí | specialty | int | diagnóstico | DIAGNOSTIC_ONLY |
| qualityTier | no en set | — | — | — | NOT_AVAILABLE |
| unmapped inventory | no | — | — | — | NOT_AVAILABLE |
| evidence independence IDs cross-domain | no verificable | — | — | — | NOT_AVAILABLE |
| is_active | sí | evaluación | bool | — | **prohibido** |
| cargo / área / jefe | fuera de MC1 | — | — | — | **prohibido** |
