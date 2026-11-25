> **Documento de diseño de la Etapa 2** (colores y espaciado), incluido en el commit `6736e60` y desplegado. La Etapa 2.1 (menú LED y vista jerárquica) está descrita en `docs/rediseno-html/README.md`. Las vistas previas y capturas que se mencionan abajo no se versionan: se regeneran con `scripts/vista-previa-html-sintetica.cjs`.

# Rediseño HTML · Etapa 2: colores por coordinación y espaciado

Vistas previas con datos sintéticos: `anterior-etapa1.html` y `nuevo-etapa2.html`.

## 1. Colores asignados

### Cómo se obtuvo cada color

- **Color oficial.** Se midió en el PNG oficial de cada icono, a 300 px, sobre los píxeles opacos y saturados. Es el color mediano del icono (percentil 50 de luminosidad).
- **Secundario.** Es el extremo claro del degradado (percentil 90). Solo cuenta cuando su tono se aleja ≥ 8° del principal. Únicamente Prácticas y Proyección Social lo tienen; las demás coordinaciones usan su principal.
- **Variantes de uso.** Se calculan a partir del color oficial con el mismo tono y la misma saturación; solo se aumenta la luminosidad hasta alcanzar el contraste WCAG frente a la superficie de las tarjetas (`#0f172a`). Si el color oficial ya cumple, se usa sin cambios.
  - **Acento:** bordes, líneas, radar y menú. Contraste ≥ 4,5:1.
  - **Texto:** contadores, etiquetas e insignias. Contraste ≥ 7:1.

### Tabla de colores

| Coordinación | Icono | Oficial (icono) | Acento | Texto | Secundario | Justificación |
|---|---|---|---|---|---|---|
| Dirección General de Operaciones | DirectorOp.png | `#003a1e` | `#00944c` (4,54:1) | `#00bb60` (7,04:1) | — | Dragón de un solo color, verde bosque. Es muy oscuro para el fondo; se aclara manteniendo el tono. |
| B2B | B2B.png | `#aa0919` | `#f42d40` (4,50:1) | `#f87c89` (7,00:1) | — | Ave de un solo color, rojo carmesí. |
| Especializaciones | Especializaciones.png | `#950300` | `#ff0a04` (4,50:1) | `#ff7976` (7,01:1) | — | Águila roja escarlata, con un degradado de luz del mismo tono. |
| Fábrica y Desarrollo | Fabrica.png | `#62c4b7` | `#62c4b7` (8,59:1) | `#62c4b7` | — | Foca verde azulada. Ya era legible, así que se usa sin modificar. |
| Homologaciones | Servicio.png | `#ca1a70` | `#e5398d` (4,51:1) | `#ee7db5` (7,00:1) | — | Flamenco magenta (el emblema aprobado para esta área). |
| Operación Académica | Operación Académica.png | `#353972` | `#767abf` (4,51:1) | `#9b9fd1` (7,03:1) | — | Lobo azul índigo. El mapa usa un celeste (`#60d2ff`) que no corresponde al icono; se respetó el icono. |
| Prácticas | Desarrollo profesional.png | `#b25397` | `#b962a0` (4,52:1) | `#cd8fbb` (7,01:1) | `#cf549a` | Mariposa orquídea con degradado hacia rosa (8,8° de diferencia de tono). |
| Proyección Social | proyección social.png | `#237f31` | `#289339` (4,53:1) | `#33ba48` (7,02:1) | `#399232` | Colibrí verde con degradado hacia verde hoja (13,5° de diferencia de tono). |
| Saber Pro | Saber Pro .png | `#88b624` | `#88b624` (7,45:1) | `#88b624` | — | Suricata verde lima. Ya era legible, así que se usa sin modificar. |

El muestrario visual está en `capturas/paleta-coordinaciones.png`. Ahí también aparece, como referencia, el color de halo que el mapa usa para cada emblema.

Fuera de una coordinación (vista general y áreas sin icono) se conservan el cian (`#22d3ee`) y el ámbar (`#f59e0b`) institucionales.

### Observaciones para decidir

- **B2B y Especializaciones** se ven casi iguales: sus dos iconos oficiales son rojos (354° frente a 1° de tono). El mapa también usa rojos casi idénticos para ambos (`#ef4444` y `#ff4c4c`).
- **Dirección y Proyección Social** son verdes de familia parecida (150° frente a 128°). Se distinguen porque Dirección es más saturado y Proyección Social más apagado.
- **Homologaciones y Prácticas** comparten la familia rosa-magenta (331° frente a 317°). Homologaciones es más intenso; Prácticas tira a orquídea.

Si se quiere separar más estos pares, habría que decidir un criterio adicional, por ejemplo usar el color secundario o un matiz institucional. Con los iconos actuales, ese criterio no sale de los datos.

## 2. Dónde se aplica el color

