# MC1.3.5 — Informe de activación Cloud

**Estado final: SUCCESS**

Fecha: 2026-07-27  
Alcance: activación segura de MC1 (migraciones 018–020, seeds, PA2 Camilo, API Explorador) sobre la BD remota configurada en Organigrama.  
Sin cambios de lógica funcional MC1.3.1–MC1.3.4.

---

## 1. Entorno validado

| Campo | Valor |
|-------|--------|
| Host (enmascarado) | `136.x.x.135` (IPv4 Cloud) |
| Base de datos | `core` |
| Schema app | `core` (tablas MC en `organigrama`) |
| SSL | `true` |
| `NODE_ENV` | `development` (cliente local apuntando a Cloud) |
| ¿Host local? | **No** |
| Proyecto GCP | No detectable (`gcloud` CLI ausente; sin `GOOGLE_CLOUD_PROJECT`) |

No se exponen contraseñas, tokens ni connection strings.

---

## 2. Auditoría previa (solo lectura)

### Matriz de migraciones (antes)

| Migración | Aplicada | Evidencia |
|-----------|----------|-----------|
| 018 | No | Ausentes `mc_catalog_version`, `mc_domain`, `mc_specialty` |
| 019 | No | Ausentes `mc_skill_domain_classification`, `mc_skill_specialty_mapping` |
| 020 | No | Ausentes `mc_profile_evaluation`, `mc_profile_specialty_result` |

Historial de migraciones versionado: **no existe** en BD. Flujo oficial del proyecto: archivos `migrations/*.sql` vía `psql -f`.

### Piloto Camilo

| ID | Estado |
|----|--------|
| `personCvId=187` | Activo; `person_id=1` |
| `extractionId=206` | `SUCCEEDED`, activa, 59 skills |
| `enrichmentId=2` | `SUCCEEDED`, activa, extraction 206 |
| `evidenceEvaluationId=3` | `SUCCEEDED`, activa, enrichment 2 / extraction 206 |
| Skills resueltas a `cv_skill` | 59/59 |
| Misma persona | Sí (`person_id=1`) |

### Impacto estimado (antes de escribir)

- Tablas nuevas: 7 (`mc_*`)
- Sin ALTER de `cv_*` / PA1 / Extractor / Enrichment / Evidence
- Riesgo de bloqueo: bajo
- Rollback: DDL aditivo; revertir requiere `DROP` aprobado de `mc_*`
- Duración: minutos

Artefacto: `tmp/cv-attributes/mc1.3.5-preflight-audit.json`

---

## 3. Dry-run previo

| Comando | Resultado |
|---------|-----------|
| `mc:catalog --dry-run` | **No existe.** Inspección: definición MC1.2 + tests `mc-catalog.definition.spec` |
| `mc:mappings --dry-run` | **No existe.** Inspección: pack + tests `mc-catalog.mapping.spec` (42/14/3/0/0) |
| Fixture PA2 Camilo | 5 ACTIVE, 2 EMERGENT, default `SOFTWARE_FRONTEND` |
| `mc:evaluate --dry-run` (antes de migrar) | Falló esperado: tablas `mc_*` inexistentes |
| `mc:evaluate --dry-run` (tras seeds) | Coincide con artefacto MC1.3.3 |

---

## 4. Migraciones aplicadas

Mecanismo: `src/database/scripts/mc135-apply-migrations.ts`  
(equivalente a `psql -f` archivo completo; `psql` no estaba instalado en el host).

| Archivo | Aplicada | Validación |
|---------|----------|------------|
| `018_mc_competency_catalog.sql` | Sí | Tablas + constraint lifecycle sin EMERGENT |
| `019_mc_skill_specialty_mapping.sql` | Sí | Tablas + constraint de peso |
| `020_mc_profile_evaluation.sql` | Sí | Tablas + índice de evaluación activa |

Artefacto: `tmp/cv-attributes/mc1.3.5-migrations.json`

---

## 5. Seeds

### Catálogo

```
npm run mc:catalog -- --seed --activate --i-confirm-seed
→ outcome=SEEDED, version mc1.2-2026-07-27 ACTIVE, domains=1, specialties=7
```

Árbol SOFTWARE (todas `lifecycle=ACTIVE`, sin Arquitectura):

```
SOFTWARE
├── SOFTWARE_FRONTEND
├── SOFTWARE_BACKEND
├── SOFTWARE_DATA
├── SOFTWARE_API_INTEGRATION
├── SOFTWARE_CLOUD_DEPLOY
├── SOFTWARE_ENGINEERING_QUALITY
└── SOFTWARE_AI_APPLIED
```

### Mappings

