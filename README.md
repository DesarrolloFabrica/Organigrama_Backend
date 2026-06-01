# Organigrama Backend

API para **Organigrama OP**: visualización del organigrama de la Dirección de Operaciones. Expone lectura del árbol desde **PostgreSQL** (entidad `employees`), health check y CORS para el frontend en desarrollo. Sin autenticación ni endpoints de escritura en esta fase.

## Requisitos

- Node.js LTS
- npm
- PostgreSQL 16+ (local o contenedor)

## Configuración

1. Copiar variables de ejemplo: `cp .env.example .env` (en Windows, copiar el archivo manualmente).
2. Ajustar credenciales si tu instancia difiere.
3. (Opcional) Levantar PostgreSQL con Docker en este directorio: `docker compose up -d`
4. Con `DB_SYNCHRONIZE=true`, al arrancar la app TypeORM crea/actualiza la tabla `employees` según la entidad (solo desarrollo; en producción usar migraciones y `false`).
5. Cargar datos demo: `npm run seed` — el seed es **idempotente**: si ya hay filas en `employees`, no inserta nada.

## Instalación

```bash
npm install
```

## Comandos

| Comando             | Descripción                                           |
| ------------------- | ----------------------------------------------------- |
| `npm run start:dev` | Servidor en desarrollo (watch), puerto **3000**       |
| `npm run build`     | Compila a `dist/`                                     |
| `npm run start:prod`| Ejecuta la build (`node dist/main`)                   |
| `npm run seed`      | Compila e inserta datos demo si la tabla está vacía   |
| `npm run test`      | Tests unitarios                                       |
| `npm run test:e2e`  | Tests e2e (requieren PostgreSQL según `.env`)         |

## Modelo principal (`employees`)

| Campo | Descripción breve |
| ----- | ----------------- |
| `id` | UUID |
| `documentNumber` | Documento / identificador interno |
| `fullName` | Nombre completo (se expone como `name` en el árbol) |
| `roleName` | Rol / cargo (`role` en el JSON del organigrama) |
| `level` | Nivel jerárquico numérico |
| `areaId` / `areaName` | Área (solo `areaName` sale en el árbol) |
| `schoolId` / `schoolName` | Sede (opcional) |
| `programId` / `programName` | Programa (opcional) |
| `managerId` | UUID del jefe; `null` = raíz |
| `status` | `active` \| `inactive` (solo `active` en el árbol) |
| `contractType` | Tipo de contrato (opcional) |
| `startDate` | Fecha de inicio (opcional) |
| `createdAt` / `updatedAt` | Auditoría básica |

## Endpoints

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/health` | Estado del servicio (`ok`, `app`, `status`). |
| GET | `/api/org-chart/root` | **Recomendado** — Raíz del organigrama con solo hijos directos (carga inicial). |
| GET | `/api/org-chart/node/:id` | **Recomendado** — Persona como raíz del lienzo + hijos directos. |
| GET | `/api/org-chart/children/:id` | **Recomendado** — Solo hijos directos de una persona (expansión lazy). |
| GET | `/api/org-chart/person/:id` | Detalle ampliado de una persona. |
| GET | `/api/org-chart/summary/:personId` | Resumen jerárquico (totales, sin árbol JSON). |
| GET | `/api/org-chart/search?q=` | Búsqueda de personas (hasta 20 resultados). |
| GET | `/api/org-chart` | **Deprecated (legacy)** — Árbol completo con `children` anidados en todos los niveles. No usar en frontend principal. |
| GET | `/api/org-chart/team/:id` | **Deprecated (legacy)** — Subárbol completo bajo la persona. Preferir `/node/:id` + `/children/:id`. |

Flujo recomendado para la UI: carga inicial con `/root` o `/node/:id`, y expansión del mapa con `/children/:id` bajo demanda.

Variable `ORG_CHART_LEGACY_ENABLED` (por defecto `true`): en Cloud Run, poner `false` para bloquear los endpoints legacy con **410 Gone** cuando ya no haya consumidores.

## CORS

Origen permitido en desarrollo: `http://localhost:5173`.
