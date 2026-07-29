# MC1.8.1 — Plan de prototipo · Producción Audiovisual

**Fecha:** 2026-07-28  
**Dominio:** `AUDIOVISUAL_PRODUCTION`  
**Referencias:** [`mc1-domain-blueprint.md`](mc1-domain-blueprint.md) · [`mc1-specialty-blueprint.md`](mc1-specialty-blueprint.md) · [`mc1-audiovisual-domain-guide.md`](mc1-audiovisual-domain-guide.md) · [`mc1-audiovisual-discovery-report.md`](mc1-audiovisual-discovery-report.md)

---

## 1. Auditoría previa MC1 (resumen)

### 1.1 Registro de dominio

| Paso | Mecanismo | Archivo |
|------|-----------|---------|
| Definición declarativa | `MC1_CATALOG_DEFINITION` | `src/mc-catalog/mc-catalog.definition-mc12.ts` |
| Versión catálogo | `MC_CATALOG_VERSION` | `src/mc-catalog/mc-catalog.constants.ts` |
| Seed BD | `npm run mc:catalog -- --seed --activate --i-confirm-seed` | `src/database/scripts/mc-catalog-seed.ts` → `McCatalogService.seedMc12()` |
| Hash catálogo | `computeMcCatalogDefinitionHash()` | `src/mc-catalog/mc-catalog.hash.ts` |

**Política:** nueva versión de catálogo (`mc1.8-2026-07-28`); no mutar `mc1.6-2026-07-27`. Evaluaciones históricas conservan su `catalog_version_id`.

### 1.2 Mapping pack

| Paso | Mecanismo | Archivo |
|------|-----------|---------|
| Pack declarativo | `McDomainMappingPack` | `src/mc-catalog/mc-catalog.mapping-audiovisual-v100.ts` |
| Registro default | `REGISTRY` / `RELEASES` | `src/mc-catalog/mc-catalog.mapping-registry.ts` |
| Hash pack | `computeMcMappingPackHash()` | `src/mc-catalog/mc-catalog.mapping-hash.ts` |
| Publicación | `publishOrAssertPackRelease()` | `src/mc-catalog/mc-catalog.mapping.service.ts` |
| Seed | `npm run mc:mappings -- --seed --i-confirm-seed --domain=AUDIOVISUAL_PRODUCTION` | `src/database/scripts/mc-mappings-seed.ts` |

**Inmutabilidad:** hash distinto en misma `pack_version` → error; bump `1.0.1` / `1.1.0` / `2.0.0`.

### 1.3 Regla PA2

| Paso | Mecanismo | Archivo |
|------|-----------|---------|
| Config versionada | `getMcPa2EngineConfigAudiovisualProductionV100()` | `src/mc-catalog/mc-pa2.config.ts` |
| Resolución | `resolveMcPa2EngineConfig('pa2-audiovisual-production-1.0.0')` | idem |
| Fingerprints congelados | `MC_PA2_PUBLISHED_RULE_FINGERPRINTS` | `src/mc-catalog/mc-pa2.algorithm.ts` |
| Motor genérico | `runMcPa2Engine()` | `src/mc-catalog/mc-pa2.engine.ts` (sin lógica AV hardcodeada) |

### 1.4 Evaluación y dry-run

```bash
npm run mc:evaluate -- --extraction-id=216 --domain=AUDIOVISUAL_PRODUCTION \
  --rules-version=pa2-audiovisual-production-1.0.0 --dry-run --out=tmp/mc181-santiago-dryrun.json
```

Trazabilidad: `evaluation_context` incluye `source_hash`, `mapping_hash`, `config_hash`, `algorithm_version`, `pack_code`, `pack_version`.

### 1.5 Persistencia

```bash
npm run mc:evaluate -- --extraction-id=216 --domain=AUDIOVISUAL_PRODUCTION \
  --rules-version=pa2-audiovisual-production-1.0.0 --i-confirm-evaluate
```

Solo tras gates §16 del brief MC1.8.1.

### 1.6 API / frontend

- Endpoints dinámicos: `GET /api/org-chart/person/:id/competencies` (+ dominio/especialidad).
- `OrgChartCompetenciesService` lee evaluaciones persistidas; **sin** `if (domain === 'AUDIOVISUAL')`.
- Radar: orden desde `MC_DOMAIN_RADAR_AXIS_ORDER`.

### 1.7 Identificador de dominio

- **Usar:** `AUDIOVISUAL_PRODUCTION` (único en catálogo MC1 PA2).
- **No crear:** `AUDIOVISUAL`, `AV`, `MULTIMEDIA`, `VIDEO_PRODUCTION`.
- **Nota:** `cv-attributes.catalog-pa1.ts` tiene `AUDIOVISUAL_PRODUCTION` en PA1 legacy — dominio distinto; no reutilizar mappings PA1.

