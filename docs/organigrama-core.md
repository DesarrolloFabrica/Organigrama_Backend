# Organigrama OP y Core

## Objetivo

Organigrama OP visualiza la jerarquía real de Dirección de Operaciones.

Core sigue siendo la fuente de verdad para:
- personas
- roles
- áreas
- escuelas
- programas
- sedes
- datos laborales

## Separación de responsabilidades

### Schema `core`

Contiene los datos maestros.

Ejemplos:

- `core.person`
- `core.role`
- `core.area`
- `core.school`
- `core.program`

### Schema `organigrama`

Contiene la configuración visual propia del organigrama.

Tabla principal:

- `organigrama.org_visual_relation`

Esta tabla define relaciones visuales padre → hijo.

## Tabla `org_visual_relation`

Campos principales:

- `parent_person_id`
- `child_person_id`
- `relation_type`
- `visual_level`
- `is_active`

Ejemplo:

```text
Iron → Raúl
Raúl → Haider
Haider → Johan
Johan → equipo directo

Regla importante

core.hierarchy.level NO define la jerarquía visual real.

Ese campo puede estar relacionado con permisos o clasificación interna.

La jerarquía visual real se define en:

organigrama.org_visual_relation
Motor del árbol

El árbol se construye en:

src/org-chart/org-chart-tree.engine.ts

Prioridad:

Buscar hijos en organigrama.org_visual_relation
Si no hay relaciones, usar org-chart.visual-map.ts como fallback
Archivos clave
src/org-chart/org-chart.service.ts
src/org-chart/org-chart-tree.engine.ts
src/org-chart/org-chart.visual-map.ts
src/org-chart/org-chart-person.query.ts
src/org-chart/org-visual-relation.query.ts
src/org-chart/entities/org-visual-relation.entity.ts
Endpoints recomendados (carga progresiva)

- Carga inicial: `GET /api/org-chart/root`
- Nodo específico (exploración): `GET /api/org-chart/node/:id`
- Expansión lazy (hijos directos): `GET /api/org-chart/children/:id`
- Ficha de persona: `GET /api/org-chart/person/:id`
- Resumen jerárquico: `GET /api/org-chart/summary/:personId`
- Búsqueda: `GET /api/org-chart/search?q=`

Endpoints legacy (deprecados)

- `GET /api/org-chart` — árbol completo con `children` anidados (recursión sin límite).
- `GET /api/org-chart/team/:id` — subárbol completo bajo la persona.

No deben usarse en nuevos clientes ni en el frontend principal. El frontend activo (`Organigrama_Frontend`) **no** llama a estos endpoints en rutas montadas; usa `/api/org-chart/root`, `/node/:id` y `/children/:id`.

### Producción: desactivar endpoints legacy

En **Cloud Run** (y cualquier entorno productivo) configurar:

```env
ORG_CHART_LEGACY_ENABLED=false
```

Comportamiento con `false`:

| Ruta | HTTP | Cuerpo |
|------|------|--------|
| `GET /api/org-chart` | **410 Gone** | Mensaje: usar `/api/org-chart/root`, `/node/:id`, `/children/:id` |
| `GET /api/org-chart/team/:id` | **410 Gone** | Igual |

Siguen protegidos por JWT (no son públicos sin sesión): sin token → **401**; con token y legacy desactivado → **410**.

**Verificación post-deploy (Cloud Run):**

```bash
# Sustituir URL del servicio y un JWT válido
API="https://TU-SERVICIO-REGION.run.app"
TOKEN="eyJ..."

curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$API/api/org-chart"
# Esperado: 410

curl -s -H "Authorization: Bearer $TOKEN" "$API/api/org-chart"
# Esperado: JSON con "message" indicando endpoints de reemplazo

curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$API/api/org-chart/team/1144"
# Esperado: 410
```

**Confirmar variable en Cloud Run:**

```bash
gcloud run services describe NOMBRE_SERVICIO \
  --region=REGION \
  --format="yaml(spec.template.spec.containers[0].env)" \
  | grep -A1 ORG_CHART_LEGACY_ENABLED
