# MC1.8.A — Evaluación retrospectiva de madurez de especialidades

**Fecha:** 2026-07-28  
**Normativa aplicada:** [`mc1-specialty-blueprint.md`](mc1-specialty-blueprint.md)  
**Alcance:** recomendación metodológica **documental** — **sin** cambio de código, catálogo, pack, PA2 ni estados persistidos.

**Dominios evaluados:**

- **Diseño Visual** (`VISUAL_DESIGN`) — corpus MC1.6.0 → MC1.6.1C.3 + Domain Guide MC1.6.1D
- **Producción Audiovisual** (`AUDIOVISUAL_PRODUCTION`) — corpus MC1.8.0 Discovery → MC1.8.1B
- **Gestión Humana** (`HUMAN_RESOURCES`) — Discovery MC1.9.0 → Candidate MC1.9.1 → Validation R1 MC1.9.2 (**recomendación documental; sin catálogo/pack/PA2**)

---

## 1. Convenciones de lectura

| Columna | Significado |
|---------|-------------|
| **Estado recomendado** | Madurez de especialidad (Specialty Blueprint §3), no resultado PA2 |
| **Legacy MC1.7.0** | Sub-estado usado en Domain Blueprint §4.3 antes de MC1.8.A |
| **Siguiente gate** | Hito mínimo para promover madurez |
| **Riesgo principal** | Mayor amenaza si no se gestiona |

**Separación PA2:** una fila puede indicar madurez **SUPPORTED** y simultáneamente que muchos perfiles obtienen **EMERGENT** o **HIDDEN** en PA2.

---

## 2. Diseño Visual (`VISUAL_DESIGN`)

**Estado dominio (referencia):** EN CONSTRUCCIÓN / STABLE funcional — no CONSOLIDATED.

### 2.1 Tabla de especialidades

