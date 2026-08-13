# MC1 — Implementación del buscador de personas por competencias

Estado: `IMPLEMENTED_AND_VALIDATED`  
Fecha de cierre técnico: 2026-08-12

## 1. Componentes implementados

### Backend

- `src/org-chart/competency-people-search.service.ts`
  - construye el universo FULL-PROFILE-ONLY;
  - hace una lectura agregada del store de presentación y metadatos de persona;
  - valida payloads con el reader MC1 existente;
  - canonicaliza la consulta;
  - filtra, cuenta facets, deduplica, ordena y pagina en backend;
  - construye foto mediante `PhotoUrlBuilder`, sin I/O por persona.
- `src/org-chart/dto/competency-people-search.response.dto.ts`
  - contrato público tipado y sin internals del pipeline.
- `src/org-chart/org-chart.controller.ts`
  - endpoint GET `competency-people-search`.
- `src/org-chart/org-chart.module.ts`
  - registro del servicio dentro del módulo existente.

No se añadió tabla, migración, índice GIN ni materialización: el universo actual
es pequeño (auditoría: 128 perfiles activos) y la implementación usa una sola
consulta SQL más procesamiento en memoria acotado. Se debe medir en producción
antes de introducir persistencia derivada.

### Frontend

- La ruta existente `/org/competency-explorer` fue adaptada; no se creó una
  segunda página.
- `api/competencyPeopleSearchApi.ts` consume el endpoint real con JWT y
  `AbortSignal`.
- `hooks/useCompetencyPeopleSearch.ts` usa React Query, clave por versión y
  consulta completa.
- `utils/competencyPeopleSearchState.ts` implementa jerarquía de criterios,
  hidratación y escritura URL, canonicalización y ampliación de consulta.
- `ActiveQueryBar` muestra únicamente criterios explícitos del usuario.
- `QueryBuilderPanel` aplica el flujo progresivo con facets del servidor.
- `CompetencyPeopleResults` cubre inicial, loading, error, vacío, resultados y
  paginación.
- `CompetencyPersonCard` muestra identidad, cargo, role del dominio, razón y
  skills coincidentes, sin score o evidencia ficticia.
- La tarjeta abre el `PersonDetailPanel` existente.
- `OrgChartHeader` incluye un acceso visible “Competencias”.

Los mocks y utilidades antiguas permanecen aislados para compatibilidad de sus
pruebas históricas, pero la ruta productiva no los importa ni los ejecuta.

## 2. Seguridad

Para usuarios sin `ORG_READ_ALL`, el servicio obtiene descendientes visibles con
`OrgChartVisibilityService`, agrega el propio `personId` y recién entonces
consulta las presentaciones restringiendo `p.id` a ese conjunto. Para usuarios
con `ORG_READ_ALL`, usa la rama global ya reconocida por el sistema.

La única consulta SQL exige simultáneamente:

- presentación activa;
- persona activa;
- pertenencia al universo autorizado, salvo acceso global.

Facets, totales, matching, labels dinámicos y resultados se derivan de las filas
ya autorizadas. La apertura del detalle vuelve a pasar por la autorización del
endpoint de ficha existente.

## 3. Rendimiento

- una query SQL fija por búsqueda;
- sin lectura por persona y sin patrón N+1;
- foto calculada sin I/O mediante el builder existente;
- deduplicación defensiva por `personId`;
- filtro y ranking en backend;
- máximo de página: 50;
- cancelación de requests obsoletos desde React Query;
- cache key incluye versión, dominio, especialidad, skills y página.

## 4. Validación automatizada

### Backend

```powershell
npm test -- --runInBand --testPathPatterns=competency-people-search.service.spec.ts
npm run build
```

Cobertura nueva: 23 casos. Incluye autorización antes de lectura, self y
descendientes, acceso global, fuente activa, payload inválido, PRIMARY y
SECONDARY, perfil sin primaria, ranking estable, contexto de especialidad,
skills AND, identidad contextual, cero válido, conteos prospectivos, dedupe,
dominio/especialidad sin hijos, drift, canonicalización, datos de tarjeta,
ausencia de scores, paginación y ausencia de N+1.

La suite backend completa confirma 93 suites y 1.011 tests verdes, pero conserva
4 suites fallidas ajenas al buscador: dos fixtures locales ausentes/variables de
preview y expectativas históricas de catálogos/fingerprints que ya difieren en
el worktree MC1 preexistente. La suite dirigida del buscador queda 23/23 verde.

### Frontend

```powershell
npm test
npm run build
npx eslint <archivos modificados del Explorer>
```

Cobertura nueva: 26 casos del flujo productivo. Incluye estado inicial,
selecciones y reemplazos, cascada al retirar padres, skills multi-add, chips,
URL refresh/back/forward, criterios stale, claves distintas ante cambios
rápidos, estados loading/error/cero/resultados, endpoint estructurado,
presentación de tarjeta, apertura de perfil, ActiveQueryBar y ausencia de
ANY/ALL.

El lint dirigido de todos los archivos modificados queda limpio. El comando
global `npm run lint` conserva fallos preexistentes fuera de este cambio (entre
otros, e2e no usados y reglas React nuevas en componentes históricos); no se
alteraron esos módulos ajenos al alcance.

## 5. Validación read-only de datos reales

Se repitió una comprobación agregada contra Cloud dentro de `BEGIN TRANSACTION
READ ONLY`, seguida de `ROLLBACK`, sin exponer PII:

- 128 presentaciones activas asociadas a personas activas;
- 13 dominios presentes;
- 45 especialidades presentes;
- 484 códigos de skill presentes;
- ejemplo anónimo monotónico:
  `SOFTWARE_ENGINEERING (6) → FRONTEND_ENGINEERING (6) →
  frontend_web_development (4) →
  responsive_web_design_and_accessibility (1)`.

Los números son el universo global del corte con acceso técnico; el endpoint
recalcula cada uno sobre el `U0` particular del viewer.

## 6. Validación manual sugerida

1. Ingresar con un usuario normal y comparar los conteos con su propia ficha más
   descendientes visibles.
2. Ingresar con `ORG_READ_ALL` y verificar el universo completo.
3. Abrir la ruta sin parámetros y elegir un dominio presente.
4. Elegir especialidad y agregar dos skills; confirmar semántica AND.
5. Retirar especialidad y comprobar que desaparezcan todas las skills.
6. Recargar un deep link y usar back/forward.
7. Probar un parámetro obsoleto y confirmar que la URL se limpie sin pantalla de
   error.
8. Abrir una tarjeta y verificar que carga la ficha existente.
9. Confirmar un caso PRIMARY y otro SECONDARY.
10. Confirmar una combinación válida con cero resultados y ampliar la búsqueda.

## 7. Operación y rollback

No se realizó deploy ni escritura de datos productivos. No hay migraciones ni
backfill asociados. El rollback funcional consiste en retirar el endpoint, el
provider del módulo, el cliente/hook/componentes nuevos y restaurar la página
anterior; ningún dato MC1 requiere reversión.
