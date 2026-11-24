# Excel del organigrama: pestañas por Dirección y coordinación

Implementación: `src/org-chart/org-chart-directory-coordinations.ts` (reglas
comentadas en el código). Este documento resume las decisiones aprobadas y los
hallazgos pendientes de revisión.

## Estructura del archivo

1. **Base general**: el directorio completo (26 columnas, mismos registros,
   orden y presentación que el Excel aprobado; solo cambió el nombre de la hoja).
2. **Dirección**: la región de Dirección (raíz del mapa y quienes comparten su
   área), con el nombre de esa área.
3. **Una pestaña por coordinación**, en orden alfabético.

Las pestañas 2 y 3 se calculan en cada descarga desde la jerarquía efectiva de
la versión activa (Planta de Orbit, excepciones y overlays incluidos), en la
misma lectura consistente que la Base general. No hay una lista fija.

Estado verificado el 24-nov-2026 (versión 4, solo lectura):

| Pestaña | Personas |
|---|---|
| Base general | 196 |
| DIRECCION GENERAL OPERACIONES (área «DIRECCION GENERAL DE OPERACIONES», 32 caracteres) | 6 |
| B2B | 5 |
| ESPECIALIZACIONES | 13 |
| FABRICA Y DESARROLLO | 41 |
| HOMOLOGACIONES | 14 |
| OPERACION ACADEMICA | 63 |
| PRACTICAS | 31 |
| PROYECCION SOCIAL | 12 |
| SABER PRO | 11 |

## Reglas

- **Cabeza de coordinación**: persona que cuelga de la Dirección y tiene un
  área distinta de la de la Dirección. Su pestaña incluye todo su subárbol.
- **Manda la jerarquía**: cada persona sale en la pestaña de su jefe efectivo
  en el mapa, aunque su área registrada sea otra (la columna «Área» muestra la
  registrada). No se reclasifica a nadie por su área.
- **Orden**: responsable, luego su staff directo (sin equipo) y después cada
  líder seguido de su equipo. Las escuelas de Operación Académica quedan como
  bloques contiguos dentro de esa pestaña.
- **Duplicados**: nunca dentro de una pestaña; una persona con jefes en dos
  coordinaciones sale en ambas pestañas y una sola vez en la Base general.
- **Exclusiones**: las mismas de la Base general (docentes de planta y
  vacantes); se atraviesa a los docentes intermedios para no perder a sus
  subordinados elegibles.
- **Sin pestaña**: quien no cuelga de la raíz del mapa (p. ej. bajo un jefe
  inactivo) solo figura en la Base general.
- **Nombres de hoja**: sin `\ / ? * : [ ]`, máximo 31 caracteres (primero se
  omiten artículos y preposiciones), únicos; el nombre completo va en la fila 1.
- **Limitación conocida**: una cabeza registrada con el área de la Dirección no
  genera pestaña propia (queda dentro de la Dirección).

Cada descarga registra en el log del backend, solo con conteos:
`pestañas direccion=… coordinaciones=… sinPestana=… areaDistinta=…`.

## Inconsistencia pendiente de revisión (no corregida)

Una persona con cargo **AUXILIAR CONSULTORIO JURIDICO** y área registrada
**PROYECCION SOCIAL** tiene como jefe efectivo en el mapa al
**COORDINADOR ESCUELA TRANSFORMACIÓN NEGOCIOS** (Operación Académica).

- En el Excel sale en **OPERACION ACADEMICA** (jefe efectivo), no en
  PROYECCION SOCIAL (12 personas en lugar de 13 con esa área). Decisión
  aprobada: conservar la clasificación por jefe efectivo y no modificar datos.
- Revisar en el origen (Orbit / Organigrama) cuál de los dos datos es correcto:
  el área registrada o la dependencia jerárquica.
- El log lo refleja como `areaDistinta=1`.

Consulta de solo lectura para ubicarla:

```sql
SELECT p.id, ro.name AS cargo, a.name AS area
  FROM core.person p
  JOIN core.role ro ON ro.id = p.role_id
  LEFT JOIN core.area a ON a.id = p.area_id
 WHERE p.is_active AND ro.name ILIKE '%CONSULTORIO JURIDICO%';
```
