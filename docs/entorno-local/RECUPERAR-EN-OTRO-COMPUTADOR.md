# Recuperar Organigrama en otro computador (PowerShell)

Procedimiento seguro: no sobrescribe cambios locales, no cambia de rama las carpetas que ya existen, no usa `reset` ni `--force` y no toca `main`. Ejecute los bloques **uno por uno** y lea la salida antes de seguir.

Estado publicado el 27-nov-2026:

| Repositorio | Rama de trabajo | Punta | En producción |
|---|---|---|---|
| Frontend | `feat/vacantes-por-coordinacion-20261125` | `450aa7ffb3e415f749177b752c1e27fcaecc1113` | `122d969` (ancestro de la punta) |
| Backend | `integracion/organigrama-20261127` | Commit de docs sobre `64198073efd04fb8865791d652b36df5eda0055f` | `f2a4ffb` (mismo contenido que `6419807`, salvo las vacantes de `d90e9fb`) |

## 0. Variables

```powershell
# Carpeta raíz del proyecto en este computador: AJUSTAR si es otra
$Base    = 'C:\dev\Organigrama'
$RepoB   = "$Base\Organigrama_Backend"         # clon del backend (normalmente en main: no trabajar ahí)
$RepoF   = "$Base\Organigrama_Frontend"        # clon del frontend (normalmente en main: no trabajar ahí)
$WtB     = "$Base\_integracion\backend-integrado"   # worktree de la rama base del backend
$WtF     = "$Base\_integracion\frontend"            # worktree de la rama de trabajo del frontend
$RamaB   = 'integracion/organigrama-20261127'
$RamaF   = 'feat/vacantes-por-coordinacion-20261125'
$ShaB    = '64198073efd04fb8865791d652b36df5eda0055f'   # código de la rama base (sin la docs)
$ShaF    = '450aa7ffb3e415f749177b752c1e27fcaecc1113'
$ProdB   = 'f2a4ffb'                                     # backend en producción
$ProdF   = '122d969'                                     # frontend en producción
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
git -C $RepoF rev-parse "origin/$RamaF"                         # 450aa7ffb3e415f749177b752c1e27fcaecc1113
git -C $RepoB log --oneline -3 "origin/$RamaB"                  # punta = docs; debajo, 6419807 y d90e9fb
git -C $RepoB diff --stat $ShaB "origin/$RamaB" -- src          # vacío: la docs no toca código
# El código en producción está contenido en las ramas:
git -C $RepoF merge-base --is-ancestor $ProdF "origin/$RamaF"; "frontend de producción incluido: $($LASTEXITCODE -eq 0)"
git -C $RepoB diff --stat $ProdB "origin/$RamaB" -- src         # solo src/org-chart/vacancies/* (lo de d90e9fb)
```

## 3. Backend (rama base)

```powershell
if (-not (Test-Path $WtB)) {
  # Crea un worktree NUEVO (ruta ABSOLUTA); si la rama local no existe, git la crea con seguimiento de origin
  git -C $RepoB worktree add $WtB $RamaB
} else {
  # Ya existe: solo inspeccionar y avanzar en modo fast-forward (falla sin tocar nada si hay divergencia)
  git -C $WtB status --short --branch
  git -C $WtB merge --ff-only "origin/$RamaB"
}
git -C $WtB branch --set-upstream-to="origin/$RamaB"   # seguimiento de origin (solo configuración local)
git -C $WtB status --short --branch                    # esperado: «## integracion/organigrama-20261127...origin/...» sin cambios
```

Si `worktree add` responde que la rama ya está en uso en otra carpeta, use esa carpeta, o cree una copia aparte con `git -C $RepoB worktree add --detach "$Base\_integracion\backend-integrado-copia" "origin/$RamaB"`.

## 4. Frontend

```powershell
if (-not (Test-Path $WtF)) {
  git -C $RepoF worktree add $WtF $RamaF
  git -C $WtF merge --ff-only "origin/$RamaF"          # por si la rama local existía y estaba atrasada
} else {
  git -C $WtF status --short --branch                  # revisar: ¿rama correcta?, ¿cambios locales?
  git -C $WtF merge --ff-only "origin/$RamaF"          # solo avanza si es seguro; nunca sobrescribe
}
git -C $WtF branch --set-upstream-to="origin/$RamaF"
git -C $WtF rev-parse HEAD                             # 450aa7ffb3e415f749177b752c1e27fcaecc1113
```

Si la carpeta existente está en otra rama (por ejemplo, `integracion/organigrama-exportadores-20261123`) o tiene cambios que no deben mezclarse, no la toque. Cree una aparte con `git -C $RepoF worktree add --detach "$Base\_integracion\frontend-450aa7f" $ShaF` y use esa ruta como `$WtF`.

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
# Backend
npm --prefix $WtB run build
Push-Location $WtB
npx jest src/org-chart/html-export src/org-chart/org-chart-directory src/org-chart/org-chart-export.http src/org-chart/vacancies   # todo en verde
node scripts/vista-previa-html-sintetica.cjs "$env:TEMP\vista-previa-html.html"
(Get-FileHash "$env:TEMP\vista-previa-html.html" -Algorithm SHA256).Hash   # 785965B24213A3D2456C9D216F9855B95BF5A6D2CDB915D11917D599DE4675A8
Pop-Location

# Frontend: correr vitest desde PowerShell (desde Git Bash falla con «reading 'config'»)
Push-Location $WtF
npx vitest run --config vitest.config.ts   # 318 en verde
npx tsc -b                                 # sin errores
Pop-Location
```

## 8. Ejecutar

```powershell
# Terminal 1: backend en :3001 (datos reales de Cloud SQL, solo lectura)
cd $WtB; npm run start

# Terminal 2: frontend en :5173 (único origen autorizado para Google)
cd $WtF; npx vite --port 5173 --strictPort

# Navegador: http://localhost:5173 → Acceder con Google
```

- **Conexión a Cloud SQL.** Si falla, compruebe el horario (la instancia se apaga a las 22:00 de lunes a jueves) y si la red de la oficina está autorizada. No cambie redes autorizadas ni permisos sin autorización.
- **Lanzador `.\organigrama`.** Es opcional y tiene un desfase de ramas conocido; ver `README.md` de esta carpeta.
- **QA sintético de vacantes:** ver `QA-VACANTES.md`.