```
npm run mc:mappings -- --seed --i-confirm-seed
→ classifications=59 mappings=48 dual SECONDARY=6
→ distribución 42 / 14 / 0 / 3 / 0

npm run mc:mappings -- --verify-extraction=206
→ ok=true skillCount=59 misma distribución
```

---

## 6. Evaluación PA2 Camilo

Dry-run post-seed:

```
default=SOFTWARE_FRONTEND ACTIVE=5 EMERGENT=2 HIDDEN=0
```

Persistencia:

```
npm run mc:evaluate -- --extraction-id=206 --domain=SOFTWARE --i-confirm-evaluate
→ outcome=SEEDED evaluationId=1
```

| Campo | Valor |
|-------|--------|
| status | `SUCCEEDED` |
| is_active | true (única activa por persona/dominio) |
| rules | `pa2-software-1.0.0` |
| default | `SOFTWARE_FRONTEND` |
| resultados | 7 (5 ACTIVE, 2 EMERGENT, 0 HIDDEN) |
| extraction / evidence / catalog | 206 / 3 / mc1.2-2026-07-27 |

---

## 7. API del Explorador (datos reales)

`personId=1` (Camilo). Verificado con `verify-mc134-camilo-explorer.ts` y `mc135-postcheck.ts`.

### Resumen

`GET /api/org-chart/person/1/competencies`

- `availabilityStatus=AVAILABLE`
- default `SOFTWARE_FRONTEND`
- 5 ACTIVE / 2 EMERGENT
- Sin payload documental de evidencias (`evidence.items` solo en detalle)

### Dominio SOFTWARE

7 especialidades, ranks 1–7.

### Frontend

| Métrica | Valor |
|---------|--------|
| presentationStatus | ACTIVE |
| isDefault | true |
| rank | 1 |
| mapped / evidenced | 11 / 11 |
| coverage | 1 |
| confidence | 0.8307 |
| strength | 31 |
| skills | 11 con evidencias fragmentarias |

---

## 8. Seguridad

| Caso | Resultado |
|------|-----------|
| Propio perfil (`personId=1`) | Permitido |
| Tercero sin jerarquía | `403 COMPETENCY_ACCESS_DENIED` |
| `includeAudit` + `includeHidden` sin permiso | Sigue denegado |
| Evidencias | Truncadas (≤400); sin CV completo |

---

## 9. Idempotencia

| Acción | Resultado |
|--------|-----------|
| Re-seed catálogo | `ALREADY_SEEDED` (1 dominio, 7 especialidades) |
| Re-seed mappings | `ALREADY_SEEDED` (59 / 48, misma distribución) |
| Re-evaluate persist | **No repetido** (política `ALREADY_EXISTS`) |
| Evaluate dry-run tras persist | Misma distribución 5/2, sin nueva escritura |

---

## 10. Integridad final

| Entidad | Esperado | Real |
|---------|----------|------|
| Versiones catálogo activas | 1 | 1 |
| Dominios SOFTWARE | 1 | 1 |
| Especialidades SOFTWARE | 7 | 7 |
| Clasificaciones | 59 | 59 |
| DOMAIN_SPECIALTY | 42 | 42 |
| TRANSVERSAL_FUTURE | 14 | 14 |
| AMBIGUOUS | 3 | 3 |
| Resultados especialidad Camilo | 7 | 7 |
| ACTIVE / EMERGENT | 5 / 2 | 5 / 2 |
| Defaults | 1 | 1 |

Anomalías (FKs rotas, pesos inválidos, duplicados, soft-skill mappings, evals activas duplicadas, Arquitectura): **todas 0**.

---

## 11. Incidencias

1. `psql` no instalado → se usó runner de archivo completo (`mc135-apply-migrations.ts`) sobre los mismos SQL oficiales.
2. `gcloud` no disponible → proyecto GCP no reportado.
3. `mc:catalog` / `mc:mappings` sin `--dry-run` → inspección vía tests/pack + verify-extraction (no se agregó flag en esta fase).
4. Falso positivo menor en postcheck inicial: substring `evidence` dentro de `evidencedSkillCount` (corregido en JSON final).

Ninguna incidencia bloqueó el flujo.

---

## 12. Estado final y readiness

**SUCCESS**

Flujo Cloud verificado:

Datos reales → Catálogo → Mappings → PA2 persistido → API autorizada → respuesta consumible.

**Listo para iniciar MC1.4 — Explorador de Competencias en frontend.**

### Archivos

- `docs/mc1.3.5-cloud-activation-report.md` (este documento)
- `tmp/cv-attributes/mc1.3.5-cloud-verification.json`
- `tmp/cv-attributes/mc1.3.5-preflight-audit.json`
- `tmp/cv-attributes/mc1.3.5-migrations.json`
- Scripts auxiliares: `mc135-preflight-audit.ts`, `mc135-apply-migrations.ts`, `mc135-postcheck.ts`
