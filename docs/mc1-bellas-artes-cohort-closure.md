# Cierre — Cohorte Carlos Andrés Rodríguez / Escuela de Bellas Artes

**Fecha:** 2026-08-12
**Veredicto:** `CARLOS_BELLAS_ARTES_BRANCH_VALIDATED_WITH_TAXONOMY_DEBT`
**Catálogo unificado:** `1.12.0`
**Artefactos:** `tmp/mc1-carlos-bellas-artes-branch/`

## Estado operativo

- BD visual v4: Carlos 1080 + **12** hijos directos activos = **13**.
- Captura visual coincidía con los 12 hijos (1 mismatch menor de nombre resuelto: Derlin).
- 12/12 con CV procesados (1 sin CV: Derlin 1137).
- 11/12 `mc1Profile` **AVAILABLE** con dominio primario publicable.
- 2 `PRIMARY_TAXONOMY_PENDING` (Anderson 1340, Andrea 1114).
- 1 `SECONDARY_TAXONOMY_PENDING` (Omar 1124 — architecture, no analizado).
- Cloud writes = 0. Sin deploy. Sin foundations creadas.

## Perfiles disponibles (conservados exactamente como están)

| Persona | Id | Primary | Gate |
|---|---|---|---|
| Carlos Andrés Rodríguez | 1080 | EDUCATION | PUBLISHABLE |
| Ángela María Falla Arango | 1075 | VISUAL_DESIGN | PUBLISHABLE |
| Sebastián Mora Rojas | 1105 | AUDIOVISUAL_PRODUCTION | PUBLISHABLE |
| Manuel Fernando González Sarmiento | 1106 | EDUCATION | PUBLISHABLE |
| Omar Andrés Ortiz Barrera | 1124 | VISUAL_DESIGN | PUBLISHABLE |
| Yuri Astrid Maecha Garzón | 1133 | EDUCATION | PUBLISHABLE |
| Daniel Alfonso Correa Herrera | 1134 | EDUCATION | PUBLISHABLE |
| Oscar David Hernández Bohórquez | 1135 | PROJECT_PROGRAM_MGMT | PUBLISHABLE |
| Daniel Giovanni Julio Acosta | 1136 | EDUCATION | PUBLISHABLE |
| María Alejandra Gallego | 1142 | VISUAL_DESIGN | PUBLISHABLE |
| Andrea Julieth Pinzón Rodríguez | 1114 | *(pending)* | — |
| Anderson Camilo Rojas Garay | 1340 | *(pending)* | — |

## Deuda de taxonomía registrada

### 1. FASHION_DESIGN — Andrea 1114

| Campo | Valor |
|---|---|
| `sourceKey` | `field.fashion_design` |
| `normalizedCandidate` | `FASHION_DESIGN` |
| `pipelineStatus` | `PRIMARY_TAXONOMY_PENDING` |
| `triageDecision` | `FOUNDATION_REQUIRED` |
| `confidence` | 0.85 |
| `coverage` | 0.75 |
| EU práctica real | 28 / 37 (ACTION+RESPONSIBILITY+RESULT+TOOL_USAGE) |

**Por qué no normaliza a `VISUAL_DESIGN`:** VISUAL_DESIGN cubre artefactos visuales bidimensionales y comunicación. El cluster de Andrea gira en torno a la **prenda/colección como producto físico**: patronaje (Audaces Patrones/Tizada), fichas técnicas de producción, desarrollo creativo de colecciones, moda infantil. Ninguna specialty de VD contiene producción textil ni patronaje industrial.

**Comparable previo:** Viviana 1313 (cohorte PD) — secondary débil @ 0.60, dominado por `EDUCATION_SIGNAL`. No cuenta como primary independiente fuerte.

**Condición para foundation:** 1 caso primary adicional con praxis real (colecciones, patronaje, producción textil, tendencias de moda). Andrea 1114 permanece `PRIMARY_TAXONOMY_PENDING` hasta entonces.

**Clusters candidatos (future foundation V1):**
- Diseño y conceptualización de colecciones
- Producción textil y patronaje
- Investigación de tendencias y mercado de moda
- Branding e identidad de marca de moda
- Comercialización y e-commerce de moda

