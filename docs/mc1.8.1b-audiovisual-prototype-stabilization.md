# MC1.8.1B — Estabilización del prototipo · Producción Audiovisual

**Fecha:** 2026-07-28  
**Dominio:** `AUDIOVISUAL_PRODUCTION` (estado **PROTOTYPE** — sin cambio)  
**Catálogo activo:** `mc1.8-2026-07-28` (id=3)  
**Referencias:** [`mc1.8.1-audiovisual-prototype-results.md`](mc1.8.1-audiovisual-prototype-results.md) · [`mc1.8.1-audiovisual-prototype-plan.md`](mc1.8.1-audiovisual-prototype-plan.md)

---

## 1. Causa raíz del problema de catálogo

### Síntoma

Tras activar `mc1.8-2026-07-28`, los dry-runs de `VISUAL_DESIGN` y `SOFTWARE` fallaban con:

```
Faltan clasificaciones para dominio VISUAL_DESIGN
```

`AUDIOVISUAL_PRODUCTION` funcionaba correctamente.

### Diagnóstico

| Capa | Estado antes del fix |
|------|----------------------|
| Catálogo activo `mc1.8` | Dominios SOFTWARE, VISUAL_DESIGN, AV **registrados** (dominio + especialidades) |
| Mappings bajo `mc1.8` | Solo **AUDIOVISUAL_PRODUCTION** (36 clasificaciones / 11 mappings) |
| Mappings bajo `mc1.6` (inactivo) | SOFTWARE (59/48) y VISUAL_DESIGN (45/17) **intactos** |
| Pack releases globales | Sin cambios; hashes publicados intactos |
| Evaluaciones históricas | En `catalog_version_id` original (mc1.2 / mc1.6); **no mutadas** |

**Causa raíz:** **seed incompleto por versión de catálogo**, no bug de registry, PA2 ni packs.

En MC1, `mc_skill_domain_classification` y `mc_skill_specialty_mapping` están **scoped por `catalog_version_id`**. Al bump de catálogo (mc1.6 → mc1.8):

1. Se crean nuevos `mc_domain` / `mc_specialty` con IDs distintos.
2. Los mappings **no se copian automáticamente**.
3. MC1.8.1 sembró solo AV; Software y Visual quedaron sin instancia bajo mc1.8.
4. `McPa2Service` filtra clasificaciones por `catalog_version_id` del catálogo **activo** → 0 filas → error.

**No era:** mutación de pack, release ausente en registry, código de dominio incorrecto, ni lookup del registry.

**Evidencia:** `tmp/mc181b-audit-before.json` vs `tmp/mc181b-audit-after.json`.

---

## 2. Corrección aplicada

Operación idempotente de seed (mismos packs publicados, nuevas filas por versión):

```bash
npm run mc:mappings -- --seed --i-confirm-seed --domain=SOFTWARE --catalogVersion=mc1.8-2026-07-28
npm run mc:mappings -- --seed --i-confirm-seed --domain=VISUAL_DESIGN --catalogVersion=mc1.8-2026-07-28
```

| Propiedad | Cumplimiento |
|-----------|--------------|
| Idempotente | Re-ejecutar → `ALREADY_SEEDED` |
| Sin mutar packs | Mismos `content_hash` en `mc_mapping_pack_release` |
| Sin reemplazar releases | 4 releases (sin duplicados) |
| Sin tocar evaluaciones históricas | IDs 1–6 en mc1.2/mc1.6 intactos |
| Sin cambio de código de packs | Solo datos BD por `catalog_version_id` |

**Script de auditoría añadido:** `src/database/scripts/mc181b-audit.ts` → `tmp/mc181b-audit-*.json`.

---

## 3. Inventario de packs y hashes

| Dominio | pack_code | pack_version | content_hash | Estado |
|---------|-----------|--------------|--------------|--------|
| SOFTWARE | `software-mappings` | `mc1.1-camilo-2026-07-27` | `c58af992…9911` | PUBLISHED · intacto |
| VISUAL_DESIGN | `visual-design-mappings` | `1.1.0` | `089ae0f0…5c14c` | PUBLISHED · intacto |
| VISUAL_DESIGN (hist.) | `visual-design-mappings` | `mc1.6-visual-nidia-2026-07-27` | `bc29810c…ed3a` | PUBLISHED · intacto |
| AUDIOVISUAL | `audiovisual-production-mappings` | `1.0.0` | `f75ae6ee…8870` | PUBLISHED · intacto |

