# Cierre — Cohorte Pruebas Saber

**Fecha:** 2026-08-11  
**Veredicto aceptado:** `PRUEBAS_SABER_COHORT_VALIDATED_WITH_DRIFT`  
**Catálogo unificado:** `1.10.0`  
**Artefactos:** `tmp/mc1-saber-cohort/`

## Estado operativo

- 11/11 activos (Diana 1192 + 10 hijos v4); vacante 1300 excluida.
- 11/11 con CV · 11/11 `mc1Profile` **AVAILABLE**.
- Primary taxonomy pending: 0.
- Perfiles **no modificados** en este cierre. Sin reejecución Gemini. Sin deploy.
- Conservar los 11 perfiles AVAILABLE para el próximo batch de producción.

## Deuda (no implementar ahora)

| Ítem | Tipo | Evidencia | Acción diferida |
|---|---|---|---|
| `ACADEMIC_RESEARCH` | Taxonomy incompleta | Secondary ×2: Diana 1192 (0.55), Leidy 1298 (0.72) | No construir foundation todavía |
| `IT_SYSTEMS` | Taxonomy incompleta | Secondary ×2: Samary 1203 (0.45), Diego 1228 (0.80) | No construir foundation todavía |
| Lisneidy 1227 | Control futuro | Posible `EDUCATION_CONTEXT_OVERCLASSIFICATION` (ops/admisiones en contexto educativo vs práctica EDUCATION) | Revisar en batch posterior; no tocar perfil ahora |
| Lina 1201 | Control futuro | Posible `DATA_ANALYTICS_SECONDARY_OVERCLASSIFICATION` (DA 0.82 sin specialty DA OBSERVED) | Revisar en batch posterior; no tocar perfil ahora |

## Explicitamente fuera de alcance ahora

- No implementar `ACADEMIC_RESEARCH`.
- No implementar `IT_SYSTEMS`.
- No recodificar assessment/psicometría como dominio nuevo.
- No avanzar a otra coordinación desde este documento.

**COHORTE CERRADA.** Listo para la siguiente coordinación.