---

### 2. INDUSTRIAL_OPERATIONS — Anderson 1340

| Campo | Valor |
|---|---|
| `sourceKey` | `field.industrial_operations_management` |
| `normalizedCandidate` | `INDUSTRIAL_OPERATIONS` |
| `pipelineStatus` | `PRIMARY_TAXONOMY_PENDING` |
| `triageDecision` | `FOUNDATION_REQUIRED_DEFERRED` |
| `confidence` | 0.88 |
| `coverage` | 0.85 |
| EU práctica real | 47 / 55 (ACTION+RESPONSIBILITY+RESULT+METHODOLOGY) |

**Señal P2:** `MODEL_WARNING` explícito — *"Industrial Operations & Plant Engineering falls outside the standard known fields catalog"*.

**Por qué no normaliza a dominios existentes:**

| Dominio | Razón de exclusión |
|---|---|
| `PROJECT_PROGRAM_MGMT` | PPM gestiona proyectos/alcance/cronograma. Anderson gestiona operaciones físicas de planta continua. |
| `FINANCE_ADMIN` | Optimización de costos es subproducto de la operación productiva, no práctica financiera autónoma. |
| `DATA_ANALYTICS` | KPIs son herramienta de seguimiento operativo, no dominio analítico. |
| `IT_SYSTEMS` / `SOFTWARE_ENGINEERING` | Sin evidencia. |
| `EDUCATION` | Correcto como secondary (docencia real confirmada). |

**Comparable:** Ninguno en ~60+ perfiles procesados. Caso único.

**Condición para foundation:** 1 caso comparable independiente con praxis industrial de planta. Anderson 1340 permanece `PRIMARY_TAXONOMY_PENDING` hasta entonces.

**Clusters candidatos (future foundation V1):**
- Operaciones y dirección de planta industrial
- Producción y gestión de capacidad productiva
- Calidad y control de procesos
- Mejora continua y estandarización (Lean, balanceo de líneas)
- Articulación técnica academia-sector productivo

---

### 3. ARCHITECTURE — Omar 1124

| Campo | Valor |
|---|---|
| `sourceKey` | `field.architecture` |
| `normalizedCandidate` | `ARCHITECTURE` |
| `pipelineStatus` | `SECONDARY_TAXONOMY_PENDING` |
| `triageDecision` | `NOT_ANALYZED_THIS_PHASE` |

Debt registrado. No analizado. Omar tiene primary VISUAL_DESIGN publicable. Architecture opera como secondary debt sin bloquear el perfil.

---

## Candidatos de dominio abiertos para comparación futura

```
FASHION_DESIGN       → watch: colecciones, patronaje, confección, moda, vestuario, textil, tendencias de moda
INDUSTRIAL_OPERATIONS → watch: operaciones industriales, producción, manufactura, planta, balanceo, calidad operativa
ARCHITECTURE          → watch: arquitectura, diseño arquitectónico, construcción, urbanismo, BIM
```

**Política:** la aparición de evidencia comparable en futuras cohortes debe disparar **revisión de la deuda**, no creación automática de foundation.

---

## Control de sesgo contextual — Bellas Artes

- `BELLA_ARTES` / `ARTS` / `CREATIVE` / `CREATIVE_INDUSTRIES` → no creados como dominio. Correcto.
- `VISUAL_DESIGN` apareció en 3 personas con praxis visual demostrada (Ángela, Omar, María Alejandra). No por contexto.
- `EDUCATION` apareció en 5 personas con praxis docente/gestión académica real. No por cargo.
- `AUDIOVISUAL_PRODUCTION` apareció en 1 persona (Sebastián) con praxis audiovisual demostrada.

No se detectó sobreclasificación de EDUCATION por contexto universitario.

---

## Explícitamente fuera de alcance

- No implementar `FASHION_DESIGN`, `INDUSTRIAL_OPERATIONS`, `ARCHITECTURE`.
- No recodificar P2/R1/P3/P4/Gate/Profile de ningún perfil.
- No deploy / no Cloud / no MC1 adicional.
- No avanzar a otras ramas desde este documento.

**COHORTE CERRADA.**