### Cobertura mappings por catálogo (después)

| Versión | Dominio | Clasificaciones | Mappings |
|---------|---------|-----------------|----------|
| mc1.8 (activo) | SOFTWARE | 59 | 48 |
| mc1.8 (activo) | VISUAL_DESIGN | 45 | 17 |
| mc1.8 (activo) | AUDIOVISUAL_PRODUCTION | 36 | 11 |
| mc1.6 (histórico) | SOFTWARE / VISUAL | 59 / 45 | 48 / 17 |

---

## 4. Integridad histórica (antes/después)

| Verificación | Antes | Después |
|--------------|-------|---------|
| Hash Software | `c58af992…` | **Igual** |
| Hash Visual 1.1.0 | `089ae0f0…` | **Igual** |
| Hash AV 1.0.0 | `f75ae6ee…` | **Igual** |
| Eval #7 Santiago AV | `evaluation_context_hash=44f518ed…` | **Igual** (reproducible en dry-run) |
| Eval #5 Nidia Visual | `94a71bdc…` | **Sin cambio** |
| Eval #6 Garzón Visual | activa mc1.6 | **Sin cambio** |
| Eval #4 Camilo Software | activa mc1.6 | **Sin cambio** |
| Nuevas evaluaciones persistidas | — | **Ninguna** (MC1.8.1B) |
| Releases duplicados | 4 | **4** (sin duplicados) |

---

## 5. Matriz multidominio (dry-runs, sin persistir)

Clasificación **analítica** (no selección automática de dominio).

| Persona | Dominio | Especialidad principal | A | E | H | Prof. dominante | Tool dominante | Resultado conceptual |
|---------|---------|------------------------|---|---|---|-----------------|----------------|----------------------|
| Santiago `216` | AUDIOVISUAL_PRODUCTION | AV_EDITING | 3 | 0 | 0 | edición, motion, color | Premiere/DaVinci (peso bajo) | **PRIMARY_MATCH** |
| Santiago `216` | VISUAL_DESIGN | — | 0 | 0 | 5 | — | — | **OUTSIDE** |
| Santiago `216` | SOFTWARE | — | 0 | 0 | 7 | — | — | **OUTSIDE** |
| Juan Pablo `208` | AUDIOVISUAL_PRODUCTION | AV_MOTION | 1 | 1 | 1 | animación 2D/3D | AE (companion) | **PRIMARY_MATCH** / BORDERLINE |
| Juan Pablo `208` | VISUAL_DESIGN | — (IDENTITY EMERGENT) | 0 | 1 | 4 | manuales identidad | InDesign NONE | **SECONDARY_SIGNAL** |
| Nidia `207` | VISUAL_DESIGN | VISUAL_GRAPHIC | 1 | 1 | 3 | diseño gráfico | anti-tool OK | **PRIMARY_MATCH** |
| Nidia `207` | AUDIOVISUAL_PRODUCTION | — | 0 | 0 | 3 | — | Premiere/AE **NONE** | **OUTSIDE** |
| Daniel `212` | VISUAL_DESIGN | VISUAL_GRAPHIC | 1 | 0 | 4 | gráfico + retoque | tools no activan editorial | **PRIMARY_MATCH** |
| Daniel `212` | AUDIOVISUAL_PRODUCTION | — | 0 | 0 | 3 | — | — | **OUTSIDE** |

**Artefactos:** `tmp/mc181b/*.json`

### Lectura cruzada

- **Santiago:** Audiovisual claramente predominante; Visual y Software contenidos (0 ACTIVE).
- **Juan Pablo:** AV_MOTION ACTIVE con frontera razonable; Visual solo EMERGENT identidad (no inflación AV).
- **Nidia / Daniel:** Visual predominante; AV no activa por tools compartidas ni contenido digital genérico.

---

## 6. Auditoría AV_POST

### Evidencias en corpus (solo 2 perfiles)

| Perfil | skill_key | Tipo | Evidencia | Mapping | Especialidad | Contribución |
|--------|-----------|------|-----------|---------|--------------|--------------|
| Santiago | `ajuste_de_color` | PROFESSIONAL_KNOWLEDGE | MODERATE 40 / conf 0.78 | PRIMARY w=1 | AV_POST | **Profesional dominante** |
| Santiago | `davinci_resolve` | TOOL | MODERATE 50 / conf 0.86 | SECONDARY w=0.15 | AV_POST | Tool secundaria (7.5 strength) |
| Juan Pablo | — | — | Sin evidencia post | — | AV_POST | HIDDEN (mapped=0) |

