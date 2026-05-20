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
Endpoints principales
GET /api/org-chart
GET /api/org-chart/team/:id
GET /api/org-chart/person/:id
GET /api/org-chart/search?q=
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
Comandos de prueba
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/org-chart"
$response.direct_reports_count
$response.children[0].direct_reports_count
$response.children[0].children[0].direct_reports_count
$response.children[0].children[0].children[0].direct_reports_count

Resultado esperado:

1
1
1
4
