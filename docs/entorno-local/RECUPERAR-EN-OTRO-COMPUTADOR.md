# Recuperar Organigrama en otro computador (PowerShell)

Procedimiento seguro: no sobrescribe cambios locales, no cambia de rama las carpetas que ya existen, no usa `reset` ni `--force` y no toca `main`. Ejecute los bloques **uno por uno** y lea la salida antes de seguir.

SHA publicados el 24-nov-2026:

| Repositorio | Rama | SHA |
|---|---|---|
| Frontend | `integracion/organigrama-exportadores-20261123` | `16b490dc0190e3ca9bd18e1fcf464bff7ac98120` |
| Backend | `rediseno-html/etapa1-iconos-20261124` | Punta = commit de documentación sobre `6736e601b7dae2c5f48e60280dd48c94fa8ede04`, que es el código desplegado |

## 0. Variables

```powershell
# Carpeta raíz del proyecto en este computador: AJUSTAR si es otra
$Base   = 'C:\dev\Organigrama'
$RepoB  = "$Base\Organigrama_Backend"     # clon del backend (normalmente en main: no trabajar ahí)
$RepoF  = "$Base\Organigrama_Frontend"    # clon del frontend (normalmente en main: no trabajar ahí)
$WtB    = "$Base\_integracion\backend-html"   # worktree del rediseño HTML
$WtF    = "$Base\_integracion\frontend"       # worktree del frontend robusto
$RamaB  = 'rediseno-html/etapa1-iconos-20261124'
$RamaF  = 'integracion/organigrama-exportadores-20261123'
$ShaF   = '16b490dc0190e3ca9bd18e1fcf464bff7ac98120'
$ShaCod = '6736e601b7dae2c5f48e60280dd48c94fa8ede04'
```

Si los clones no existen en este computador (solo en ese caso):

```powershell
# Clona los dos repositorios; git pedirá autenticarse con GitHub en el navegador
New-Item -ItemType Directory -Force $Base | Out-Null
git clone https://github.com/DesarrolloFabrica/Organigrama_Backend  $RepoB
git clone https://github.com/DesarrolloFabrica/Organigrama_Frontend $RepoF
```

## 1. Inspeccionar el estado actual (solo lectura)

```powershell
foreach ($r in @($RepoB, $RepoF)) {
  "===== $r"
  git -C $r status --short --branch     # rama actual y archivos modificados o sin seguimiento
  git -C $r worktree list               # worktrees que ya existen y su rama
  git -C $r stash list                  # trabajo guardado en stash (no se toca)
}
# Si aparecen cambios locales, NO se pierden: los pasos siguientes no cambian de rama
# esas carpetas ni hacen reset. Anótelos antes de continuar.
```

## 2. Traer las ramas publicadas

```powershell
# fetch solo descarga referencias: no modifica archivos ni ramas locales
git -C $RepoB fetch origin --prune
git -C $RepoF fetch origin --prune

# Comprobar los SHA publicados
git -C $RepoF rev-parse "origin/$RamaF"                      # debe ser 16b490dc0190e3ca9bd18e1fcf464bff7ac98120
git -C $RepoB log --oneline -3 "origin/$RamaB"               # punta = docs; debajo, 6736e60 feat(org-chart): rediseño visual…
git -C $RepoB merge-base --is-ancestor $ShaCod "origin/$RamaB"; "6736e60 incluido: $($LASTEXITCODE -eq 0)"
git -C $RepoB diff --stat $ShaCod "origin/$RamaB" -- src     # vacío: el código de la rama es el desplegado
```

## 3. Backend del rediseño HTML

```powershell
if (-not (Test-Path $WtB)) {
  # Crea un worktree NUEVO; si la rama local no existe, git la crea con seguimiento de origin
  git -C $RepoB worktree add $WtB $RamaB
} else {
  # Ya existe: solo inspeccionar y avanzar en modo fast-forward (falla sin tocar nada si hay divergencia)
  git -C $WtB status --short --branch
  git -C $WtB merge --ff-only "origin/$RamaB"
}
git -C $WtB branch --set-upstream-to="origin/$RamaB"   # seguimiento de origin (solo configuración local)
git -C $WtB status --short --branch                    # esperado: «## rediseno-html/...origin/...» sin cambios
git -C $WtB diff --stat $ShaCod HEAD -- src            # vacío
```