```

Debe aparecer `value: 'false'`. Si se usa Secret Manager o archivo de entorno del servicio, revisar la revisión desplegada activa en la consola: Cloud Run → Servicio → Revisión → Variables de entorno.

Referencia local: `Organigrama_Backend/.env.example` trae `ORG_CHART_LEGACY_ENABLED=false` como valor recomendado.

## Visibilidad jerárquica de información (ficha y API)

Regla aplicada en backend (`OrgChartVisibilityService` + redacción en respuestas HTTP). La jerarquía válida es la del grafo **`organigrama.org_visual_relation`** (no `core.hierarchy.level`).

### Quién ve ficha completa

| Relación del usuario autenticado (viewer) con la persona consultada (target) | `canViewFullProfile` | Datos en API |
|-------------------------------------------------------------------------------|----------------------|--------------|
| **Self** — el viewer es la misma persona | `true` | Ficha completa (`profile` con documento, teléfono, correo personal, emergencia, ubicación, etc.) |
| **Descendiente** — target está en el subárbol visual bajo el viewer (hijos, nietos, toda la cadena hacia abajo) | `true` | Igual |
| **Jefe / ancestro** — target está por encima en la cadena visual | `false` | Vista pública mínima |
| **Par u otra rama** — sin relación ascendente/descendente en `org_visual_relation` | `false` | Vista pública mínima |

En términos operativos: un colaborador ve ficha completa de **sí mismo** y de **todo su equipo hacia abajo**; hacia **jefes, pares y otras áreas** solo información pública mínima.

### Vista pública mínima (sin ficha completa)

Expuesta en `GET /api/org-chart/person/:id` cuando `canViewFullProfile: false`:

- `id`, `name`, `institutionalEmail` (`edu_email` en Core)
- `photoUrl` institucional (si existe y el proxy de fotos la resuelve)
- `canViewFullProfile: false`
- `profile: null` (sin documento, teléfono, correo personal, dirección, emergencia, etc.)

El **mapa** (`/root`, `/node/:id`, `/children/:id`) sigue mostrando nodos para navegar; cada nodo se **redacta** por viewer (sin exponer PII extendida en JSON de nodos ajenos).

**Búsqueda** (`/search`): puede encontrar personas fuera de la rama; los hits sin permiso llegan sin documento, teléfono, correo personal ni rol/ruta.

**Resúmenes** (`/summary/:personId`, `/summary/general-areas`): nombres y métricas de conteo; `roleName` solo si el viewer tiene permiso de ficha completa sobre esa persona.

Archivos: `src/org-chart/org-chart-visibility.service.ts`, `org-chart-visibility.mapper.ts`, integración en `org-chart.service.ts`.

Estado actual probado

Árbol validado:

Iron
└── Raúl
    └── Haider
        └── Johan
            ├── Camilo
            ├── Zuany
            ├── José
            └── Alejandro
Comandos de prueba (flujo progresivo)

```powershell
$root = Invoke-RestMethod -Uri "http://localhost:3000/api/org-chart/root"
$root.id
$root.children.Count
$childId = $root.children[0].id
$children = Invoke-RestMethod -Uri "http://localhost:3000/api/org-chart/children/$childId"
$children.Count
```

Legacy (solo si `ORG_CHART_LEGACY_ENABLED` no es `false`):

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/org-chart"
```

## Vacantes (plazas disponibles)

### Modelo de datos

- **No** existe un `NIVEL 6` ni una fila `VACANTE` en `core.hierarchy`.
- Una vacante es un **placeholder** en `core.person` con rol dedicado en `core.role` (p. ej. `VACANTE`, `PLAZA DISPONIBLE`, `PLAZA VACANTE`).
- `hierarchy_id` de la persona placeholder debe ser el **nivel real del puesto** (`NIVEL 2` … `NIVEL 5`).
- El enlace en el árbol se define en `organigrama.org_visual_relation` (padre operativo → placeholder).

### Contrato API

Los nodos del organigrama (`GET /api/org-chart/root`, `/node/:id`, `/children/:id`) exponen:

- `nodeKind: "person"` — colaborador real (valor por defecto implícito cuando no es vacante).
- `nodeKind: "vacancy"` — placeholder detectado por nombre de rol (comparación case-insensitive).

La diferencia funcional y visual en el cliente se resuelve con `nodeKind`, no con un nivel jerárquico extra.

- Las vacantes **no** reciben `photoUrl` institucional (`null`).
- `GET /api/org-chart/search?q=` **incluye** vacantes y las marca con `nodeKind: "vacancy"`.
- Resúmenes (`/summary/:personId`, `/summary/general-areas`): `vacancies` cuenta placeholders en el subárbol; `totalPeople` sigue incluyendo vacantes y personas reales (mismo criterio que el conteo de descendientes).

### Detección en backend

- `src/org-chart/org-chart-vacancy.ts` — nombres de rol aceptados y helper `isVacancyRoleName`.
- `src/org-chart/org-chart.service.ts` — `buildOrgNode`, conteos y búsqueda.

### Presentación en mapa (Fase 2 frontend)

- Tema `ORG_MAP_VACANCY_THEME` en `orgMapLevelTheme.ts` (slate/gris; no altera L1–L5).
- `resolveOrgMapTheme()` aplica tema vacancy cuando `nodeKind === "vacancy"`.
- Nodos: clase `.org-map-holo--vacancy`, estado **VACANTE**, glifo genérico sin foto.
- Aristas hacia un nodo vacante usan el mismo stroke sobrio del tema vacancy.

