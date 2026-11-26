# QA: requisiciones de Orbit por coordinación

Prueba el alcance de `GET /api/org-chart/vacancies?personId=` y del bloque
«Requisiciones de Orbit» del panel de resumen, con datos 100 % sintéticos.

## Requisitos

La base QA desechable del kit [`../directory-export`](../directory-export/README.md),
con `00`, `01` y `07` aplicados (raíz 1144, Dirección y coordinaciones). No
usar la base de producción: el seed se niega a correr si la base no está
marcada como QA o si `core.person` contiene personas no sintéticas.

```bash
docker cp test/qa/vacancies/08_requisiciones_sinteticas.sql <contenedor-qa>:/tmp/08.sql
docker exec <contenedor-qa> psql -U qa -d organigrama_qa -v ON_ERROR_STOP=1 -f /tmp/08.sql
```

## Resultado esperado

Filtro `requisition_sent`. «X requisiciones · Y plazas» = filas y suma de
`quantity`. El seed respeta el esquema real de `vacancies.vacancy`
(`area_id` y `quantity` NOT NULL, `quantity > 0`); el tratamiento de una
cantidad nula (suma 0) solo lo cubren las pruebas unitarias.

| Nodo | Alcance | Panel |
|---|---|---|
| Raíz 1144 | `global` | 9 requisiciones · 15 plazas |
| 900155 ESPECIALIZACIONES | `coordination` (área 9005) | 2 · 4 (incluye un programa sin persona y `quantity = 3`) |
| 900165 OPERACION ACADEMICA | `coordination` (área 9010) | 3 · 3 |
| 900184 SABER PRO | `coordination` (área 9007) | 0 · 0 |
| 900101 OPERACIONES QA | `coordination` (área 9002) | 0 · 0 (9908 trae su escuela y programa, pero el área de la Dirección) |
| 900100 Directora (staff de Dirección) | `none` | bloque omitido |
| 900166 / 900156 (bajo una coordinación) | `none` | bloque omitido |
| `abc`, vacío, `20::77` | — | 400 |
| 900107 (inactiva), 99999999 | — | 404 |

Las filas 9905–9908 (área sin personas, área de la Dirección, área sin cabeza
y escuela de otra área con área de la Dirección) solo cuentan en la raíz. La 9903 (`open`) no aparece en
ninguna vista. El placeholder 900190 (`VAC-…`) es una vacante DEL ÁRBOL: debe
seguir sumando «1 vac.» en Equipo directo de 900165 (fila 900166).
