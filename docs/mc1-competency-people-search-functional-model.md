# MC1 — Modelo funcional del buscador de personas por competencias

Estado: `IMPLEMENTED`  
Alcance: explorador transversal de personas sobre perfiles MC1 publicados  
Ruta de producto: `/org/competency-explorer`

## 1. Propósito y límites

El explorador permite encontrar personas por conocimiento publicado en MC1. La
consulta se construye progresivamente:

1. un dominio;
2. una especialidad contextual a ese dominio;
3. cero o más skills contextuales a la pareja dominio–especialidad.

No es un buscador de cargos, dependencias o posición organizacional. La primera
versión tampoco expone porcentaje de coincidencia, confianza, fuerza de
evidencia, radar, modo ANY/ALL ni ranking por job title u organización.

## 2. Fuente de verdad

La única fuente de perfiles de búsqueda es
`organigrama.mc1_person_profile_presentation`:

- `presentation.is_active = TRUE`;
- la persona asociada en `core.person` debe tener `is_active = TRUE`;
- `payload_json` debe pasar `validateMc1PresentationPayload`;
- no se ejecuta ni modifica el pipeline MC1;
- no se modifica Publication Gate;
- un payload inválido se omite defensivamente.

Los nombres canónicos de dominios y especialidades vienen de los catálogos
congelados MC1. La identidad de una skill es contextual y exacta:

`(domainCode, specialtyCode, skillCode)`.

El nombre de skill se toma de la presentación publicada. Si el mismo código
presenta drift de label, se elige determinísticamente el label más frecuente y,
en empate, orden de locale español.

## 3. Universo autorizado

Sea `P` el conjunto de personas activas con presentación MC1 activa y válida.
Para un viewer `v` y una versión del organigrama `o`, el universo autorizado es:

`U0(v,o) = P ∩ FULL_PROFILE_VISIBLE(v,o)`.

`FULL_PROFILE_VISIBLE` reutiliza `OrgChartVisibilityService`:

- `ORG_READ_ALL`: todas las personas activas;
- usuario normal: la propia persona más sus descendientes activos en la versión
  visual resuelta.

El orden de operación es obligatorio:

`AUTH → MATCH → FACETS/COUNTS → RESULTS`.

Ningún resultado, total, facet o validación dinámica de skills se calcula antes
de construir `U0`. Por tanto, los conteos no revelan perfiles fuera del alcance
de ficha completa.

## 4. Estado de consulta

```text
Q = {
  domainCode: string | null,
  specialtyCode: string | null,
  skillCodes: string[]
}
```

Invariantes:

- dominio: selección única con reemplazo;
- especialidad: selección única con reemplazo, solo bajo el dominio activo;
- skills: selección múltiple acumulativa;
- skills seleccionadas se combinan siempre con AND;
- retirar dominio retira especialidad y skills;
- retirar especialidad retira skills;
- retirar una skill conserva el resto;
- no existe selección implícita o de tipo `CONTEXT` en la consulta activa.

## 5. Matching

Un field publicado puede tener role `PRIMARY` o `SECONDARY`; ambos participan.
No se exige que el perfil tenga un field primario.

Para una persona `p ∈ U0`:

- con `D`: coincide si cualquier field utilizable tiene `field.code = D`;
- con `D + S`: además debe existir `S` dentro de ese mismo field `D`;
- con `D + S + {K1..Kn}`: una misma ocurrencia contextual `D/S` debe contener
  todas las skills `K1..Kn`.

Un skill con igual código bajo otra especialidad o dominio no satisface la
consulta. Una persona aparece una sola vez aunque tenga filas o bloques
duplicados. Si varios fields satisfacen la consulta, se usa `PRIMARY` antes que
`SECONDARY` para la explicación y el ranking.

Una consulta de dominio o especialidad de catálogo con cero coincidencias es
válida y devuelve HTTP 200 con `total = 0` y `people = []`.

## 6. Facets y conteos

Todos los conteos son `COUNT(DISTINCT personId)` lógico sobre personas
autorizadas y nunca incluyen opciones con conteo cero.

### Estado inicial

Sin dominio, `facets.domains` contiene solo dominios presentes en `U0`, con el
número de personas distintas. No se devuelven personas todavía.

### Dominio seleccionado

Con `D` y sin especialidad, `facets.specialties` contiene especialidades válidas
presentes dentro de fields `D` de personas coincidentes.

### Especialidad y skills

Con `D + S`, `facets.skills` contiene skills no seleccionadas que se pueden
agregar manteniendo al menos una coincidencia. Con skills ya seleccionadas, el
conteo de una opción `K` es el total prospectivo de personas que cumplen:

`D ∧ S ∧ K1 ∧ ... ∧ Kn ∧ K`.

Las skills ya seleccionadas no se repiten en facets.

Cuando un nivel ya está seleccionado, sus alternativas se ocultan. “Cambiar”
retira ese nivel y hace que el servidor vuelva a calcular sus opciones. Así no
se mezclan conteos de universos distintos.

## 7. Ranking determinista

Los resultados se ordenan por:

1. coincidencia de dominio `PRIMARY` antes de `SECONDARY`;
2. `displayName` con locale español y sensibilidad base;
3. `personId` como desempate estable.

No intervienen porcentajes, confianza, evidencia, cargo ni posición
organizacional.

## 8. Consulta inválida y canonicalización

El endpoint responde una `query` canónica y una lista estructurada de warnings.
El frontend reemplaza la URL si la consulta solicitada difiere de esa forma
canónica.

- dominio desconocido: se retira dominio y todos sus hijos;
- especialidad sin dominio: se retira;
- especialidad desconocida o fuera del dominio: se retira junto con skills;
- skills sin especialidad: se retiran;
- skill inexistente en el contexto autorizado `D/S`: se retira individualmente;
- skills duplicadas: se deduplican conservando orden.

La validación contextual de skills usa `U0`; no revela si una skill existe en
perfiles no autorizados. Esta canonicalización permite que bookmarks antiguos,
refresh y navegación back/forward no dejen la pantalla en un estado imposible.

## 9. Contrato HTTP

```http
GET /api/org-chart/competency-people-search
    ?domain=SOFTWARE_ENGINEERING
    &specialty=FRONTEND_ENGINEERING
    &skills=typescript,react
    &page=1
    &pageSize=24
    &versionId=8
```

`versionId` sigue las mismas reglas de resolución y autorización que el resto
del organigrama. `pageSize` tiene máximo 50.

La respuesta contiene:

- `query`: consulta canónica;
- `selectedCriteria`: labels determinísticos para los chips activos;
- `warnings`: correcciones explícitas de parámetros;
- `authorizedUniverseTotal`;
- `total` de personas coincidentes;
- `people`: página de resultados;
- `facets`: dominios, especialidades o skills correspondientes al paso actual;
- `pagination`.

Cada persona expone como mínimo `personId`, `displayName`, `photoUrl`,
`jobTitle`, `domainMatchRole`, dominio/especialidad/skills coincidentes y una
explicación estructurada determinística.

## 10. Casos defensivos

- perfil publicado sin field primario: participa por secundarios;
- dominio sin especialidades: sigue siendo consultable;
- especialidad sin skills: sigue siendo consultable;
- fields o especialidades huérfanas respecto al catálogo: se ignoran;
- filas o bloques duplicados: una sola persona y un solo incremento por facet;
- drift de labels de skill: resolución estable;
- error de red/servidor: estado visible con reintento;
- resultado cero válido: estado vacío con acción para retirar el último criterio;
- apertura de perfil: usa `PersonDetailPanel`, cuya llamada de detalle vuelve a
  aplicar la autorización de ficha completa.

