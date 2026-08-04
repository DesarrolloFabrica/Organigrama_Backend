# Auditoría del entorno PostgreSQL local — videos de presentación

**Fase:** 2A.1  
**Fecha:** 2026-08-03  
**Modo:** solo lectura  
**Migración relacionada:** `migrations/025_person_video.sql`  
**Estado migración (actualizado Fase 2A.2):** **APLICADA_Y_VALIDADA** en Cloud SQL (`core`), tras autorización explícita.  
**Nota:** esta auditoría (2A.1) documentó la ausencia de entorno **local**; no invalidó el uso operativo de Cloud SQL del proyecto.

---

## 1. Configuración detectada del backend

Archivos `.env*` en `Organigrama_Backend`:

| Archivo | Existe |
|---------|--------|
| `.env` | Sí |
| `.env.development` | Sí |
| `.env.production` | Sí |
| `.env.example` | Sí |
| `.env.mc1-local.example` | Sí |
| `.env.mc1-local-admin.example` | Sí |
| `.env.mc1-local` | **No** |

Variables DB presentes en `.env` (valores sensibles omitidos):

| Variable | Valor observado (sanitizado) |
|----------|------------------------------|
| `DB_HOST` | IP pública (`136.113.128.135`) — clasificado como **host remoto / Cloud SQL**, no localhost |
| `DB_PORT` | `5432` |
| `DB_NAME` | `core` |
| `DB_SCHEMA` | `core` |
| `DB_USERNAME` | `user-core` |
| `DB_PASSWORD` | presente (redactado) |
| `DB_SSL` | `true` |

**Conclusión de apuntado:** el backend de este equipo está configurado hacia **Cloud SQL / instancia remota**, no hacia PostgreSQL local ni Docker local.

**Proceso en ejecución:** `npm run start:dev` (Nest) activo; la API arrancó en `localhost:3000` y responde consultas de organigrama (logs muestran vacantes/versiones). Eso implica conectividad operativa a la BD remota configurada. **Esta auditoría no se conectó a Cloud SQL ni ejecutó consultas contra ella.**

---

## 2. PostgreSQL y servicios en este PC

| Comprobación | Resultado |
|--------------|-----------|
| Puerto **5432** en escucha | No |
| Puerto **5433** en escucha | No |
| Servicio Windows `postgres*` / `pgsql*` | No encontrado |
| Binarios `psql` / `postgres` en PATH | No |
| Instalación en `C:\Program Files\PostgreSQL` | No |
| Docker CLI | No disponible (`docker` no reconocido) |
| Docker Desktop | No instalado (rutas estándar ausentes) |
| Contenedor `organigrama-postgres` | No aplicable (sin Docker) |
| Contenedor `mc1-postgres-local` | No aplicable |

**PostgreSQL nativo Windows:** no detectado.  
**Docker:** no disponible en este equipo.

No se inició ni detuvo ningún servicio.

---

## 3. Bases locales encontradas

**Ninguna.** Sin demonio local escuchando, sin Docker, sin `psql`, no fue posible listar bases locales.

No se intentó autenticación contra el host remoto del `.env` (Cloud SQL — fuera de alcance y prohibido en esta fase).

Candidatos nominales buscados y **no verificables localmente**:

| Nombre candidato | Estado en este PC |
|------------------|-------------------|
| `organigrama` | No hay instancia local que lo hospede |
| `core` | Solo referenciado como `DB_NAME` remoto en `.env` |
| `mc1_local` | Sin compose levantado; sin `.env.mc1-local`; sin puerto 5433 |

---

## 4. Clasificación de candidatas

| Candidata | Clasificación | Motivo |
|-----------|---------------|--------|
| BD remota `core` @ IP Cloud (`.env`) | **NO_RELACIONADO** *para validación local de 025* | Es el entorno de ejecución actual del backend, pero **no es local** y no puede auditarse/aplicarse 025 en esta fase |
| `organigrama` (compose principal) | **NO_RELACIONADO** | Definida en YAML; contenedor/volumen inexistentes aquí |
| `mc1_local` | **SANDBOX_LEGACY** (potencial) | Existe tooling en repo; **no** está desplegado; no debe usarse para Organigrama representativo |
| (ninguna local) | — | Sin candidato local |

No hubo validación de schemas/tablas/filas en ninguna BD (sin acceso local autorizado y Cloud SQL excluido).

---

## 5. Mejor entorno candidato

**Ninguno local.**

El único entorno con evidencia de datos reales de Organigrama es el **remoto** configurado en `.env` (Cloud), fuera del alcance de validación de esta fase.

---

## 6. Compatibilidad con migración 025

