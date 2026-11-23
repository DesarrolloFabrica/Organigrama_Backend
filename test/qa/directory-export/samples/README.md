# Archivos de referencia de los exportadores (datos SINTÉTICOS)

Generados el 23-nov-2026 desde el frontend QA (`localhost:5175`), con los
botones **Descargar HTML** y **Descargar Excel**, ingresando con el alias de
desarrollo `desarrollofabrica@cun.edu.co` (persona ficticia 900199 de la base
QA, con `ORG_DIRECTORY_EXPORT_HTML` y `ORG_DIRECTORY_EXPORT_XLS` concedidos
con `org:grant-directory-export`).

| Archivo | Qué es |
|---|---|
| `organigrama-ejemplo-sintetico.html` | Informe visual de equipos (diseño actual, sin rediseñar) |
| `organigrama-activo-ejemplo-sintetico.xls` | Informe de planta activa: SpreadsheetML 2003 (XML) con 26 columnas |

Contenido: 9 personas ficticias de la planta QA (sin el docente ni la persona
inactiva), todas las columnas con valor, jefes según la jerarquía sintética.
Ningún nombre, documento, correo ni teléfono es real.

Nota: el HTML carga el logo y la ilustración desde la URL pública del
frontend de producción (respaldo fijo del exportador cuando no hay una URL
`https` configurada). No son datos personales; abrirlo sin conexión muestra
esas imágenes rotas.

Son la referencia "antes" para el rediseño visual. Esta carpeta está fuera de
`src/`, así que no entra en el build de producción.
