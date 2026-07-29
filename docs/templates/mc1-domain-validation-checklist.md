# Checklist — dominio listo para CONSOLIDATED

**Versión:** MC1.7.0 · 2026-07-28  
**Dominio:** `____________________` (`DOMAIN_CODE`)  
**Evaluador:** ____________________  
**Fecha:** ____________________

**Referencias:**

- Blueprint: [`mc1-domain-blueprint.md`](../mc1-domain-blueprint.md) §10
- Domain Guide: `docs/mc1-________________-domain-guide.md`
- Versionamiento técnico: [`mc1-domain-versioning-policy.md`](../mc1-domain-versioning-policy.md)

**Instrucciones:**

- Marcar **Sí / No / N/A** en cada ítem.
- CONSOLIDATED requiere **100 %** de ítems obligatorios en **Sí** o **N/A justificado**.
- Adjuntar rutas de artefactos en la columna Evidencia.

---

## A. Gobernanza y documentación

| # | Criterio | Sí | No | N/A | Evidencia |
|---|----------|----|----|-----|-----------|
| A1 | Existe Domain Guide completo según plantilla | ☐ | ☐ | ☐ | |
| A2 | Estado de madurez declarado explícitamente | ☐ | ☐ | ☐ | |
| A3 | Roadmap vNext documentado (pack aliases, no deuda silenciosa) | ☐ | ☐ | ☐ | |
| A4 | Convención de fases MC1 seguida (auditorías numeradas) | ☐ | ☐ | ☐ | |
| A5 | Blueprint MC1.7.0 citado en fase Discovery | ☐ | ☐ | ☐ | |

---

## B. Definición y fronteras

| # | Criterio | Sí | No | N/A | Evidencia |
|---|----------|----|----|-----|-----------|
| B1 | Definición “qué es / qué no es” publicada | ☐ | ☐ | ☐ | |
| B2 | Diferencia dominio vs cargo documentada con ejemplo real | ☐ | ☐ | ☐ | |
| B3 | ≥3 fronteras con dominios vecinos + regla de desempate | ☐ | ☐ | ☐ | |
| B4 | ≥1 perfil OUTSIDE validado (verdadero negativo) | ☐ | ☐ | ☐ | |
| B5 | Casos ambiguos listados con resolución provisional o final | ☐ | ☐ | ☐ | |
| B6 | Clasificaciones OUTSIDE del pack son deliberadas (no huecos) | ☐ | ☐ | ☐ | |

---

## C. Especialidades

| # | Criterio | Sí | No | N/A | Evidencia |
|---|----------|----|----|-----|-----------|
| C1 | Cada especialidad ACTIVE tiene ficha (definición, núcleo, exclusiones) | ☐ | ☐ | ☐ | |
| C2 | Especialidades RESERVED tienen política explícita (por qué sin mappings) | ☐ | ☐ | ☐ | |
| C3 | Candidatas a eliminación (CANDIDATE_REMOVE) documentadas con justificación | ☐ | ☐ | ☐ | |
| C4 | No hay dos especialidades que produzcan estados idénticos en todo el corpus | ☐ | ☐ | ☐ | |
| C5 | ≥1 especialidad en sub-estado CONSOLIDATED (ACTIVE reproducible) | ☐ | ☐ | ☐ | |
| C6 | Especialidades secundarias evaluadas (no solo la nuclear) | ☐ | ☐ | ☐ | |

---

## D. Vocabulario y aliases

| # | Criterio | Sí | No | N/A | Evidencia |
|---|----------|----|----|-----|-----------|
| D1 | Matriz skill encontrada → canónica publicada | ☐ | ☐ | ☐ | |
| D2 | ≥90 % formulaciones recurrentes del corpus resueltas (alias o key) | ☐ | ☐ | ☐ | |
| D3 | Falsos negativos restantes tienen ticket (alias planificado o OUTSIDE deliberado) | ☐ | ☐ | ☐ | |
| D4 | No hay aliases que equiven prácticas distintas (falsas equivalencias revisadas) | ☐ | ☐ | ☐ | |
| D5 | Tools genéricas (suites) no mapean a especialidades | ☐ | ☐ | ☐ | |
| D6 | Vacíos P0 del catálogo cerrados o explícitamente diferidos con fecha | ☐ | ☐ | ☐ | |