| Código | Estado recomendado | Legacy MC1.7.0 | Justificación breve | Vacíos principales | Siguiente gate | Riesgo principal |
|--------|-------------------|----------------|---------------------|-------------------|----------------|------------------|
| **VISUAL_GRAPHIC** | **CONSOLIDATED** | OPERATIONAL → CONSOLIDATED | ACTIVE reproducibles (Nidia, Daniel, + equipo 1.2.0); vocabulario + aliases ilustración/retoque | Residuales menores | Mantenimiento | Regresión por pack major |
| **VISUAL_IDENTITY** | **STABLE** | OPERATIONAL | **ACTIVE seco Diego (#15)** tras aliases 1.2.0; Molano IDENTITY ACTIVE; EMERGENT en Danna/Laura/Ginna | 2º ACTIVE independiente | Checklist §17 | FP hacia GRAPHIC si pesos SECONDARY abusivos |
| **VISUAL_EDITORIAL** | **STABLE** | OPERATIONAL | EMERGENT estable (Nidia, Danna, Laura, Darío); compuestos 1.2.0 | 1 ACTIVE editorial puro | ACTIVE editorial seco | Confusión editorial vs gráfico publicitario |
| **VISUAL_UI** | **RESERVED** | RESERVED | Sin mappings; UX clasificado TRANSVERSAL en 1.2.0 | Criterios evidencia mínima | Decisión mappings o spin-off | Absorber UX Research o front-end |
| **VISUAL_DIGITAL_ASSETS** | **DEPRECATED** | CANDIDATE_REMOVE | Bucket tool-led; anti-tool; aún en catálogo mc1.8 | Redistribuir tools | RETIRED en V3 | Ruido en radar |

### 2.2 Notas por especialidad

#### VISUAL_GRAPHIC

- **Evidencia:** `diseno_grafico` MODERATE+ en múltiples perfiles; PA2 ACTIVE con cardinalidad defendible.
- **PA2 típico:** ACTIVE (MATCH), EMERGENT (1 skill fuerte), HIDDEN (solo tools).
- **Evolución vertical prioritaria:** aliases P1 (ilustración, retoque).

#### VISUAL_IDENTITY

- **Evidencia:** `diseno_de_identidad_visual` MODERATE (Garzón); aliases branding 1.2.0.
- **PA2 típico:** ACTIVE (Diego #15); EMERGENT (cardinalidad); HIDDEN si falta vocabulario.
- **MC1.11.0:** primer ACTIVE seco de identidad bajo mc1.8 + pack 1.2.0.

#### VISUAL_EDITORIAL

- **Evidencia:** `diseno_editorial` MODERATE; compuesto `diseno_editorial_y_diagramacion` mapeado en 1.2.0.
- **PA2 típico:** EMERGENT editorial (Laura, Danna, Nidia).
- **Frontera:** maquetación publicitaria → GRAPHIC (no EDITORIAL).

#### VISUAL_UI

- **Evidencia:** prototipado UI/UX WEAK; `diseno_ux/ui` TRANSVERSAL sin mapping (1.2.0).
- **PA2:** no participa.
- **Horizontal potencial:** spin-off dominio UX/UI — **sin decisión**.

#### VISUAL_DIGITAL_ASSETS

- **Evidencia:** solo tools (Canva, Genially, InDesign listing).
- **PA2:** anti-tool bloquea ACTIVE.
- **Acción recomendada:** DEPRECATED → RETIRED; redistribuir tools a GRAPHIC/EDITORIAL.
- **MC1.11.0:** sin reactivación.

### 2.3 Resumen Visual

| Métrica | Valor |
|---------|-------|
| Especialidades CONSOLIDATED | 1 (GRAPHIC) |
| STABLE | 2 (IDENTITY, EDITORIAL) |
| RESERVED | 1 (UI) |
| DEPRECATED | 1 (DIGITAL_ASSETS) |
| Bloqueador dominio CONSOLIDATED | IDENTITY/EDITORIAL sin ACTIVE; retiro DIGITAL; política UI |

---

## 3. Producción Audiovisual (`AUDIOVISUAL_PRODUCTION`)

**Estado dominio (referencia):** **PROTOTYPE** (MC1.8.1 / MC1.8.1B).

### 3.1 Tabla de especialidades

| Código | Estado recomendado (MC1.8.1B) | MC1.8.0 / Prototype | Justificación breve | Vacíos principales | Siguiente gate | Riesgo principal |
|--------|-------------------------------|---------------------|---------------------|-------------------|----------------|------------------|
| **AV_EDITING** | **SUPPORTED** | EMERGENT→SUPPORTED (MC1.8.1) | Santiago ACTIVE; Juan Pablo EMERGENT anti-tool; frontera Visual OK en dry-runs cruzados | `edicion_de_video` WEAK en JP | Validating + más perfiles | Tool-led sin profesional |
| **AV_MOTION** | **SUPPORTED** | EMERGENT→SUPPORTED (MC1.8.1) | Animación MODERATE ambos; ACTIVE JP/Santiago; AE no activa sola | Sin 3D profesional fuerte | Alias corpus ampliado | Fusionar con EDITING si PA2 no distingue |
| **AV_POST** | **EMERGENT** | SUPPORTED (Discovery) → **EMERGENT** (MC1.8.1B) | Solo `ajuste_de_color` en 1 perfil; ACTIVE Santiago ≠ madurez SUPPORTED | 1 skill profesional en corpus | +1 perfil color/finishing | Solapamiento EDITING↔POST (DaVinci dual) |
| **AV_PRODUCTION** | **EMERGENT** | EMERGENT (Discovery) | Responsabilidades producción integral; iluminación MODERATE (1 perfil) | No generalizar dirección; 1 mención | +1 perfil o repetir señal | Especialidad catch-all prematura |
| **AV_PHOTOGRAPHY** | **RESERVED** | EMERGENT → RESERVED (normativa) | Fotografía MODERATE solo Juan Pablo; frontera Visual | 1 perfil; retoque ambiguo | +1 perfil fotógrafo/video | Contaminar Visual o AV_EDITING |
| **AV_SOUND** | **RESERVED** | RESERVED (Discovery) | Masterización WEAK; DAWs listing; sin entregable AV claro | Sin perfil audio dedicado | Perfil sonido/post | Crear especialidad solo por tools |
| **AV_STREAMING** | **RESERVED** | RESERVED (Discovery) | OBS/Streaming WEAK; zona gris Comunicación | 1 perfil; listing | Perfil live/streaming | Absorber dominio Comunicación |

### 3.2 Ajuste normativo Discovery → Specialty Blueprint

En MC1.8.0 se usó **SUPPORTED** para el núcleo AV sin pack publicado. Bajo Specialty Blueprint v1.0:

- **SUPPORTED** requiere pack operativo + fronteras borrador.
- Hasta MC1.8.1, el núcleo se registró como EMERGENT en catálogo con intención SUPPORTED.
- **MC1.8.1B confirma:** EDITING y MOTION → **SUPPORTED**; POST permanece **EMERGENT** (corpus de 1 skill profesional).

### 3.3 Notas por especialidad

#### AV_EDITING / AV_MOTION / AV_POST (núcleo)

- **Corpus:** Santiago (semilla) + Juan Pablo (validación).
- **PA2 futuro esperado:** Santiago ACTIVE en ≥1 núcleo; Juan Pablo MATCH con posible EMERGENT en secundarias por mezcla Visual/DI.
- **Fronteras críticas:** definir regla EDITING vs POST vs MOTION antes de STABLE.

#### AV_PRODUCTION

- No promover a SUPPORTED hasta **≥2 perfiles** con responsabilidad integral o gate explícito documentado.

#### AV_PHOTOGRAPHY / SOUND / STREAMING

- Mantener **RESERVED**; documentar en pack v1 como códigos sin mappings PRIMARY.

### 3.4 Resumen AV

| Métrica | Valor |
|---------|-------|
| Listas para Prototype (núcleo) | 3 (EDITING, MOTION, POST) |
| EMERGENT (madurez) hasta pack v1 | 3 |
| RESERVED | 3 (PHOTOGRAPHY, SOUND, STREAMING) |
| EMERGENT estructural | 1 (PRODUCTION) |
| Bloqueador VALIDATING | Corpus solo 2 perfiles; sin OUTSIDE Visual puro |

---

## 4. Gestión Humana (`HUMAN_RESOURCES`) — MC1.9.2

**Estado dominio (referencia):** **DISCOVERED** (no PROTOTYPE_READY).  
**Fuente:** [`mc1.9.2-human-resources-validation-round1.md`](mc1.9.2-human-resources-validation-round1.md) · guía [`mc1-human-resources-domain-guide.md`](mc1-human-resources-domain-guide.md).  
**Alcance:** recomendación documental — **sin** catálogo, pack, PA2 ni estados persistidos.

### 4.1 Tabla de especialidades

| Código / concepto | Estado recomendado | Decisión R1 | Justificación breve | Vacíos | Siguiente gate | Riesgo principal |
|-------------------|-------------------|-------------|---------------------|--------|----------------|------------------|
| **HR_TALENT** | **SUPPORTED** | REFINE | Leidy+Alberto con TH/selección/cultura MODERATE work; procesos como skills | Laura listing no cuenta; Alberto híbrido prácticas | +1 MATCH puro ciclo talento | Ampliar por listados |
| **HR_ORG_DEVELOPMENT** | **EMERGENT** | KEEP | DO Leidy; cultura Alberto; cambio Yuri | Poca diversidad; solapa L&D/ops | +1 perfil DO claro | Absorber capacitación/ops |
| **HR_SST** | **RESERVED** | MOVE_TO_BOUNDARY | Leidy STRONG ≠ auto-HR; Daniel OUTSIDE HSEQ | Frontera GH↔HSEQ | Decisión dominio HSEQ | Meter SST en pack HR |
| **HR_QUALITY_SYSTEMS** | **DEPRECATED** (en HR) | REMOVE | Daniel demuestra Calidad distinta; en Leidy fue complemento | — | No mapear en HR | ISO→HR |
| **HR_PEOPLE_ANALYTICS** | **HYPOTHESIS** | INSUFFICIENT_EVIDENCE | Sin KPIs de personas; tools BI no cuentan | 0 perfiles PA reales | Perfil con rotación/ausentismo/headcount | Dashboards→PA |
| **Admin personal / nómina** *(sin código)* | **EMERGENT** | KEEP conceptual | María José COMPLEMENTARY (nómina/seguridad social WEAK) | Evidencia débil; 1 perfil | +1 nómina MOD+ | SIIGO/admin genérico |

### 4.2 Notas

- Máximo permitido en esta ronda: **SUPPORTED**. No STABLE/CONSOLIDATED.
- Split de TALENT (acquisition/L&D/performance/…) **no** crear códigos aún.
- Corpus R1: 6 cadenas nuevas + Leidy + Camilo OUTSIDE.

### 4.3 Resumen HR

| Métrica | Valor |
|---------|-------|
| SUPPORTED (rec.) | 1 (HR_TALENT) |
| EMERGENT | 2 (OD + nómina conceptual) |
| RESERVED / boundary | 1 (SST) |
| DEPRECATED en HR | 1 (Quality Systems) |
| HYPOTHESIS | 1 (People Analytics) |
| Bloqueador PROTOTYPE_READY | Segundo MATCH puro; definición estable sin sobrepeso SST |

---

## 5. Matriz cruzada — madurez vs PA2 (ejemplos reales)

| Especialidad (madurez) | Perfil | Resultado PA2 observado/esperado | ¿Coherente? |
|------------------------|--------|----------------------------------|-------------|
| VISUAL_GRAPHIC CONSOLIDATED | Nidia | ACTIVE | Sí |
| VISUAL_GRAPHIC CONSOLIDATED | Daniel | ACTIVE | Sí |
| VISUAL_GRAPHIC CONSOLIDATED | Poveda | EMERGENT | Sí (1 pro) |
| VISUAL_IDENTITY STABLE | Garzón | EMERGENT identidad | Sí |
| VISUAL_DIGITAL_ASSETS DEPRECATED | Cualquiera | HIDDEN / tool EMERGENT | Sí (retirar) |
| AV_EDITING SUPPORTED | Santiago | ACTIVE | Sí (MC1.8.1B) |
| AV_EDITING SUPPORTED | Juan Pablo | ACTIVE o EMERGENT | Sí |
| AV_PHOTOGRAPHY RESERVED | Juan Pablo | N/A sin mapping | Sí |
| HR_TALENT SUPPORTED (rec.) | Leidy / Alberto | N/A — sin PA2 | Esperado ACTIVE/EMERGENT futuro |
| HR_QUALITY DEPRECATED | Daniel | N/A — fuera de HR | Sí (OUTSIDE) |

---

## 6. Recomendaciones transversales

### 6.1 Diseño Visual

1. **Retirar** `VISUAL_DIGITAL_ASSETS` (major catálogo V3) antes de declarar dominio CONSOLIDATED.
2. Promover **IDENTITY** y **EDITORIAL** a **CONSOLIDATED** solo tras 1 ACTIVE reproducible cada una.
3. Resolver **UI** con decisión explícita RESERVED vs spin-off — no estado intermedio silencioso.

### 6.2 Producción Audiovisual

1. Núcleo **EDITING + MOTION** en **SUPPORTED**; **POST** permanece **EMERGENT**.
2. Registrar **PHOTOGRAPHY, SOUND, STREAMING** como **RESERVED** sin mappings.
3. No crear **AV_PRODUCTION** mappings hasta segundo perfil de producción integral.

### 6.3 Gestión Humana

1. No iniciar pack HR hasta **+1 MATCH puro** de ciclo de talento (Laura no cuenta).
2. Mapear solo **HR_TALENT** (+ opcional OD EMERGENT); excluir Quality; SST en frontera.
3. Anti-patterns: listing reclutamiento; tools BI; ISO/OHSAS sin TH; pedagogía/ops académica.

### 6.4 Alineación terminológica

| Término Discovery MC1.8.0 | Specialty Blueprint 1.0 |
|---------------------------|-------------------------|
| SUPPORTED (sin pack) | EMERGENT → SUPPORTED tras Prototype |
| EMERGENT (hipótesis) | EMERGENT (madurez) o RESERVED |
| RESERVED | RESERVED (sin cambio) |

---

## 7. Verificación de restricciones

| Restricción | Cumplido |
|-------------|----------|
| Sin migración de estados persistidos de Visual/AV | **Sí** |
| HR: sin catálogo/pack/PA2 en MC1.9.2 | **Sí** |
| Solo recomendación metodológica para HR | **Sí** |
| Máximo SUPPORTED en HR (no STABLE/CONSOLIDATED) | **Sí** |

---

**Evaluación:** MC1.8.A + extensión MC1.9.2 HR · 2026-07-28 · no vinculante para implementación hasta aprobación explícita por fase.