---

## 2. Alcance MC1.8.1

### 2.1 Implementar

| Componente | Detalle |
|----------|---------|
| Catálogo | Dominio + 3 especialidades: `AV_EDITING`, `AV_MOTION`, `AV_POST` |
| Pack | `audiovisual-production-mappings@1.0.0` |
| PA2 | `pa2-audiovisual-production-1.0.0` (LEXICOGRAPHIC + anti-tool, calibrado Visual 1.1.0) |
| Corpus | Santiago `1000944247` (ext **216**); Juan Pablo `1022445625` (ext **208**) |
| Tests | `mc-catalog.audiovisual.spec.ts` + actualización definition / fingerprints |

### 2.2 No implementar

`AV_PRODUCTION`, `AV_PHOTOGRAPHY`, `AV_SOUND`, `AV_STREAMING` (solo OUTSIDE / documentación).

---

## 3. Archivos afectados

| Archivo | Acción |
|---------|--------|
| `src/mc-catalog/mc-catalog.constants.ts` | Bump `MC_CATALOG_VERSION` → `mc1.8-2026-07-28` |
| `src/mc-catalog/mc-catalog.definition-mc12.ts` | Dominio + 3 especialidades + radar order |
| `src/mc-catalog/mc-catalog.mapping-audiovisual-v100.ts` | **Nuevo** pack 1.0.0 |
| `src/mc-catalog/mc-catalog.mapping-registry.ts` | Registro AV |
| `src/mc-catalog/mc-pa2.config.ts` | PA2 AV 1.0.0 |
| `src/mc-catalog/mc-pa2.algorithm.ts` | Fingerprint PA2 AV |
| `src/mc-catalog/mc-catalog.definition.spec.ts` | 3 dominios |
| `src/mc-catalog/mc-catalog.audiovisual.spec.ts` | **Nuevo** tests pack/PA2/fronteras |
| `src/mc-catalog/mc-evaluation-context.spec.ts` | Fingerprint AV |
| `docs/mc1.8.1-audiovisual-prototype-results.md` | Resultados post dry-run |
| `docs/mc1-audiovisual-domain-guide.md` | Actualización hallazgos confirmados |

**Sin cambios:** Visual/Software packs, PA2 software/visual, motor evidence, extractor.

---

## 4. Vocabulario (evidencia real)

Skills con key `normalized_key` en extracciones **216** y **208** (ver `tmp/mc181-skill-keys.ts`).

**Núcleo mapeado:** `edicion_de_video`, `motion_graphics`, `animacion_2d`, `animacion_2d/3d`, `ajuste_de_color`, tools Premiere/DaVinci/CapCut/AE.

**OUTSIDE AV:** identidad visual, InDesign, iSpring, email marketing, audio DAWs, fotografía comercial (reservada), `adobe_suite` genérico.

**Aliases operativos:** claves distintas misma práctica (`adobe_premiere` / `adobe_premiere_pro`; `animacion_2d` / `animacion_2d/3d`) — no términos ambiguos (`multimedia`, `producción`).

---

## 5. Riesgos

| # | Riesgo | Mitigación |
|---|--------|------------|
| R1 | Bump catálogo afecta seed activo | Nueva versión; evals históricas en mc1.6 intactas |
| R2 | `animacion_2d/3d` con slash en key | Incluir literal en pack |
| R3 | Juan Pablo mezcla dominios | OUTSIDE explícito visual/DI/marketing |
| R4 | ACTIVE solo por tools | PA2 anti-tool + tests |
| R5 | Cardinalidad 2 skills bloquea POST | Aceptar EMERGENT en POST; documentar |
| R6 | Regresión Visual/Software | Suites Jest + dry-run regresión |

---

## 6. Estrategia de rollback

1. **Catálogo:** reactivar versión `mc1.6-2026-07-27` vía `activateCatalogVersion` (sin borrar mc1.8).
2. **Mappings:** pack AV no afecta dominios existentes; desactivar evaluaciones AV si se persistieron.
3. **Código:** revertir commit; fingerprints PA2 AV no publicados hasta seed en prod.
4. **BD:** evaluación Santiago eliminable por `evaluation_id` sin tocar Visual/Software.

---

## 7. Gates de persistencia (Santiago)

Persistir solo si:

- [ ] Resultado profesional defendible (≥1 ACTIVE con contribución profesional)
- [ ] Ninguna especialidad ACTIVE solo-tools
- [ ] Juan Pablo sin inflación generalizada
- [ ] Regresiones Software/Visual OK
- [ ] Hashes deterministas
- [ ] Tests pasan

---

**Plan:** MC1.8.1 · listo para ejecución · 2026-07-28
