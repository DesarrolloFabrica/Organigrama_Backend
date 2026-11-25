# Rediseño del exportador HTML del organigrama

Estado al **24-nov-2026**: la primera entrega está **desplegada en producción y aprobada visualmente** por el responsable, con datos reales.

| Dato | Valor |
|---|---|
| Rama | `rediseno-html/etapa1-iconos-20261124` |
| Commit del código desplegado | `6736e601b7dae2c5f48e60280dd48c94fa8ede04` (`6736e60`), hijo directo de `c5f2a0f` |
| Revisión de Cloud Run | `organigrama-backend-robusto-6736e60` (tag `html-v1`), al 100 % desde el 24-nov-2026 17:38 (Colombia) |
| Revisión para revertir | `organigrama-backend-robusto-c5f2a0f` (tag `fase3`) |

Los commits posteriores de la rama solo añaden documentación y herramientas de desarrollo; el código de `src/` es el de `6736e60`.

## 1. Qué incluye la primera entrega

1. **Etapa 1, iconos oficiales.** Cada sección de coordinación lleva su icono oficial como marca de agua.
   - Los iconos se toman de los PNG del frontend (`src/features/org-chart/assets/coordination-icons/`) y se incrustan como WebP en base64. Así funcionan sin conexión, sin SVG y sin JavaScript.
   - Homologaciones usa `Servicio.png` y Dirección usa `DirectorOp.png`.
2. **Etapa 2, color por coordinación.** El color sale del propio icono.
   - Se aclara en HSL (mismo tono y saturación) hasta lograr el contraste WCAG frente a `#0f172a`: acento ≥ 4,5:1 y texto ≥ 7:1.
   - Incluye tarjetas más espaciosas y una escala tipográfica con mínimo de 12 px. Detalle en [COLORES-Y-ESPACIADO.md](COLORES-Y-ESPACIADO.md).
3. **Etapa 2.1, menú y vista jerárquica.**
   - El menú lateral es neutro en reposo, con estética LED/radar.
   - Se ilumina con el color de la coordinación al pasar, enfocar o pulsar.
   - La opción seleccionada se marca con `:target` mediante `body:has(#ancla:target) nav a[href="#ancla"]`, sin JavaScript.
   - La vista jerárquica es un «centro de mando» en azul profundo, con retícula y radar.
4. **Sin cambios de lógica.** No cambian el endpoint, los permisos, la auditoría, la consulta, las reglas de inclusión, la agrupación ni el contenido de las tarjetas.
   - El Excel generado es idéntico byte a byte al de `c5f2a0f`.
   - El cuerpo del HTML es el mismo; solo se añaden los atributos `data-emblem` y `data-coord`.

Referencias visuales sintéticas: [referencia/paleta-coordinaciones.png](referencia/paleta-coordinaciones.png) y [referencia/menu-lateral-hover-fabrica.png](referencia/menu-lateral-hover-fabrica.png).

## 2. Archivos

| Archivo | Función |
|---|---|
| `src/org-chart/org-chart-directory-presentation.ts` | `buildOrgChartHtml(...)`, una función pura que genera el documento. Ensambla el `<style>` con los módulos de abajo |
| `src/org-chart/html-export/document.styles.ts` | `DOCUMENT_CSS`: base, variables, tarjetas, tipografía y vista jerárquica (`.hero`) |
| `src/org-chart/html-export/navigation.styles.ts` | Menú lateral: `NAVIGATION_BASE_CSS` (neutro) y `buildNavigationCss(anchors)` (estados iluminado y seleccionado) |
| `src/org-chart/html-export/coordination-emblems.config.ts` | Relación área → icono (coincidencia exacta tras normalizar) y `COORDINATION_COLORS` |
| `src/org-chart/html-export/coordination-palette.ts` | Cálculo de contraste (`liftToContrast`), `coordinationColorAttribute` y `buildCoordinationPaletteCss` |
| `src/org-chart/html-export/coordination-emblems.styles.ts` | Marca de agua (`mask-image`) y radar por sección |
| `src/org-chart/html-export/coordination-emblem-assets.generated.ts` | **Generado.** 9 iconos WebP en base64, cada uno con `sourceFile` y `sourceSha256` del PNG oficial |
| `src/org-chart/html-export/*.spec.ts` | Pruebas de iconos, paleta, menú y vista jerárquica |
| `scripts/generate-html-coordination-emblems.cjs` | Regenera el módulo `.generated.ts` desde los PNG del frontend. Es determinista |
| `scripts/vista-previa-html-sintetica.cjs` | Vista previa con 200 personas ficticias, sin base de datos |

