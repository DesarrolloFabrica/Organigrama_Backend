# MC1.6.1B.1 — Retrospectiva técnica del motor multidominio

**Modo:** auditoría y diseño · **Sin escrituras Cloud** · **Sin cambios de producto**  
**Fecha:** 2026-07-27  
**Artefacto RO:** `tmp/mc161b1-ro-audit.json`  
**Dry-runs:** `tmp/mc161b1-*-dry{1,2}.json`

---

## 1. Resumen ejecutivo

Tras Software (Camilo) y Diseño Visual (Nidia), el sistema es **un motor PA2 genérico con configuración por dominio**, no dos motores independientes. Aun así, **no está consolidado**: quedan packs registrados en código, orden de radar FE hardcodeado por dominio, enum `OUTSIDE_SOFTWARE_DOMAIN`, defaults CLI a SOFTWARE, y —crítico— las versiones PA2 son **etiquetas + config hash**, no algoritmos congelados en artefactos inmutables.

**Veredicto:** **GO CON CORRECCIONES MENORES** → **Ruta C**  
Corregir bloqueadores P0/P1 cortos y luego MC1.6.1C (hermanos). **No** exige endurecimiento largo (Ruta B) ni GO directo sin ajustes (Ruta A).

Pregunta central:

> ¿Motor genérico configurado por dominio, o implementaciones disfrazadas?

**Respuesta:** genérico en el núcleo (`runMcPa2Engine`, persistencia, API summary); **configuración y presentación aún parcialmente caso-por-caso** (registry de packs, radar FE, nomenclatura Software en clasificaciones).

---

## 2. Estado actual del motor

### Casos verificados en Cloud (2026-07-27)

| Caso | person_id | Dominio | Eval | is_active | Default | Rules |
|------|-----------|---------|------|-----------|---------|-------|
| Camilo vigente | 1 | SOFTWARE | **#4** | true | SOFTWARE_BACKEND | pa2-software-1.1.0 |
| Camilo histórico | 1 | SOFTWARE | **#2** | false | SOFTWARE_BACKEND | pa2-software-1.1.0 |
| Camilo histórico viejo | 1 | SOFTWARE | #1 | false | SOFTWARE_FRONTEND | pa2-software-1.0.0 |
| Nidia | 1163 | VISUAL_DESIGN | **#3** | true | VISUAL_GRAPHIC | pa2-visual-design-1.0.0 |
| Johan | 2 | — | — | — | — | NOT_EVALUATED |

Catálogos:

| id | version | status | is_active |
|----|---------|--------|-----------|
| 1 | mc1.2-2026-07-27 | RETIRED | false |
| 2 | mc1.6-2026-07-27 | ACTIVE | true |

Integridad RO: 0 dobles activas, 0 eval activa en catálogo inactivo, 0 hashes nulos, 0 resultados huérfanos. Única “anomalía” esperada: `VISUAL_UI` sin mappings.

### Arquitectura actual (simplificada)

```text
cv_extraction → enrichment → evidence
        ↓
   McPa2Service (genérico)
        ↓
   runMcPa2Engine(config) ← resolveMcPa2EngineConfig(rulesVersion)
        ↓
   mappings BD (catalog_version + domain)
        ↑
   seed packs en código (SOFTWARE | VISUAL_DESIGN registry)
```

---

## 3. Versionamiento histórico

### Respuestas precisas (Camilo #2 / #4)