---

## E. Corpus de validación (calidad, no cantidad fija)

| # | Criterio | Sí | No | N/A | Evidencia |
|---|----------|----|----|-----|-----------|
| E1 | Persona semilla con cadena CV completa y `source_hash` alineado | ☐ | ☐ | ☐ | |
| E2 | ≥1 perfil MATCH (además de semilla si aplica) | ☐ | ☐ | ☐ | |
| E3 | ≥1 perfil BORDERLINE documentado | ☐ | ☐ | ☐ | |
| E4 | ≥1 perfil OUTSIDE documentado | ☐ | ☐ | ☐ | |
| E5 | Cobertura de diversidad de señal (no todos mismo patrón EMERGENT) | ☐ | ☐ | ☐ | |
| E6 | Perfiles seleccionados por evidencia CV, no por cargo | ☐ | ☐ | ☐ | |

---

## F. Comportamiento PA2 (sin modificar reglas)

| # | Criterio | Sí | No | N/A | Evidencia |
|---|----------|----|----|-----|-----------|
| F1 | Dry-run 2× determinista en todo el corpus (`evaluationContextHash` igual) | ☐ | ☐ | ☐ | |
| F2 | Perfiles OUTSIDE no producen ACTIVE en el dominio | ☐ | ☐ | ☐ | |
| F3 | Perfiles MATCH producen estados coherentes con lectura manual del CV | ☐ | ☐ | ☐ | |
| F4 | Tools solas no activan especialidad (anti-tool verificado si aplica) | ☐ | ☐ | ☐ | |
| F5 | Falsos positivos conocidos corregidos en pack o documentados como frontera | ☐ | ☐ | ☐ | |
| F6 | `mapping_hash` y `config_hash` registrados en artefactos dry-run | ☐ | ☐ | ☐ | |

---

## G. Versionamiento técnico (referencia)

| # | Criterio | Sí | No | N/A | Evidencia |
|---|----------|----|----|-----|-----------|
| G1 | Pack release PUBLISHED con hash congelado | ☐ | ☐ | ☐ | |
| G2 | Regla PA2 con fingerprint publicado | ☐ | ☐ | ☐ | |
| G3 | Política de nueva versión pack documentada (cuándo bump) | ☐ | ☐ | ☐ | |
| G4 | Evaluaciones históricas no mutadas in-place | ☐ | ☐ | ☐ | |

---

## H. Producción (opcional antes de CONSOLIDATED; obligatorio antes de PRODUCTION)

| # | Criterio | Sí | No | N/A | Evidencia |
|---|----------|----|----|-----|-----------|
| H1 | API/FE muestra dominio sin hardcode incorrecto | ☐ | ☐ | ☐ | |
| H2 | Runbook de re-evaluación por drift CV | ☐ | ☐ | ☐ | |
| H3 | Política de persistencia masiva definida | ☐ | ☐ | ☐ | |

---

## Resumen de decisión

| Métrica | Valor |
|---------|-------|
| Ítems obligatorios (A–G) total | ___ |
| Ítems Sí + N/A justificado | ___ |
| Ítems No bloqueantes | ___ |
| **¿Declarar CONSOLIDATED?** | **Sí / No** |

### Bloqueadores (si No)

| ID | Descripción | Plan |
|----|-------------|------|
| | | |

### Aprobaciones

| Rol | Nombre | Fecha | Firma |
|-----|--------|-------|-------|
| Metodología MC1 | | | |
| Dominio / Producto | | | |

---

**Plantilla:** MC1.7.0 · [`mc1-domain-validation-checklist.md`](mc1-domain-validation-checklist.md)