| Criterio | Resultado |
|----------|-----------|
| Schema `organigrama` en BD local | No verificable |
| `core.person` en BD local | No verificable |
| Tipo vivo `core.person.id` | No verificable en BD |
| Tipo vivo `core.person.document` | No verificable en BD |
| `organigrama.person_video` ya existe | No verificable |
| Colisiones de constraints/índices | No verificable en BD |
| Permisos CREATE en `organigrama` | No verificable |

**Compatibilidad estática (código / contrato del repo, no BD):**

- Entity `Person`: `id` = `bigint` increment → alineado con `BIGINT` / `REFERENCES core.person(id)`.
- `document` = `varchar(80)` → alineado con `VARCHAR(80)` de 025.
- Longitudes Drive alineadas a `person_cv` / migración 012.

**Determinación formal para entorno local:** **NO_PUEDE_DETERMINARSE**

(La compatibilidad estructural del SQL respecto al código TypeORM es plausible, pero **no sustituye** validación en una BD representativa.)

---

## 7. Estado de Docker Compose principal

Archivo: `Organigrama_Backend/docker-compose.yml`

| Campo | Valor |
|-------|-------|
| Imagen | `postgres:16-alpine` |
| Contenedor | `organigrama-postgres` |
| Puerto host | `5432:5432` |
| `POSTGRES_DB` | `organigrama` |
| `POSTGRES_USER` | `postgres` |
| Volumen | `organigrama_pgdata` |
| Volumen existe en este PC | No (Docker ausente) |
| Contenedor activo | No |
| Bootstrap de datos | **No** — solo imagen vacía + env; sin scripts init SQL montados |
| Seed | Opcional vía app (`RUN_DEMO_SEED=true` → seed demo si `person` vacía); **no** es baseline institucional |

También existe `docker-compose.mc1-local.yml` (`mc1_local` / puerto **5433**) — sandbox legacy MC1; no levantado; **no recomendado** como entorno Organigrama.

No se ejecutó `docker compose up`.

---

## 8. Baselines y backups

| Tipo | Hallazgo |
|------|----------|
| `.dump` / `.backup` / `.tar` / `.gz` de PG | **Ninguno** en el workspace (excl. ruido) |
| Carpetas `baseline` / `backup` / `dumps` | **Ninguna** |
| Scripts `pg_dump` / `pg_restore` operativos | **No** encontrados como artefactos de restauración |
| Migraciones `001`–`025` | Presentes; **excluidas** como baseline completo |
| `migrations/local/000_mc1_local_prerequisites.sql` | Stub MC1 — **excluido** |
| Seeds demo (`organigrama-demo.seed.ts`) | Parcial / demo — **excluido** como baseline |
| `docs/mc1.6-visual-design-four-profile-baseline.md` | Baseline documental MC1 de perfiles — **no** es dump PG |
| `tmp/*.json` | Artefactos de corridas MC1 — **no** schema/data dump |

**Conclusión:** no hay artefacto restaurable que permita recrear un Organigrama representativo en local sin fuente externa (p. ej. dump autorizado o Cloud no usable aquí).

---

## 9. Decisión final (Fase 2A.1 — solo entorno local)

### **C. BLOQUEADO_POR_FALTA_DE_BASELINE** *(respecto a validación local)*

Razones **locales**:

1. No hay PostgreSQL local ni Docker en este PC.
2. No hay bases locales `organigrama` / `core` / `mc1_local` activas.
3. No hay dump/backup restaurable en el workspace.
4. El `.env` apunta a Cloud SQL; la app corre contra ese remoto.
5. Crear `mc1_local` vacío con stubs queda explícitamente descartado.

### Actualización operativa (Fase 2A.2)

- No existe entorno local; el proyecto **utiliza Cloud SQL como entorno activo**.
- La validación local **no era requisito operativo** para esta funcionalidad una vez autorizado el destino Cloud.
- La migración `025` se aplicó de forma **controlada** en Cloud SQL (`CLOUD_ORGANIGRAMA_VALIDO`) tras la frase de autorización explícita del usuario.
- Detalle de aplicación y pruebas: [`person-profile-video-persistence.md`](./person-profile-video-persistence.md).

---

## 10. Acción recomendada siguiente (antes de Fase 2B)

~~1. Obtener baseline local…~~ *(superado para 025 por aplicación Cloud autorizada)*

**Siguiente:** iniciar **Fase 2B** (inventario Drive / parser diagnóstico) sin escribir en `person_video` hasta fases posteriores de sync.

---

## 11. Restricciones cumplidas

**Fase 2A.1 (este documento original):** solo lectura local; sin DDL; sin Cloud.

**Fase 2A.2 (posterior, documentada en persistencia):** aplicación controlada de `025` en Cloud tras autorización explícita; sin modificar `.env`, frontend, Drive, `person_cv` ni MC1; sin commit/push.
