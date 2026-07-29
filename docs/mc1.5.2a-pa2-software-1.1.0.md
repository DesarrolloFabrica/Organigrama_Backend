# MC1.5.2A — pa2-software-1.1.0 · corrección de especialidad principal

## Problema de 1.0.0

Con Coverage y cardinalidad iguales, Frontend ganaba el default porque:

`primaryStrongCount × 12` aportaba +24 puntos (3 vs 1)

y superaba la ventaja real de Backend en Strength (+17.1) y Confidence.

`primaryStrongCount` actuaba como **factor dominante**, no como desempate.

## Estrategia seleccionada: LEXICOGRAPHIC

Para especialidades del mismo `presentationStatus`, orden:

1. `evidencedSkillCount` ↓  
2. `coverage` ↓  
3. `strength` ↓  
4. `confidence` ↓  
5. `primaryStrongCount` ↓  
6. `mappedSkillCount` ↓  
7. `specialtyCode` ↑ (estable)

Default = primera ACTIVE.

### Por qué no NORMALIZED_SCORE

Se simuló un score con componentes en 0–1 y `primaryContributionWeight = 5`.  
También elige Backend para Camilo, pero:

- mezcla pesos arbitrarios otra vez;
- es menos explicable ante producto (“¿por qué 30/30/20/15/5?”);
- el lexicográfico responde la pregunta de negocio sin fórmulas.

No se adoptó híbrido.

## Alternativa descartada

`NORMALIZED_SCORE` permanece implementable en el motor (`rankingStrategy`) para pruebas, pero **no** es la versión activa 1.1.0.

## Versionamiento

| Versión | Estrategia | Default global CLI |
|---------|------------|--------------------|
| `pa2-software-1.0.0` | WEIGHTED_SCORE (histórico) | Sí (`getDefaultMcPa2EngineConfig`) |
| `pa2-software-1.1.0` | LEXICOGRAPHIC | Solo con `--rules-version=` |

Umbrales ACTIVE / EMERGENT / HIDDEN: **sin cambios**.

## Resultado Camilo

| | 1.0.0 (eval id=1) | 1.1.0 (eval id=2) |
|--|-------------------|-------------------|
| Default | SOFTWARE_FRONTEND | **SOFTWARE_BACKEND** |
| ACTIVE | 5 | 5 |
| EMERGENT | 2 | 2 |
| is_active | false (conservada) | **true** |

### Ranking

| Especialidad | Rank 1.0.0 | Rank 1.1.0 | Cambio |
|--------------|------------|------------|--------|
| Backend | 2 | 1 | +1 |
| Frontend | 1 | 2 | −1 |
| Bases de datos | 3 | 3 | 0 |
| Ing. y calidad | 5 | 4 | +1 |
| IA aplicada | 4 | 5 | −1 |
| Cloud | 7 | 6 | +1 |
| APIs | 6 | 7 | −1 |

**Por qué Backend > Frontend:** misma masa (11) y Coverage (1.0); Strength 48.1 > 31; Confidence 0.8537 > 0.8307. `primaryStrong` no interviene.

**IA vs Ingeniería:** en lexicográfico, Ingeniería tiene más skills evidenciadas (4 vs 1) y mayor Coverage, por eso sube frente a IA (que en 1.0.0 puntuaba alto por strength concentrado + primaryStrong en el score ponderado).

**Cloud vs APIs (EMERGENT):** Cloud tiene más skills evidenciadas (3 vs 1).

### Métricas invariantes

Coverage, Strength, Confidence y `presentationStatus` **idénticos** entre versiones (ver JSON de comparación).

## Narrativa (no canónica)

> Perfil Full Stack con énfasis Backend

No se creó `SOFTWARE_FULLSTACK` ni campo `profileSummary` en esta fase.

## API / Frontend

- API resuelve evaluación `is_active = TRUE` → id=2 → `defaultSpecialtyCode = SOFTWARE_BACKEND`.
- Frontend: **sin cambios de contrato ni UI**; el radar sigue mostrando Coverage; solo cambian principal/ranking semánticos.

## CLI

```bash
npm run mc:evaluate -- --extraction-id=206 --domain=SOFTWARE --rules-version=pa2-software-1.1.0 --dry-run
npm run mc:evaluate -- --extraction-id=206 --domain=SOFTWARE --rules-version=pa2-software-1.1.0 --i-confirm-evaluate
```

## Artefactos

- `tmp/cv-attributes/mc1.5.2a-camilo-pa2-comparison.json`
- `tmp/cv-attributes/mc1.5.2a-camilo-pa2-1.1.0-dry-run.json`
- `tmp/cv-attributes/mc1.5.2a-camilo-pa2-1.1.0-persisted.json`

## Alcance

- No Nidia / no nuevo dominio / no mappings / no Evidence / no cambios frontend.