No modificar para el rediseño: el controlador, `runAuditedExport`, los permisos, `directorySql`, `resolveDirectoryPeople`, `shouldIncludeDirectoryRow` ni `xmlEscape` (el Excel depende de él).

## 3. Cómo ver y verificar el diseño sin datos reales

```powershell
# Desde la raíz del worktree del backend
npm ci                      # solo la primera vez
npm run build
node scripts/vista-previa-html-sintetica.cjs "$env:TEMP\vista-previa-html.html"
# Con el código de 6736e60, el SHA-256 debe ser 785965b24213a3d2456c9d216f9855b95bf5a6d2cdb915d11917d599de4675a8
(Get-FileHash "$env:TEMP\vista-previa-html.html" -Algorithm SHA256).Hash
start "$env:TEMP\vista-previa-html.html"

# Pruebas del exportador (HTML, Excel y HTTP): 158 en verde
npx jest src/org-chart/html-export src/org-chart/org-chart-directory src/org-chart/org-chart-export.http
```

Para regenerar los iconos, por ejemplo si cambia un PNG oficial:

```powershell
# Requiere el frontend en ../frontend con node_modules (Playwright) y Google Chrome
node scripts/generate-html-coordination-emblems.cjs ../frontend
git diff --stat   # si los PNG no cambiaron, no debe haber diferencias
```

## 4. Limitaciones conocidas (siguen igual que antes del rediseño)

- **Tamaño.** El HTML pasa de unos 107 KB a unos 448 KB por los iconos incrustados.
- **Contenido remoto.** Las fotos de las personas (Google) y el logo siguen siendo remotos y no se ven sin conexión.
- **Cédula visible.** Cada tarjeta muestra la cédula; está pendiente decidir si se conserva.
- **Agrupación.** El HTML agrupa por área registrada y el Excel por coordinación jerárquica.
- **Profundidad.** Hay un defecto latente: en el modo «equipos» solo se pintan 3 niveles bajo el líder del área. Hoy no falta nadie, pero un nivel más ocultaría personas.
- **Texto fijo.** La vista jerárquica nombra por su nombre de pila al Coordinador General.
- **Colores parecidos.** B2B y Especializaciones comparten el rojo de sus iconos.

## 5. Próximas mejoras sugeridas (no iniciadas, requieren aprobación)

Base: [AUDITORIA-INICIAL-EXPORTADOR-HTML.md](AUDITORIA-INICIAL-EXPORTADOR-HTML.md), §9 a §12.

1. **Decisiones del responsable:** conservar la cédula, agrupar por área o por coordinación, añadir datos de contacto, incrustar fotos e impresión o PDF.
2. **Pintado recursivo.** Corregir la omisión por profundidad, con una prueba de invariante: toda persona elegible aparece al menos una vez.
3. **Texto fijo.** Quitar el nombre propio de la vista jerárquica.
4. **Accesibilidad:** `h1`/`h2` correctos, enlace para saltar al contenido, `aria-label` en `nav`, foco visible y respaldo a iniciales cuando falla la foto.
5. **Impresión:** `@media print` en claro, con `break-inside: avoid`.
6. **Fecha de generación** visible y aviso de uso interno.
7. **Búsqueda o filtros**, solo si se aprueban. Exigirían JavaScript con mejora progresiva y CSP.