### Ficha, resúmenes y búsqueda (Fase 3)

- `GET /api/org-chart/person/:id` incluye `nodeKind` y `photoUrl: null` en vacantes.
- `direct_reports_count` en ficha = hijos directos activos en `org_visual_relation` (para condicionar acciones).
- **Ficha lateral:** estado Vacante, glifo, texto “Plaza disponible dentro de la estructura operativa”; sin copy de “entidad activa”.
- **Resúmenes UI:** etiquetas “personas y plazas” / “vacantes”; resaltado sobrio si `vacancies > 0` (el cálculo no cambia).
- **Búsqueda:** `OrgChartSearchPanel` — incluye vacantes, badge Vacante, sin foto; abre ficha al seleccionar.
- **Acciones en mapa:**
  - **Detalle:** siempre disponible (abre ficha).
  - **Explorar estructura:** oculto para `nodeKind === "vacancy"`; en personas reales solo si hay `deferred_team` y reportes.
  - **Expandir:** solo si hay reportes directos (`direct_reports_count` / hijos en árbol).

### Modelo final (resumen)

| Concepto | Qué es |
|----------|--------|
| **NIVEL 6** | No existe. La vacante usa `hierarchy_id` del puesto (NIVEL 2–5). |
| **Placeholder** | Fila en `core.person` con rol vacante. |
| **Diferenciador API/UI** | `nodeKind: "vacancy"` (no un nivel jerárquico nuevo). |
| **Color en mapa** | Tema `vacancy` (slate), independiente de L1–L5. |

### Fase 4 — Validación y UX

- **Búsqueda móvil en `/org`:** segunda fila bajo el header (`sm:hidden`), misma `OrgChartSearchPanel` que desktop (`inputId` distinto).
- **Tests unitarios:** `org-chart-vacancy.spec.ts` — `resolveOrgNodeKindFromRoleName`, `photoUrlForOrgNodeKind`, roles aceptados.
- **E2E / resúmenes con BD:** no se automatiza conteo `vacancies` (depende de PostgreSQL y datos reales); ver smoke manual abajo.
- **Accesibilidad:** `aria-label` en nodos vacantes, botones de detalle/búsqueda; glifo decorativo cuando el padre ya etiqueta.

### SQL mínimo — vacante de prueba

Ajustar `:parent_person_id` (jefe en el árbol OP) y `:hierarchy_id` (2–5 según el puesto).

```sql
-- 1) Rol
INSERT INTO core.role (id, name, description, is_active)
SELECT COALESCE(MAX(id::bigint), 0) + 1, 'VACANTE', 'Plaza disponible OP', true
FROM core.role;

-- Anotar el id generado como :role_vacante_id

-- 2) Persona placeholder
INSERT INTO core.person (document, full_name, is_active, role_id, hierarchy_id)
VALUES (
  'VAC-OP-TEST-001',
  'Vacante — prueba OP',
  true,
  :role_vacante_id,
  2
)
RETURNING id;  -- :vacancy_person_id

-- 3) Arista visual
INSERT INTO organigrama.org_visual_relation (
  parent_person_id, child_person_id, relation_type, visual_level, is_active
)
VALUES (
  :parent_person_id,
  :vacancy_person_id,
  'DIRECT_REPORT',
  2,
  true
);
```

### Smoke test manual recomendado

1. Ejecutar el SQL anterior en la BD configurada en `.env` del backend.
2. `npm run start:dev` en `Organigrama_Backend` y `Organigrama_Frontend`.
3. **API búsqueda:** `GET /api/org-chart/search?q=VAC` → al menos un hit con `nodeKind: "vacancy"`.
4. **API ficha:** `GET /api/org-chart/person/:vacancy_person_id` → `nodeKind: "vacancy"`, `photoUrl: null`.
5. **API resumen:** `GET /api/org-chart/summary/:parent_person_id` → `vacancies` ≥ 1 en `general` o en el área hija correspondiente.
6. **Mapa `/org`:** nodo con borde punteado, estado **VACANTE**, sin foto; arista slate hacia el nodo.
7. **Ficha lateral:** badge Vacante, texto de plaza disponible; sin “Entidad activa”.
8. **Búsqueda UI:** badge Vacante en desktop y en la fila móvil bajo el header.
9. **Acciones:** “Explorar estructura” no visible en la vacante; “Detalle” sí abre la ficha.

### Tests automatizados

```powershell
cd Organigrama_Backend
npm test -- --testPathPatterns=org-chart-vacancy
npm run build
cd ..\Organigrama_Frontend
npm run build
```