| Elemento | Antes (etapa 1) | Ahora (etapa 2) |
|---|---|---|
| Borde de la sección | cian 22 % | color de la coordinación (acento) al 32 % |
| Encabezado de coordinación | sin fondo | banda con borde izquierdo de 4 px en acento y un degradado tenue de acento a secundario |
| Etiqueta «Área · N personas» y subtítulos | cian | color de texto de la coordinación |
| Tarjetas | borde cian; líderes en ámbar | borde en acento al 38 %; responsables con el borde al 85 % y una barra lateral de 4 px |
| Fotografías e iniciales | aro cian o ámbar | aro en el acento; iniciales en el color de texto |
| Líneas jerárquicas | cian | color del responsable (nodo padre), con un trazo horizontal hacia cada hijo |
| Contadores (menú, equipos, resúmenes) | cian | color de texto de la coordinación |
| Menú lateral | todos los enlaces iguales | borde izquierdo de 3 px en el acento; contador en una píldora de su color; al pasar el puntero o enfocar, fondo tenue y contorno visible |
| Radar y marca de agua | cian | anillos en acento, halo en secundario e icono en el color de texto al 15 % |
| Vista jerárquica | todo cian/ámbar | cada nodo con el color de su coordinación; los nodos sin coordinación vuelven al neutro |

Las superficies siguen oscuras y neutras. Nombres y cargos siguen en blanco o gris claro, y no se pintó ninguna superficie completa con color intenso.

## 3. Espaciado

| Elemento | Antes | Ahora |
|---|---|---|
| Padding de la tarjeta | 8 px (mini 6×8) | 14×16 px (líder 16×18, mini 12×14) |
| Fotografía | 48 / 52 líder / 36 mini | 56 / 64 líder / 48 mini (52 líder mini) |
| Separación foto–texto | 8 px | 14 px (mini 12) |
| Interlineado nombre / cargo / cédula | 1,2, sin márgenes | 1,3–1,4 con 3–4 px entre líneas |
| Ancho mínimo de tarjeta en la cuadrícula | 180 px | 250 px (230 px por debajo de 1100 px; una columna en móvil) |
| Separación entre tarjetas | 8 px | 14 px |
| Padding de la sección | 16 px | 28×32 px (móvil 20×16) |
| Separación entre secciones | 28 px | 40 px |
| Encabezado → contenido | 0 / 12 px | 24 px |
| Subtítulo («Equipos por líder», «Colaboradores») | 16 / 10 px | 28 / 14 px |
| Separación entre equipos | 14 px | 22 px; equipo anidado a 18 px con padding de 18–22 px |
| Líneas jerárquicas | sangría de 12 + 10 px; 8 px entre nodos | sangría de 26 + 26 px; 16 px entre nodos; trazo de 18 px que no toca la tarjeta |
| Resúmenes «colaboradores a cargo» | padding 10×12, filas de 3 px | padding 14×18, filas de 6 px |
| Menú lateral | 270 px de ancho; enlaces de 8×9 px y 5 px entre ellos | 300 px de ancho; enlaces de 10×12 px y 8 px entre ellos |
| Ancho de la tarjeta de responsable | todo el ancho | máximo 800 px en la vista jerárquica y 640 px en equipos |
| Ancho del contenido | sin límite | máximo 1480 px |

No hay alturas fijas: los nombres y cargos largos crecen en altura y parten la línea (`overflow-wrap: anywhere`) en lugar de cortarse.

## 4. Tipografía

| Texto | Antes | Ahora |
|---|---|---|
| Título de coordinación (`h2`) | 22 px | 22–26 px (`clamp`) |
| Nombre de colaborador | 12 px (mini 11) | 16 px (mini 14) |
| Cargo | 10 px | 13 px |
| Cédula, área, información secundaria | 10 px | 12–13 px |
| Insignia (Coordinador, Líder…) | 9 px | 12 px, seminegrita |
| Etiqueta «Área · N personas» | 11 px | 12 px, seminegrita |
| Contadores (menú, equipos, resúmenes) | 11–12 px | 13–14 px; total del resumen en 20 px |
| Menú lateral | 12 px | 14 px; título del menú en 20 px |
| Texto base | navegador (16 px; tarjetas a 9–12 px) | 15 px, interlineado 1,45 |

Ningún texto queda por debajo de 12 px. Una prueba automática lo comprueba en el CSS y otra lo mide en el navegador en los cuatro anchos.

## 5. Responsividad

| Ancho | Comportamiento |
|---|---|
| ≥ 1100 px | Menú lateral fijo de 300 px; cuadrícula de tarjetas de 250 px como mínimo; contenido hasta 1480 px. |
| ≤ 1100 px | Menú de 260 px; tarjetas de 230 px como mínimo. |
| ≤ 900 px | Una sola columna: el menú pasa arriba y deja de ser fijo (como antes). |
| ≤ 600 px | Paddings menores, tarjetas a todo el ancho, fotos de 44–56 px y sangría jerárquica reducida. |

Se comprobó en 390, 768, 1024 y 1440 px: sin desbordamiento horizontal, sin texto recortado en las tarjetas y con nombres y cargos de prueba muy largos.

## 6. Verificación (`verificacion.json`)

- Sin los atributos `data-coord`, el cuerpo del documento es idéntico al de la etapa 1. Sin `data-coord` ni `data-emblem`, es idéntico al de producción (c5f2a0f). Se comprobó con datos sintéticos y, en memoria y en solo lectura, con los datos reales (196 personas, 210 tarjetas).
- Las 215 tarjetas sintéticas aparecen con los mismos nombres y en el mismo orden, y todas son visibles.
- Los colores medidos en el navegador (encabezado, etiqueta, tarjeta, menú, contador y nodos de la vista jerárquica) coinciden con la tabla en las 9 coordinaciones.
- Las marcas de agua quedan detrás del contenido y sin recortes en los cuatro anchos.
- El documento funciona sin conexión: 0 peticiones de red, 0 scripts y 0 recursos externos nuevos.
