# Cierre — Cohorte Coordinación de Desarrollo Profesional

**Fecha:** 2026-08-11  
**Veredicto aceptado:** `PROFESSIONAL_DEVELOPMENT_COHORT_TAXONOMY_PENDING`  
**Catálogo unificado:** `1.10.0`  
**Fingerprint:** `eb32f3d848b1e060`  
**Artefactos:** `tmp/mc1-pd-cohort/`

## Estado operativo

- Rama visual v4 (`periodo-agosto-2026`): Alberto 1352 + **30** hijos activos = **31**. UI ~33 incluía 8 vacantes; BD manda.
- 22/22 con CV procesadas · 22/22 `mc1Profile` **AVAILABLE** (en algún grado).
- 9 sin CV · 0 errores de pipeline.
- Primary taxonomy pending legítimo: **1** (Angie 1275).
- Perfiles **no modificados** en este cierre. Sin reejecución Gemini. Sin deploy. Sin recodificar P2/R1.
- Conservar los 22 perfiles AVAILABLE como candidatos a import/deploy posterior.

## Excepción visible post-presentación

| Persona | Id / CV | Estado | Nota |
|---|---|---|---|
| Angie Daniela Saavedra Roncancio | 1275 / 241 | `PRIMARY_TAXONOMY_PENDING` | P2/R1 primary `field.social_work_and_humanitarian_action` @ 0.88 · secondary EDUCATION @ 0.82 · gate null · perfil AVAILABLE solo ED secondary. **No forzar** a EDUCATION / PEOPLE_HR / CUSTOMER_SUCCESS / PPM. |

## Deuda (no implementar ahora)

| Ítem | Tipo | Evidencia | Acción diferida |
|---|---|---|---|
| `SOCIAL_WORK` | Foundation futura (normalización) | Angie 1275 primary. P2 emitió `field.social_work_and_humanitarian_action`. Diagnóstico: **NORMALIZE_DOMAIN** → code futuro `SOCIAL_WORK`. Humanitarian action = contexto/sector, **no** parte obligatoria del domain code. | No construir foundation. No specialties. No radar. |
| `PSYCHOLOGY` | Taxonomy pending no bloqueante | Maureen 1274 secondary `field.psychology` @ 0.81 · EDUCATION primary sano | No absorber en PEOPLE_HR V1 ni en `SOCIAL_WORK` |
| `ACADEMIC_RESEARCH` | Taxonomy incompleta conocida | Alberto 1352 secondary @ 0.62 (deuda ya abierta en Saber) | No construir foundation |
| `IT_SYSTEMS` | Taxonomy incompleta conocida | Karolina 1315 secondary @ 0.25 (débil) | No construir foundation |
| `FASHION_DESIGN` | Propuesto débil no bloqueante | Viviana 1313 secondary `field.fashion_design` @ 0.60 · casi todo EDUCATION_SIGNAL · FA primary sano | No construir foundation |

## Drift no bloqueante (perfiles conservados)

- Alberto 1352: EDUCATION primary + AR pending + HR WEAK.
- Karolina 1315: FA primary + IT 0.25 pending.
- Cristian Bohorquez 1320: EDUCATION primary / P3 ED WEAK / CS OBSERVED · gate `PRIMARY_RESOLVED`.

## Explicitamente fuera de alcance ahora

- No implementar foundation `SOCIAL_WORK`.
- No implementar `PSYCHOLOGY`, `ACADEMIC_RESEARCH`, `IT_SYSTEMS`, `FASHION_DESIGN`.
- No recodificar Angie ni alterar P2/R1/P3/P4/Gate/Profile.
- No deploy / no Cloud / no MC1.
- No avanzar a otra coordinación desde este documento.

**COHORTE CERRADA.** Listo para la siguiente coordinación.