Si `worktree add` responde que la rama ya está en uso en otra carpeta, use esa carpeta, o cree una copia de solo lectura con `git -C $RepoB worktree add --detach "$Base\_integracion\backend-html-20261124" "origin/$RamaB"`.

## 4. Frontend robusto

```powershell
if (-not (Test-Path $WtF)) {
  git -C $RepoF worktree add $WtF $RamaF
  git -C $WtF merge --ff-only "origin/$RamaF"          # por si la rama local existía y estaba atrasada
} else {
  git -C $WtF status --short --branch                  # revisar: ¿rama correcta?, ¿cambios locales?
  git -C $WtF merge --ff-only "origin/$RamaF"          # solo avanza si es seguro; nunca sobrescribe
}
git -C $WtF branch --set-upstream-to="origin/$RamaF"
git -C $WtF rev-parse HEAD                             # debe ser 16b490dc0190e3ca9bd18e1fcf464bff7ac98120
```

Si la carpeta existente está en otra rama o con cambios que no deben mezclarse, no la toque. Cree una aparte con `git -C $RepoF worktree add --detach "$Base\_integracion\frontend-16b490d" $ShaF` y use esa ruta como `$WtF`.

## 5. Dependencias

```powershell
node -v; npm -v                          # probado con Node 24.18 / npm 11.16
npm --prefix $WtB ci                     # instala exactamente el package-lock (no modifica archivos versionados)
npm --prefix $WtF ci
```

## 6. Configuración local, sin sobrescribir

```powershell
# Backend: .env solo si no existe. Preferir la configuración robusta que ya tenga este computador.
if (-not (Test-Path "$WtB\.env")) {
  if (Test-Path "$Base\_integracion\backend\.env") { Copy-Item "$Base\_integracion\backend\.env" "$WtB\.env"; 'copiado del backend robusto' }
  else { Copy-Item "$WtB\.env.example" "$WtB\.env"; 'creado desde .env.example: COMPLETAR a mano' }
} else { '.env ya existe: no se toca' }
# NO copiar Organigrama_Backend\.env (es el de main: puerto 3000 y otras reglas de acceso).
# Revisar sin mostrar valores secretos:
Select-String -Path "$WtB\.env" -Pattern '^(PORT|DEV_LOGIN_ENABLED|API_PUBLIC_BASE_URL|ORG_CHART_PHOTO_TEST_URL|CORS_ORIGIN)='
# Esperado: PORT=3001, DEV_LOGIN_ENABLED=false, URLs en http://localhost:3001 y CORS_ORIGIN con http://localhost:5173.
# Las rutas GOOGLE_*_PATH deben apuntar a archivos que existan en ESTE computador, fuera de Git.

# Frontend: apunta al backend local en :3001 (no es un secreto)
if (-not (Test-Path "$WtF\.env.development.local")) {
  Set-Content -Encoding utf8 "$WtF\.env.development.local" 'VITE_API_BASE_URL=http://localhost:3001'
} else { Get-Content "$WtF\.env.development.local" }
```

## 7. Verificar antes de desarrollar

```powershell
npm --prefix $WtB run build
Push-Location $WtB
npx jest src/org-chart/html-export src/org-chart/org-chart-directory src/org-chart/org-chart-export.http   # 158 en verde
node scripts/vista-previa-html-sintetica.cjs "$env:TEMP\vista-previa-html.html"
(Get-FileHash "$env:TEMP\vista-previa-html.html" -Algorithm SHA256).Hash   # 785965B24213A3D2456C9D216F9855B95BF5A6D2CDB915D11917D599DE4675A8
Pop-Location
```

## 8. Ejecutar

```powershell
# Terminal 1: backend del rediseño en :3001 (datos reales de Cloud SQL, solo lectura)
cd $WtB; npm run start

# Terminal 2: frontend robusto en :5173 (único origen autorizado para Google)
cd $WtF; npx vite --port 5173 --strictPort

# Navegador: http://localhost:5173 → Acceder con Google
```

- **Conexión a Cloud SQL.** Si falla, compruebe el horario (la instancia se apaga a las 22:00 de lunes a jueves) y si la red de la oficina está autorizada. No cambie redes autorizadas ni permisos sin autorización.
- **Lanzador `.\organigrama`.** Es opcional; ver `README.md` de esta carpeta.