### Respuestas metodológicas

| Pregunta | Respuesta |
|----------|-----------|
| ¿Práctica diferenciable? | **Sí** conceptualmente (color/finishing vs narrativa), pero corpus **muy delgado** |
| ¿ACTIVE en Santiago depende de una sola skill profesional? | **Sí** — solo `ajuste_de_color`; DaVinci refuerza sin activar sola |
| ¿Evidencia recurrente? | **No** — 1 perfil con skill profesional directa |
| ¿Mezcla con AV_EDITING? | **Parcial** — DaVinci también mapea EDITING (PRIMARY); POST usa mapping SECONDARY distinto |
| ¿Color/composición justifican separación? | **Sí** a nivel definición; **insuficiente** a nivel corpus para SUPPORTED |
| ¿Demasiado amplia? | No en v1; solo 1 skill profesional mapeada |
| ¿Santiago ACTIVE vs madurez EMERGENT? | **Correcto separar:** resultado individual ACTIVE ≠ madurez SUPPORTED |

**Decisión MC1.8.1B:** no crear skills/aliases/mappings nuevos; no modificar umbrales; **mantener AV_POST = EMERGENT** metodológicamente.

---

## 7. Madurez recomendada (Specialty Blueprint)

| Especialidad | Recomendación | Justificación |
|--------------|---------------|---------------|
| **AV_EDITING** | **SUPPORTED** | 2 perfiles; Santiago ACTIVE; Juan Pablo EMERGENT (anti-tool correcto); frontera Visual OK |
| **AV_MOTION** | **SUPPORTED** | Animación MODERATE en ambos; ACTIVE defendible; AE no activa sola |
| **AV_POST** | **EMERGENT** | 1 skill profesional en corpus; ACTIVE solo en semilla; necesita +perfiles |
| AV_PRODUCTION / PHOTOGRAPHY / SOUND / STREAMING | **RESERVED** | Sin cambio |

Ninguna especialidad → STABLE ni CONSOLIDATED.

---

## 8. Pruebas y regresiones

| Suite | Resultado |
|-------|-----------|
| `npm test -- mc-catalog` | **92/92 PASS** (+11 en `mc-catalog.multidomain.spec.ts`) |
| Registry multidominio | PASS |
| Hashes inmutables | PASS |
| Fronteras Nidia/tools/multimedia | PASS (unidad) |
| AV_POST anti-tool + color profesional | PASS (unidad) |
| Fingerprints PA2 (5 reglas) | PASS |

---

## 9. Persistencia

| Acción | Resultado |
|--------|-----------|
| Nueva evaluación | **No** |
| Eval #7 Santiago | **Intacta** (`evaluation_context_hash` reproducible) |
| Evaluaciones Nidia/Garzón/Daniel | **Sin cambio** |

---

## 10. Riesgos pendientes

1. **Operacional:** cada bump de catálogo exige re-seed de mappings por dominio (documentar en runbook).
2. **AV_POST:** corpus profesional delgado; no promover a SUPPORTED hasta ≥2 perfiles con evidencia directa.
3. **Validating:** falta perfil OUTSIDE Visual puro en ronda AV (MC1.8.1C).

---

## 11. Veredicto

| Campo | Valor |
|-------|-------|
| Catálogo activo | `mc1.8-2026-07-28` — **operativo** |
| Software disponible | **Sí** |
| Visual Design disponible | **Sí** |
| Audiovisual disponible | **Sí** |
| Hashes históricos | **Intactos** |
| Santiago cruzado | AV PRIMARY_MATCH; Visual/Software OUTSIDE |
| Juan Pablo cruzado | AV PRIMARY_MATCH/BORDERLINE; Visual SECONDARY_SIGNAL |
| Nidia cruzado | Visual PRIMARY_MATCH; AV OUTSIDE |
| Daniel cruzado | Visual PRIMARY_MATCH; AV OUTSIDE |
| AV_EDITING madurez | **SUPPORTED** |
| AV_MOTION madurez | **SUPPORTED** |
| AV_POST madurez | **EMERGENT** |
| Regresiones | **No** |
| **Veredicto** | **GO** |

El dominio permanece **PROTOTYPE** operativo, con núcleo evaluable y fronteras multidominio validadas. Zonas RESERVED y AV_POST EMERGENT quedan explícitas para evolución gradual.

---

**Estabilización:** MC1.8.1B · 2026-07-28
