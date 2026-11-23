# Desarrollo local con acceso por correo (solo QA sintético)

El formulario **«Acceso dev (correo en base de datos)»** permite entrar como
cualquier persona registrada **en la base QA sintética** para probar roles,
permisos, fichas, competencias, presentación y exportadores sin Google.

## Dónde funciona

| Entorno | Backend | Acceso por correo | Ingreso |
|---|---|---|---|
| QA aislado | `:3002` → PostgreSQL Docker `127.0.0.1:5434` (base `organigrama_qa`, marcada `qa`) | **sí** | formulario dev o Google |
| Local contra producción | `:3001` → Cloud SQL `core-database` (frontend `http://localhost:5173`) | **no** (404) | solo Google |
| Producción | Cloud Run | **no** (404; el build ni siquiera incluye el formulario) | solo Google |

## Por qué no puede usarse contra producción

El backend decide al arrancar (`DevLoginSafetyService`) y solo habilita el
acceso por correo si **todo** se cumple (si algo falla, queda bloqueado):

1. `NODE_ENV=development` y `DEV_LOGIN_ENABLED=true` (controles existentes;
   con `NODE_ENV=production` siempre 404).
2. `DB_HOST` es local (`localhost`, `127.0.0.1`, `::1`, `postgres`, …).
3. El servidor **no** es Cloud SQL (bloquea también un proxy local a Cloud SQL).
4. La base se declara no productiva: `organigrama.environment` ∈
   {`qa`, `development`, `local`} (`00_marcar_base_qa.sql`). Producción no
   tiene esa marca.

El log de arranque lo indica: `[DevLogin] habilitado: BASE_NO_PRODUCTIVA (qa)`
o `[DevLogin] bloqueado: <motivo>`. El frontend solo muestra el formulario en
`vite dev` **y** si `GET /api/auth/dev-login/status` responde `enabled: true`.

## Arrancar el entorno QA

En este equipo basta con el lanzador oficial (detalles en
`C:\dev\Organigrama\_integracion\COMO-INICIAR.md`):

```powershell
cd C:\dev\Organigrama
.\organigrama iniciar qa
```

Pasos manuales (otro equipo):

1. Base (una vez): seguir `README.md` (esquema + `00` … `05` + MC1). Para
   empezar de cero: `docker rm -f organigrama-qa-exports` y repetir.
2. Backend QA (directorio propio con `.env` que apunta **solo** a
   `127.0.0.1:5434`, `DEV_LOGIN_ENABLED=true`, `PORT=3002`):
   ```bash
   cd <directorio-qa> && node <repo>/dist/main.js
   ```
3. Frontend QA:
   ```bash
   cd <repo-frontend>
   VITE_API_BASE_URL=http://localhost:3002 \
   VITE_ORG_CHART_VERSION_ADMIN_EMAILS=qa_sintetico_directora@cun.edu.co \
     npx vite --port 5175 --strictPort
   ```
4. Abrir http://localhost:5175

## Cambiar de usuario

**Cerrar sesión** → escribir otro correo en «Acceso dev» → **Entrar con correo**.

| Perfil | Correo | Permisos técnicos | Qué permite probar |
|---|---|---|---|
| Administrador | `qa_sintetico_admin@cun.edu.co` | ORG_ADMIN, ORG_READ_ALL | ver fichas completas de todos; **no** exporta |
| Director | `qa_sintetico_directora@cun.edu.co` | — (versionamiento en QA) | competencias MC1 (Gestión Educativa), presentación, versiones |
| Analista | `qa_sintetico_analista1@cun.edu.co` | — | competencias MC1 (Software), presentación |
| Usuario general | `qa_sintetico_general@cun.edu.co` | — | vista básica; no ve competencias fuera de su línea |
| Exportación HTML | `qa_sintetico_export_html@cun.edu.co` | ORG_DIRECTORY_EXPORT_HTML | solo botón HTML |
| Exportación Excel | `qa_sintetico_export_xls@cun.edu.co` | ORG_DIRECTORY_EXPORT_XLS | solo botón Excel |
| Ambos permisos | `qa_sintetico_export_ambos@cun.edu.co` | ambos | ambos botones; competencias (Operaciones), presentación |
| Sin permisos | `qa_sintetico_sinpermisos@cun.edu.co` | — | sin botones de exportación |
| Alias de desarrollo | `desarrollofabrica@cun.edu.co` | ambos (solo QA) | persona ficticia 900199, sin privilegios administrativos |

Los permisos de exportación se conceden/revocan con el script, como en
producción (ejecutado desde el directorio QA):

```bash
node <repo>/dist/database/scripts/grant-directory-export.js <correo> --format=html|xls|both [--revoke]
```

## Limitaciones conocidas

- **Video**: las presentaciones sintéticas usan `drive_file_id` ficticios;
  la pestaña aparece y el reproductor se muestra, pero indica «No fue posible
  reproducir el video» (no hay archivo real ni credencial de Drive en QA).
- **Fotos**: no hay fotos reales en QA; se muestran iniciales.
- Perfiles MC1: generados con el motor real a partir de perfiles curados
  sintéticos (`mc1/`); aparecen como especialidades emergentes.
- Explorador de Competencias: lee los perfiles **publicados**
  (`05_presentaciones_mc1.sql`): 4 personas (Directora, Analista Uno, Analista
  Dos, Exportador Ambos). Sin ese archivo el explorador aparece vacío.
- Google en 5175: hoy responde `origin_mismatch` (origen no autorizado en el
  cliente OAuth); en QA se usa el formulario por correo.