| Pregunta | Respuesta |
|----------|-----------|
| ¿#2 existe físicamente? | **Sí** |
| ¿Conserva resultados? | **Sí** — 7 filas en `mc_profile_specialty_result` |
| ¿Conserva catálogo? | **Sí** — FK `catalog_version_id=1` (`mc1.2…` RETIRED, no eliminado) |
| ¿Conserva versión PA2? | **Sí** — `pa2-software-1.1.0` |
| ¿Conserva mapping_hash? | **Sí** — `c58af992…` |
| ¿Puede reconstruirse? | **Parcial** — dry-run con catálogo activo reproduce métricas; reconstrucción exacta sobre catálogo #1 requiere apuntar a versión retirada (soportado por `catalogVersion` en evaluate) |
| ¿Puede consultarse? | **Sí en BD**; API principal solo vigente (#4). No hay endpoint de historial |
| ¿`is_active=false`? | Deja de ser **vigente** para producto; el registro y resultados permanecen |
| ¿Catálogo anterior? | **Desactivado/retirado**, no eliminado |
| ¿FK a desactivado? | Sí, normales (catálogo RETIRED, dominio/especialidades del snapshot #1) |
| ¿Depende de mutables? | **Riesgo:** skills/mappings del pack en código pueden mutar; la eval guarda hash, no snapshot del pack. Evidencia/extracción históricas siguen referenciadas |
| ¿Reevaluar? | Crea **nuevo** registro; desactiva previas por `person_id + domain_code` (fix MC1.6.1B) |
| ¿Vigente vs histórica? | Solo `is_active` (+ catálogo activo para STALE). No hay enum `HISTORICAL` |
| ¿Varias históricas? | **Sí** (#1 y #2) |
| ¿API solo vigente? | **Sí**; trazabilidad histórica no expuesta en producto |

### Tabla de entidades

| Entidad | Registro histórico | Existe | Activo | Mutable | Se puede reconstruir | Riesgo |
|---------|--------------------|--------|--------|---------|----------------------|--------|
| Evaluación | #2 Camilo | Sí | No | No (fila) | Sí (lectura) | Medio: sin API historial |
| Resultado especialidad | 7 filas #2 | Sí | n/a | No | Sí | Bajo |
| Reglas PA2 | label + config_hash | En fila | n/a | **Código mutable** | Solo si código+config coinciden | **Alto** |
| Catálogo | mc1.2 id=1 | Sí | No (RETIRED) | No (versionado) | Sí | Bajo |
| Dominio | SOFTWARE id=1 | Sí | is_active=true dentro de catálogo retirado | No | Sí | Bajo |
| Especialidad | 7 en catálogo 1 | Sí | sí en su versión | No | Sí | Bajo |
| Skill | cv_skill canónico | Sí | sí | Posible rename | Parcial | Medio |
| Mapping BD | 48 en catálogo 1 | Sí | sí | Seed idempotente | Sí | Medio si se reescribe pack |
| Mapping pack código | SOFTWARE pack | Sí | n/a | **Sí (git)** | Hash detecta drift | **Alto** |
| Hash mapping/config | en eval | Sí | n/a | No | Verificación | Medio: no cubre algoritmo |
| Extracción/enrich/evidence | 206/2/3 | Sí | vigentes | No | Sí | Bajo si is_active cambia |

### Política propuesta (no implementada)

| Estado | Significado |
|--------|-------------|
| **Activo** | Registro usable en runtime (catálogo, mapping, persona) |
| **Vigente** | Evaluación `is_active=true` servida por API producto |
| **Histórico** | Evaluación `is_active=false` conservada e inmutable |
| **Retirado** | Catálogo/versión no seedable como current (`RETIRED`) |
| **Eliminado** | Prohibido para evaluaciones y catálogos referenciados |

Reglas:

1. Históricas nunca se actualizan in-place.  
2. Nueva evaluación = nuevo id; anterior deja de ser vigente.  
3. Identificar de forma inmutable: `engine_rules_version` + `config_hash` + `mapping_hash` + **`mapping_pack_version`** + **`source_hash`** + `catalog_version_id`.  
4. API producto = vigente; API auditoría = historial.  

**Soporte actual:** parcial (1–2 y hashes sí; pack version, source_hash y API historial **faltan**).

---

## 4. Números mágicos y configuración

| Valor | Archivo | Función | Dominio | Parametrizado | Origen | Riesgo | Recomendación | Clase |
|-------|---------|---------|---------|---------------|--------|--------|---------------|-------|
| 0.55 coverage ACTIVE | `mc-pa2.config.ts` | v100/v110 | SOFTWARE | Sí (regla) | MC1.3 | Bajo | Mantener por regla | POR REGLA PA2 |
| 0.45 coverage ACTIVE | idem | visual 1.0.0 | VISUAL | Sí | MC1.6.1B | Bajo | Mantener | POR REGLA PA2 |
| **minimumActiveStrength=20** | idem | visual 1.0.0 | VISUAL | Sí (regla) | calibración editorial | Medio | Documentar criterio; no tocar en hermanos sin nueva regla | POR REGLA PA2 |
| mapped≥3 / evidenced≥2 | software configs | ACTIVE | SOFTWARE | Sí | MC1.3 | Bajo | — | POR REGLA PA2 |
| mapped≥2 / evidenced≥2 | visual | ACTIVE | VISUAL | Sí | MC1.6.1B | Bajo | — | POR REGLA PA2 |
| dominance 0.85 / 0.9 | configs | EMERGENT | por regla | Sí | MC1.x | Bajo | — | POR REGLA PA2 |
| override strength 80/70 | configs | ACTIVE_WITH_CAUTION | por regla | Sí | MC1.x | Medio | — | POR REGLA PA2 |
| ranking weights 40/0.25/15… | configs | score auxiliar | por regla | Sí | MC1.3 | Bajo | En LEXICOGRAPHIC son métrica | POR REGLA PA2 |
| pesos tool 0.10–0.55 | mapping packs | contribution | por dominio | Sí (pack) | seeds | Medio | Pack versionado | POR DOMINIO |
| peso profesional 1.0 | packs | PRIMARY | por dominio | Sí | seeds | Bajo | — | POR DOMINIO |
| orden lexico fijo | `mc-pa2.engine.ts` `compareSpecialtyLexicographic` | default pick | global si LEXICOGRAPHIC | **No** (hardcode) | MC1.5.2A | **Alto** | Parametrizar orden o versionar algoritmo | GLOBAL / DEBE endurecerse |
| TOOLTIP_SKILL_LIMIT=5 | FE `radarInteraction.ts` | UI | presentación | Sí local | UX | Bajo | — | SOLO PRESENTACIÓN |
| radar axis orders | FE `radarLabels.ts` + BE definition | orden ejes | SOFTWARE/VISUAL | Parcial | MC1.6 | **Alto** p/ 3er dominio | Backend metadata | POR DOMINIO / DEBE parametrizarse |
| default domain SOFTWARE | CLIs / mapping.service | defaults | ops | Hardcode | legado | Medio | Default explícito obligatorio | DEBE ELIMINARSE eventual |
| expected 59 skills SOFTWARE | mapping.service | verify | SOFTWARE | Hardcode | MC1.1 | Medio | Por pack | POR DOMINIO |

### Sobre el umbral 20

| Pregunta | Respuesta |
|----------|-----------|
| ¿Pertenece a Diseño Visual? | **Sí** — solo en `getMcPa2EngineConfigVisualDesignV100` |
| ¿Dentro de regla versionada? | **Sí** — `pa2-visual-design-1.0.0` |
| ¿Hardcodeado en servicio? | **No** — motor lee `cfg.minimumActiveStrength` |
| ¿Software otro valor? | Sí (ausente = sin umbral de strength) |
| ¿Audiovisual sin tocar código? | **Hoy no** — hay que añadir función/config en `mc-pa2.config.ts` + case en `resolveMcPa2EngineConfig` |
| ¿Cambiar umbral altera históricas? | No las filas; sí el significado si se reusa el mismo `engine_rules_version` sin bump |
| ¿Hash contempla umbrales? | **Sí** — `config_hash` = SHA256(JSON.stringify(config)) |

---

## 5. Motor PA2

### Matriz

| Componente PA2 | Software | Diseño Visual | Genérico | Hardcodeado | Debe parametrizarse |
|----------------|----------|---------------|----------|-------------|---------------------|
| Lectura evidencia | ✓ | ✓ | **Sí** | | |
| Coverage/strength/confidence | ✓ | ✓ | **Sí** | | |
| Contribución mappings | ✓ | ✓ | **Sí** | | |
| Clasificación A/E/H | umbrales distintos | umbrales + minStrength | **Sí** (config) | | |
| Selección principal | LEXICO 1.1 | LEXICO 1.0 | **Sí** (strategy) | orden criterios fijo | orden criterios |
| Persistencia | ✓ | ✓ | **Sí** | | |
| Trazabilidad hashes | ✓ | ✓ | Parcial | falta pack version / source_hash | sí |
| Especialidades | 7 | 5 | datos | | |
| Mappings/pesos | pack SW | pack VD | datos | registry en código | registry data-driven |
| Orden ejes radar | FE+BE const | FE+BE const | no | **Sí FE** | backend |
| Exclusiones | clasificación OUTSIDE_* | idem enum Software | datos | nombre enum | renombrar |
| Tools | peso en pack | peso bajo | parcial | no tipología PA2 | política tools |

### Esfuerzo estimado para 3er dominio hoy

| Ítem | Estimación |
|------|------------|
| Archivos a modificar | ~8–12 (definition, pack, registry, pa2.config, FE radarLabels, specs, docs, CLI help) |
| Clases a tocar | 0 nuevas obligatorias; registry + config switch |
| Seeds | catalog bump o mismo catálogo + mappings domain |
| Configuraciones | nueva `pa2-audiovisual-*.*.*` |
| Tests | pack hash, engine thresholds, API shape, FE radar 4–6 ejes |

**Ideal:** solo catálogo + mappings + config + tests.  
**Hoy:** también **código de registro** (switch/registry) y **FE labels**.

---

## 6. Estrategia lexicográfica

| Aspecto | pa2-software-1.1.0 | pa2-visual-design-1.0.0 |
|---------|--------------------|-------------------------|
| Strategy | LEXICOGRAPHIC | LEXICOGRAPHIC |
| Orden criterios | evid↓ cov↓ str↓ conf↓ primaryStrong↓ mapped↓ code↑ | **igual** (misma función) |
| Umbrales ACTIVE | 0.55 / 3 / 2 / dom 0.85 | 0.45 / 2 / 2 / dom 0.9 + **str≥20** |
| Desempate tools | indirecto (mapped/strength bajos) | más estricto por minStrength |

Respuestas críticas:

| Pregunta | Respuesta |
|----------|-----------|
| ¿Lexico una vez o duplicada? | **Una** implementación: `compareSpecialtyLexicographic` |
| ¿Criterios en config? | **No** — solo `rankingStrategy: 'LEXICOGRAPHIC'` |
| ¿Orden cambia por regla? | **No** sin cambiar código |
| ¿Label reproduce comportamiento? | Label + config_hash reproducen **umbrales**; el **algoritmo** vive en el binario actual |
| ¿Código ejecuta reglas históricas distintas? | `resolveMcPa2EngineConfig` sí distingue configs; **no** hay snapshot del bytecode del comparador |
| ¿Modificar algoritmo cambia significado retrospectivo? | **Sí, riesgo P0 conceptual** — eval antigua dice `1.1.0` pero un change en `compareSpecialtyLexicographic` alteraría reconstrucciones futuras sin bump de versión |

```text
Regla histórica = label + config_hash + (implícito) commit del motor
               ≠ artefacto algorítmico versionado
```

---

## 7. Mappings y hashes

| Pregunta | Respuesta |
|----------|-----------|
| ¿Pack por dominio? | **Sí** — registry SOFTWARE / VISUAL_DESIGN |
| ¿Versión de pack? | **Sí en constante** (`mc1.6-visual-nidia-2026-07-27`); **no persistida** en evaluación |
| ¿Hash incluye mappings+pesos+tipos+specialty? | **Sí** |
| ¿Incluye umbrales PA2? | **No** (van en `config_hash`) |
| ¿Exclusiones/clasificaciones? | Clasificación sí (sin rationale); no “reglas de exclusión” aparte |
| ¿Config herramientas? | Solo como filas mapping con peso |
| ¿Orden afecta hash? | **No** — sort determinista antes de stringify |
| ¿Determinista? | **Sí** — verificado 2× local y en dry-runs |
| ¿Nombre visible altera hash? | **No** — hash usa skillKey/type, no skillName |
| ¿Cambio de peso? | Nuevo hash |
| ¿Eval apunta al pack exacto? | Solo por **hash**, no por `mapping_rules_version` |

### Propuesta `evaluation_context_hash` (no implementar)

Payload canónico sugerido:

```text
{
  personId, domainCode,
  catalogVersion, catalogConfigHash,
  mappingPackVersion, mappingHash,
  engineRulesVersion, configHash,
  extractionId, enrichmentId, evidenceId,
  sourceHash (pdf_sha256),
  engineAlgorithmId  // p.ej. pa2-lexico-v1
}
```

---

## 8. Skills frente a herramientas

Tipo formal: enum extracción/`cv_skill.skill_type`  
(`TECHNOLOGY | TOOL | METHODOLOGY | PROFESSIONAL_KNOWLEDGE | LANGUAGE | SOFT_SKILL | OTHER`).

| Pregunta | Respuesta |
|----------|-----------|
| ¿Tipo en catálogo MC? | No tipología MC aparte; reutiliza skill canónica |
| ¿Tool mapeable? | **Sí** |
| ¿Peso distinto por dominio? | **Sí** (packs distintos) |
| ¿Tool sin skill profesional? | **Sí** posible → mitigado en Visual con minStrength y pesos bajos |
| ¿5 tools débiles > 1 profesional? | Mitigado en Visual; Software depende más de cardinalidad/umbrales |
| ¿API separa tools? | **No** — skills homogéneas con `type` |
| ¿FE separa tools? | **No** — muestra `Tipo: TOOL` en detalle |
| ¿Aliases Adobe? | Skills distintas (photoshop, illustrator, premiere…) |

### Tabla ejemplos

| Elemento | Tipo actual | Tipo correcto | PA2 | Peso típico | Riesgo |
|----------|-------------|---------------|-----|-------------|--------|
| Canva | TOOL | TOOL | Visual sí | 0.10–0.25 | Listing NONE |
| Photoshop | TOOL | TOOL | Visual sí | 0.25 | Bajo |
| Illustrator | TOOL | TOOL | Visual sí | 0.25 | Bajo |
| Premiere | TOOL | TOOL AV | Visual **no** (OUTSIDE) | — | Fuga a AV |
| After Effects | TOOL | TOOL AV | Visual no | — | Idem |
| Figma | — (ausente Nidia) | TOOL UI | no | — | OK |
| Java | TECHNOLOGY | TECHNOLOGY | Software sí | pack SW | — |
| NestJS | TECHNOLOGY | TECHNOLOGY | Software sí | pack SW | — |
| PostgreSQL | TECHNOLOGY | TECHNOLOGY | Software sí | pack SW | — |
| Git | TOOL/TECH | TOOL | según pack | bajo/medio | — |
| Diseño gráfico | PROFESSIONAL_KNOWLEDGE | profesional | Visual PRIMARY | 1.0 | — |
| QA | PROFESSIONAL_KNOWLEDGE | transversal/visual | Visual 0.45 | ambiguo dominio | Medio |
| Prompting | METHODOLOGY | transversal | no (TRANSVERSAL) | — | OK |

### Recomendación modelo tools (sin implementar)

| Alternativa | Ventajas | Desventajas | Migración | PA2 | API | Escalabilidad |
|-------------|----------|-------------|-----------|-----|-----|---------------|
| **A TOOL tipado** (actual) | Mínimo cambio | Mezcla en listas | Baja | pesos | type field | Media |
| B `mc_tool` | Separación clara | Nueva entidad | Alta | puente | breaking | Alta |
| C taxonomía unificada | Largo plazo | Sobrediseño ahora | Alta | rewrite | breaking | Alta |

**Recomendar A endurecida:** política PA2 por `skillType` (p.ej. TOOL no cuenta a masa ACTIVE sin profesional asociado) + separación presentación API `skills` / `tools` sin nueva entidad.

---

## 9. Acoplamientos residuales a Software

| Hallazgo | Archivo | Tipo | Impacto | Regresión | Prioridad |
|----------|---------|------|---------|-----------|-----------|
| Registry packs solo SW/VD | `mapping-registry.ts` | código | 3er dominio requiere edit | Sí | **P0** |
| `OUTSIDE_SOFTWARE_DOMAIN` | types + packs | modelo | Semántica engañosa multidominio | Conceptual | **P1** |
| verify extracción `===59` SOFTWARE | `mapping.service.ts` | hardcode | Ops confuso | Bajo | P2 |
| default `--domain=SOFTWARE` | CLIs | ops | Error humano | Medio | P2 |
| FE `SOFTWARE_RADAR_AXIS_ORDER` | `radarLabels.ts` | presentación | OK si hay fallback | Bajo | P2 |
| Fixtures/tests Camilo SOFTWARE | specs/fixtures | test | Deuda | No | P3 |
| Comentario header “dominio SOFTWARE” | `mc-pa2.config.ts` | docs | Confusión | No | P3 |

No se halló `if (domain === 'SOFTWARE') { … } else if (domain === 'VISUAL_DESIGN')` en el motor de evaluación runtime (sí en registry/resolve packs y en verify mappings).

---

## 10. Acoplamientos residuales a Diseño Visual

| Hallazgo | Archivo | Tipo | Prioridad |
|----------|---------|------|-----------|
| Pack + specialty codes VISUAL_* | definition + mapping-visual | **configuración datos** | OK |
| `minimumActiveStrength: 20` | pa2.config visual | config por regla | OK |
| `VISUAL_DESIGN_RADAR_AXIS_ORDER` + labels | FE radarLabels | hardcode presentación | **P1** p/ 3er dominio |
| `primarySpecialtyCode.includes('VISUAL_UI')` | trajectoryNarrative | acoplamiento débil | P2 |
| Enum OUTSIDE_SOFTWARE usado en pack Visual | mapping-visual | nomenclatura | P1 |

**Conclusión:** Diseño Visual es **mayormente configuración** (pack + regla + catálogo), no un segundo motor; la presentación FE y el registry aún son **caso especial registrado en código**.

---

## 11. API

| Tema | Estado |
|------|--------|
| Selección vigente | `resolvePrimaryEvaluation`: activa SUCCEEDED, prioriza catálogo activo, luego id DESC |
| Dominio | El de esa evaluación (un dominio/persona en V1) |
| Dos activas mismo dominio | Mitigado (0 en Cloud); bug previo domain_id corregido |
| Dos dominios evaluados | Devolvería **una** (la elegida por ORDER); sin selector — OK V1, límite futuro |
| Sin evaluación | `NOT_EVALUATED`, `domains=[]` (Johan) |
| Orden radar | **No** viene del backend summary; FE aplica constantes |
| Tools separadas | **No** |
| rule version / mapping hash | Sí en `evaluation.audit` (includeAudit) |
| source hash | **No** en contrato |
| Contrato genérico | **Sí** — shape Nidia≡Camilo; Johan shape reducido coherente |

---

## 12. Frontend

| Escenario | Soporte |
|-----------|---------|
| 5 / 7 ejes | Sí (órdenes registrados) |
| 4 ejes / dominio desconocido | Fallback `rank`+`code` si no hay orden | 
| Solo EMERGENT / sin ACTIVE | `pickInitialSpecialtyCode` + warning BE posible |
| NOT_EVALUATED | State message |
| Tools vacías / evidencia vacía | Detalle tolera |
| Textos dominio-específicos | No observados |
| Layout multidominio selector | No (correcto V1) |
| Narrativa UX/UI | Genérica; no aplica con rol actual Nidia |

**No es 100% genérico:** labels cortos y orden canónico viven en FE.

---

## 13. Diagnóstico del rol de Nidia

| Fuente | Rol reportado | ID | Vigente | Observación |
|--------|---------------|-----|---------|-------------|
| `core.person` | ANALISTA DE DISEÑO DE CONTENIDOS | role_id **25** | Sí | Fuente de verdad ficha |
| Org v4 (`periodo-agosto-2026`) | Mismo vía JOIN `person.role_id` | rel 11280 | Versión activa locked | No override de rol en relación |
| Org v3 histórica | Mismo rol core | rel 8438 | No | Cambió jefe (1162→1206 vacante) |
| Catálogo roles | Existe **DISEÑADOR UX/UI** | role_id **44** | Rol existe | **Nidia no lo tiene asignado** |
| Historial person/role | No hallado en organigrama | — | — | Solo `evaluaciones_nova.role_eval_audit` ajeno |

**Diagnóstico:** la expectativa “ya es Diseñadora UX/UI” **no está reflejada en datos**. El rol UX/UI existe (`44`) pero no está aplicado a `person_id=1163`. Corrección = **ticket organigrama independiente**, fuera de MC1.

---

## 14. Integridad de datos

| Check | Conteo / resultado |
|-------|--------------------|
| >1 activa por persona+dominio | **0** |
| >1 activa total por persona | **0** |
| Activa + catálogo inactivo | **0** |
| Eval sin resultados | **0** |
| Resultados huérfanos | **0** |
| Hashes nulos | **0** |
| Activa con evidence/extracción inactiva | **0** |
| Dominio sin especialidades | **0** |
| Especialidad sin mappings (catálogo activo) | **1** — `VISUAL_UI` (intencional) |
| Mappings activos | SW 48 + VD 11 (catálogo 2); SW 48 también en catálogo 1 |

---

## 15. Reproducibilidad

| Prueba | Resultado |
|--------|-----------|
| Camilo dry×2 | Idénticos |
| Nidia dry×2 | Idénticos |
| Camilo dry ≡ persistido #4 | **Sí** (métricas/hashes/orden) |
| Nidia dry ≡ persistido #3 | **Sí** |
| Hash packs local ×2 | Idénticos |
| Hora ejecución | No afecta (generatedAt solo meta artefacto) |
| Dry-run puro | **Disponible** (`--dry-run`, `persist:false`) — no es deuda P0 |

Tests ejecutados: BE 46 focused OK; FE radar/trajectory 8 OK.

---

## 16. Evolución Visual Design v1 → v2

| Paso conceptual | Modelo actual |
|-----------------|---------------|
| Crear v2 | Nueva `mc_catalog_version` **o** nuevo pack+regla sin mutar hashes viejos |
| Registros nuevos | catálogo/dominio/especialidades/mappings/eval nueva |
| v1 permanece | catálogo RETIRED + eval #3 `is_active=false` tras re-eval |
| Reevaluar Nidia | Nuevo id (p.ej. #5); #3 histórica |
| API comparar ambas | **No** hoy |
| Radar anterior | Solo si se consulta eval histórica (no expuesto) |
| Rename especialidad | Nuevo código preferible; name mutable no está en mapping_hash |
| Split especialidad | Nueva versión catálogo + remap |
| Eliminar mapping | Nuevo pack hash; re-eval |

**Brechas:** mutar pack Visual in-place al procesar hermanos contaminaría el significado del hash vs código; falta `mapping_pack_version` en eval; falta API historial.

---

## 17. Simulación tercer dominio `AUDIOVISUAL_PRODUCTION`

| Paso | Clasificación |
|------|---------------|
| Definir dominio/especialidades en definition | DATOS |
| Bump `MC_CATALOG_VERSION` + seed | DATOS |
| Crear mapping pack + versión | DATOS |
| Registrar en `mapping-registry` | **CÓDIGO ESPECÍFICO** (hoy) |
| Crear `pa2-audiovisual-x.y.z` + resolve case | **CÓDIGO ESPECÍFICO** (hoy) |
| Seed mappings | DATOS |
| Evaluate persona semilla | DATOS/ops |
| API | **CÓDIGO GENÉRICO** (ya) |
| FE radar order + short labels | **CÓDIGO ESPECÍFICO** (hoy) |
| Tests pack/engine/API/FE | Tests |
| Docs | Docs |
| `if domain === AUDIOVISUAL` en motor | **NO DEBERÍA SER NECESARIO** |

---

## 18. Métricas de madurez (0–5)

| Dimensión | Puntaje | Evidencia |
|-----------|---------|-----------|
| Generalización backend | **4** | Motor/API genéricos; registry aún manual |
| Configuración por dominio | **3** | Packs+reglas sí; orden lexico no |
| Versionamiento histórico | **3** | Filas conservadas; sin API historial ni pack version |
| Reproducibilidad | **4** | Dry-run ≡ persistido; riesgo algoritmo |
| Separación skills/tools | **2** | Tipo existe; PA2/API no tipifican política |
| API genérica | **4** | Shape multidominio OK |
| Frontend genérico | **3** | Fallback sí; labels/orden hardcode |
| Auditabilidad | **3** | Hashes sí; source_hash/pack version no |
| Facilidad nuevos dominios | **2** | Requiere tocar registry+config+FE |
| Seguridad regresiones | **4** | Camilo diff 0; tests; integridad limpia |

---

## 19. Hallazgos priorizados

### Antes de hermanos (Diseño Visual)

| ID | Hallazgo | Pri |
|----|----------|-----|
| H1 | No mutar pack Visual in-place: versionar pack/regla si se agregan skills de hermanos | **P0** |
| H2 | Documentar/operar re-eval: #3 debe quedar histórica; no update in-place | **P0** |
| H3 | `VISUAL_UI` sin mappings es OK; no “arreglar” inventando evidencia | P1 (proceso) |
| H4 | Política tools (pesos) ya calibrada — no relajar minStrength=20 sin nueva regla | P1 |

### Antes del tercer dominio

| ID | Hallazgo | Pri |
|----|----------|-----|
| H5 | Registry/config PA2 requieren edit de código por dominio | **P0** |
| H6 | Orden radar + labels FE hardcodeados | **P1** |
| H7 | Versión PA2 no congela algoritmo lexico | **P0** conceptual / P1 práctico corto plazo |
| H8 | Falta `mapping_pack_version` + `source_hash` en eval/API | **P1** |
| H9 | Enum `OUTSIDE_SOFTWARE_DOMAIN` | P1 |
| H10 | API historial / comparación v1 vs v2 | P2 |

### Puede esperar

| ID | Hallazgo | Pri |
|----|----------|-----|
| H11 | Separación API skills/tools | P2 |
| H12 | Defaults CLI SOFTWARE | P2 |
| H13 | Entidad `mc_tool` | P3 |
| H14 | Nomenclatura fixtures SOFTWARE | P3 |
| H15 | Rol UX/UI Nidia | **Fuera de MC1** (organigrama) |

---

## 20. Recomendación de siguiente fase

### **Ruta C — Corregir bloqueadores P0/P1 cortos → luego hermanos**

Alcance sugerido **MC1.6.1B.2 (mínimo, ≤1 ciclo)**:

1. Checklist operativo hermanos: nuevo `mapping_pack_version` si el pack cambia; no reusar hash a ciegas.  
2. Persistir `mapping_rules_version` (+ opcional `source_hash`) en evaluación / audit API.  
3. Congelar contrato: cualquier cambio a `compareSpecialtyLexicographic` exige **bump** de `engineRulesVersion`.  
4. (Opcional si hay tiempo) exponer `radarAxisOrder` desde backend metadata del dominio.

**No** bloquear hermanos por refactor grande de tools ni por API historial completa.

---

## 21. Veredicto

# **GO CON CORRECCIONES MENORES**

| Pregunta de salida | Respuesta breve |
|--------------------|-----------------|
| ¿Históricas inmutables? | Filas sí; significado algorítmico no garantizado al 100% |
| ¿PA2 reproducible o label? | Config+hash sí; algoritmo = código vigente |
| ¿Umbrales por dominio/regla? | Por **regla PA2** (bien) |
| ¿Hashes cubren contexto? | Parcial (falta pack version + source + algorithm id) |
| ¿Skills/tools separadas? | Tipo sí; producto no |
| ¿Acoplamiento bloquea 3er dominio? | Registry + FE labels (P0/P1) |
| ¿Visual es config o hardcode? | Config + registro FE/código |
| ¿FE dominios desconocidos? | Parcial (fallback rank) |
| ¿Visual v2? | Via nueva versión catálogo/pack; API no compara aún |
| ¿Hermanos sin deuda crítica? | Sí, si no se muta el pack v1 in-place |
| ¿Antes de Audiovisual? | Parametrizar alta de dominio sin switch/FE hardcode |
| ¿Rol Nidia? | Sigue Analista…; UX/UI=`role_id=44` no asignado |

---

## Apéndice — evidencias de esta fase

**Consultas / scripts RO:** `mc161b1-ro-audit.ts` → `tmp/mc161b1-ro-audit.json`  
**Dry-runs:** Camilo/Nidia ×2; comparación vs persistidos #4/#3  
**Tests:** jest mc-pa2/mc-catalog/competencies; vitest radarLabels/trajectory  
**IDs reales:** eval 2/3/4; catalog 1 RETIRED / 2 ACTIVE; person 1163/1/2; role 25 vs 44  
**Hashes:** mapping SW `c58af992…` · VD `bc29810c…` · config visual `1ed2a80a…` · software 1.1 `c61ad54a…`

**Archivos inspeccionados (núcleo):**  
`mc-pa2.engine.ts`, `mc-pa2.config.ts`, `mc-pa2.service.ts`, `mc-catalog.mapping-hash.ts`, `mapping-registry.ts`, `mapping.service.ts`, `mapping-visual-design-mc16.ts`, `definition-mc12.ts`, `org-chart-competencies.service.ts`, `competencies.response.dto.ts`, FE `radarLabels.ts`, `CompetenciesExplorer.tsx`, `trajectoryNarrative.ts`, entidades `mc_profile_evaluation`, `mc_catalog_version`.
