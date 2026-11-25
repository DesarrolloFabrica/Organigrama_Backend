<#
  Organigrama — procedimiento OFICIAL de arranque local (versión robusta).

  Desde C:\dev\Organigrama (Cursor / PowerShell):
    .\organigrama                    estado de todo
    .\organigrama iniciar            versión robusta + QA (detiene main si estaba corriendo)
    .\organigrama iniciar robusto    solo la versión robusta
    .\organigrama iniciar qa         solo QA
    .\organigrama detener [robusto|qa|todo]
    .\organigrama reiniciar [robusto|qa|todo]
    .\organigrama verificar          comprobaciones sin iniciar ni detener nada
  iniciar / reiniciar / verificar terminan en "LISTO" o en "NO LISTO" (código de salida 1)
  si falta cualquier ruta moderna (competencias, videos, HTML/Excel, Mis datos, versiones,
  change-token), si el frontend no es el robusto completo, si la configuración apunta a
  otro backend o si las credenciales de Drive/Workspace faltan o están versionadas.
    .\organigrama detener-main       cierra main (versión antigua) en cualquier puerto
  Opciones: -Compilar (recompila el backend), -PuertoFrontend 5174 (otro puerto para el robusto)

  Entornos:
    robusto  http://localhost:5173 → backend :3001 → Cloud SQL (datos reales). Solo Google.
             5173 es el origen ya autorizado en el cliente OAuth. 5174 requiere autorizarlo
             en Google Cloud (ver COMO-INICIAR.md); luego puede usarse -PuertoFrontend 5174.
    qa       http://localhost:5175 → backend :3002 → PostgreSQL Docker 127.0.0.1:5434
             (datos sintéticos). Acceso por correo con usuarios qa_sintetico_*.

  Nunca ejecutar `npm run dev` / `npm run start:dev` en Organigrama_Backend u
  Organigrama_Frontend (repos originales en main = versión antigua).
#>
param(
  [Parameter(Position = 0)]
  [ValidateSet('estado', 'iniciar', 'detener', 'reiniciar', 'verificar', 'detener-main')]
  [string]$Accion = 'estado',
  [Parameter(Position = 1)][ValidateSet('robusto', 'qa', 'todo')][string]$Entorno = 'todo',
  [int]$PuertoFrontend = 0,
  [switch]$Compilar
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

# ── Configuración ─────────────────────────────────────────────────────────
$Root            = 'C:\dev\Organigrama\_integracion'
$Backend         = Join-Path $Root 'backend'
$Frontend        = Join-Path $Root 'frontend'
$QaBackend       = Join-Path $Root 'qa-backend'
$Logs            = Join-Path $Root 'logs'
$BackendMain     = Join-Path $Backend 'dist\main.js'
$EnvMainAntiguo  = 'C:\dev\Organigrama\Organigrama_Backend\.env'   # backend antiguo (main); nunca se arranca desde aquí
$ViteBin         = Join-Path $Frontend 'node_modules\vite\bin\vite.js'
$RamaEsperada    = 'integracion/organigrama-exportadores-20261123'
$QaContainer     = 'organigrama-qa-exports'
$PuertoRobustoFrontendPorDefecto = 5173   # origen autorizado hoy en el cliente OAuth
$PuertosFrontendRobusto = @(5173, 5174)
$Cfg = @{ RobustoBackend = 3001; QaBackend = 3002; QaFrontend = 5175 }
$PuertoRobustoFrontend = if ($PuertoFrontend -gt 0) { $PuertoFrontend } else { $PuertoRobustoFrontendPorDefecto }
New-Item -ItemType Directory -Force -Path $Logs | Out-Null

# ── Utilidades ────────────────────────────────────────────────────────────
# Toda línea [X] se registra: si hay alguna, el comando termina en NO LISTO (código 1).
$script:Fallas = New-Object System.Collections.Generic.List[string]
function Write-Ok($m)   { Write-Host "  [ok] $m" -ForegroundColor Green }
function Write-Warn2($m){ Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Write-Bad($m)  { Write-Host "  [X]  $m" -ForegroundColor Red; $script:Fallas.Add([string]$m) }

function Read-EnvArchivo([string]$Ruta) {
  # Igual que dotenv: si una clave se repite, gana la última.
  $h = @{}
  foreach ($l in Get-Content $Ruta) { if ($l -match '^\s*([A-Za-z0-9_]+)\s*=(.*)$') { $h[$Matches[1]] = $Matches[2].Trim().Trim('"') } }
  $h
}

function Invoke-GitSilencioso([string[]]$Argumentos) {
  # git escribe en stderr cuando la ruta no está en un repo; con Stop eso abortaría.
  $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { & git @Argumentos 2>$null | Out-Null; return $LASTEXITCODE } finally { $ErrorActionPreference = $prev }
}

function Get-Http([string]$Url) {
  try {
    $r = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 5
    return @{ Code = [int]$r.StatusCode; Body = [string]$r.Content }
  } catch {
    $resp = $_.Exception.Response
    if ($resp) { return @{ Code = [int]$resp.StatusCode; Body = '' } }
    return @{ Code = 0; Body = '' }
  }
}

function Get-Escucha([int]$Puerto) {
  $c = Get-NetTCPConnection -LocalPort $Puerto -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $c) { return $null }
  Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)"
}

function Get-Cadena($Proc) {
  $todos = Get-CimInstance Win32_Process; $out = @(); $cur = $Proc
  while ($cur) { $out += $cur; $cur = $todos | Where-Object ProcessId -eq $cur.ParentProcessId }
  $out
}

function Get-Origen($Proc) {
  if (-not $Proc) { return 'libre' }
  $txt = (Get-Cadena $Proc | ForEach-Object { $_.CommandLine }) -join ' '
  if ($txt -match 'Organigrama\\Organigrama_(Backend|Frontend)') { return 'MAIN' }
  if ($txt -match '_integracion[\\/]frontend') { return 'frontend-integrado' }
  if ($txt -match '_integracion[\\/](backend|qa-backend)|qa[\\/]backend-cwd') { return 'backend-integrado' }
  if ($txt -match 'dist[\\/]main\.js') { return 'backend-integrado' }
  return $Proc.Name
}

function Stop-Arbol($Proc, [string]$Patron) {
  # Sube por padres node/cmd del mismo arranque; nunca cierra la terminal.
  $todos = Get-CimInstance Win32_Process; $raiz = $Proc; $cur = $Proc
  while ($true) {
    $padre = $todos | Where-Object ProcessId -eq $cur.ParentProcessId
    if (-not $padre -or $padre.Name -notin @('node.exe', 'cmd.exe') -or $padre.CommandLine -notmatch $Patron) { break }
    $raiz = $padre; $cur = $padre
  }
  taskkill /PID $raiz.ProcessId /T /F 2>&1 | Out-Null
}

function Get-ProcesosMain {
  Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalAddress -in @('::', '::1', '0.0.0.0', '127.0.0.1') } |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Get-CimInstance Win32_Process -Filter "ProcessId=$_" } |
    Where-Object { $_.Name -eq 'node.exe' -and (Get-Origen $_) -eq 'MAIN' }
}

function Stop-Main([switch]$Silencioso) {
  $procs = @(Get-ProcesosMain)
  if (-not $procs) { if (-not $Silencioso) { Write-Ok 'main no está corriendo' }; return }
  foreach ($p in $procs) {
    $puertos = (Get-NetTCPConnection -OwningProcess $p.ProcessId -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort -Unique) -join ','
    Stop-Arbol $p 'Organigrama_(Backend|Frontend)|npm-cli|nest|vite|dist[\\/]main'
    Write-Warn2 "detenido main (versión antigua) en :$puertos — los repos originales no se modifican"
  }
}

function Wait-Puerto([int]$Puerto, [int]$Segundos = 90) {
  $fin = (Get-Date).AddSeconds($Segundos)
  while ((Get-Date) -lt $fin) { if (Get-Escucha $Puerto) { return $true }; Start-Sleep -Milliseconds 600 }
  $false
}

function Wait-Api([int]$Puerto, [int]$Segundos = 180) {
  $fin = (Get-Date).AddSeconds($Segundos)
  while ((Get-Date) -lt $fin) { if ((Get-Http "http://localhost:$Puerto/api/health").Code -eq 200) { return $true }; Start-Sleep -Seconds 1 }
  $false
}

function Start-Node([string]$Nombre, [int]$Puerto, [string]$Dir, [string[]]$Argumentos, [hashtable]$Env = @{}) {
  $actual = Get-Escucha $Puerto
  if ($actual) {
    $o = Get-Origen $actual
    if ($o -in 'frontend-integrado', 'backend-integrado') { Write-Ok "$Nombre ya está en :$Puerto (no se duplica)"; return }
    throw ":$Puerto está ocupado por otro proceso ($o, PID $($actual.ProcessId)). Libérelo y reintente."
  }
  $guardado = @{}
  foreach ($k in $Env.Keys) {
    $guardado[$k] = [Environment]::GetEnvironmentVariable($k, 'Process')
    [Environment]::SetEnvironmentVariable($k, $Env[$k], 'Process')
  }
  try {
    # Sin redirección de Start-Process (heredaría los handles de la terminal y
    # la dejaría bloqueada): cmd redirige a los logs y el proceso queda
    # independiente de la consola de Cursor.
    $node = (Get-Command node -ErrorAction Stop).Source
    $argsTxt = ($Argumentos | ForEach-Object { if ($_ -match '\s|\\') { "`"$_`"" } else { $_ } }) -join ' '
    $log = Join-Path $Logs "$Nombre.log"; $err = Join-Path $Logs "$Nombre.err.log"
    $linea = "`"`"$node`" $argsTxt 1>`"$log`" 2>`"$err`"`""
    Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d', '/s', '/c', $linea) -WorkingDirectory $Dir -WindowStyle Hidden | Out-Null
  } finally {
    foreach ($k in $guardado.Keys) { [Environment]::SetEnvironmentVariable($k, $guardado[$k], 'Process') }
  }
  Write-Host "  ...  $Nombre iniciando en :$Puerto (log: logs\$Nombre.log)"
}

# ── Comprobaciones de versión ─────────────────────────────────────────────
function Test-Worktrees {
  foreach ($wt in @($Backend, $Frontend)) {
    $rama = (git -C $wt branch --show-current).Trim()
    $head = (git -C $wt rev-parse --short HEAD).Trim()
    $pend = @(git -C $wt status --short).Count
    if ($rama -ne $RamaEsperada) { throw "$wt está en '$rama' (se esperaba $RamaEsperada)." }
    $extra = if ($pend) { " ($pend cambios sin commit)" } else { '' }
    Write-Ok ("{0,-9} {1} @ {2}{3}" -f (Split-Path $wt -Leaf), $rama, $head, $extra)
  }
}

function Test-DistActualizado {
  if (-not (Test-Path $BackendMain)) { return $false }
  # dist al día = compilado después de la última modificación de cualquier archivo fuente.
  $dist = (Get-Item $BackendMain).LastWriteTimeUtc
  $fuente = Get-ChildItem (Join-Path $Backend 'src') -Recurse -File -Include *.ts, *.json |
    Where-Object { $_.Name -notlike '*.spec.ts' } |
    Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
  return ($dist -ge $fuente.LastWriteTimeUtc)
}

function Invoke-Compilar {
  if ((Get-Escucha $Cfg.RobustoBackend) -or (Get-Escucha $Cfg.QaBackend)) { throw 'Detenga ambos backends antes de compilar (comparten dist): .\organigrama detener' }
  Write-Host '  ...  compilando backend (nest build)'
  Push-Location $Backend
  try { & npx nest build 2>&1 | Out-Null; if ($LASTEXITCODE -ne 0) { throw 'nest build falló' } } finally { Pop-Location }
  Write-Ok 'backend compilado'
}

# Rutas de la versión robusta. Sin sesión deben responder 401 (existen y exigen
# autenticación); 404 = ruta ausente = versión equivocada o compilación vieja.
$GruposRutas = [ordered]@{
  'organigrama, versiones, change-token (Orbit) y fotos' = @('org-chart/root', 'org-chart/summary/general-areas', 'org-chart/versions', 'org-chart/change-token', 'org-chart/photos/1')
  'competencias, radar y explorador'                     = @('org-chart/person/1/competencies', 'org-chart/person/1/competencies/professional-profile', 'org-chart/competency-people-search')
  'presentación y videos'                                = @('org-chart/person/1/video', 'org-chart/person/1/video/stream')
  'exportadores HTML/Excel y permisos'                   = @('org-chart/export/html', 'org-chart/export/directory', 'org-chart/export/permissions')
  'Mis datos'                                            = @('profile/me')
}

function Test-Backend([int]$Puerto, [bool]$DevLoginEsperado) {
  $ok = $true
  $h = Get-Http "http://localhost:$Puerto/api/health"
  if ($h.Code -ne 200) { Write-Bad ":$Puerto no responde"; return $false }
  foreach ($g in $GruposRutas.Keys) {
    $malas = @($GruposRutas[$g] | ForEach-Object { $c = (Get-Http "http://localhost:$Puerto/api/$_").Code; if ($c -ne 401) { "/api/$_ → $c" } })
    if ($malas) { Write-Bad (":$Puerto falta {0}: {1}" -f $g, ($malas -join '; ')); $ok = $false }
    else { Write-Ok ":$Puerto $g" }
  }
  $st = Get-Http "http://localhost:$Puerto/api/auth/dev-login/status"
  $enabled = $st.Body -match '"enabled"\s*:\s*true'
  if ($enabled -ne $DevLoginEsperado) {
    Write-Bad (":$Puerto acceso por correo {0} (se esperaba {1})" -f $(if ($enabled) { 'HABILITADO' } else { 'bloqueado' }), $(if ($DevLoginEsperado) { 'habilitado' } else { 'bloqueado' }))
    $ok = $false
  } else {
    Write-Ok (":$Puerto acceso por correo {0}" -f $(if ($enabled) { 'habilitado (base QA sintética)' } else { 'bloqueado (solo Google)' }))
  }
  $ok
}

function Test-Frontend([int]$Puerto, [int]$BackendEsperado) {
  $ok = $true
  $base = "http://localhost:$Puerto/src"
  $svc = Get-Http "$base/features/org-chart/services/orgChartService.ts"
  if ($svc.Body -notmatch "`"VITE_API_BASE_URL`":\s*`"http://localhost:$BackendEsperado`"") { Write-Bad ":$Puerto no apunta a :$BackendEsperado"; $ok = $false }
  $app   = (Get-Http "$base/App.tsx").Body
  $panel = (Get-Http "$base/features/org-chart/components/PersonDetailPanel.tsx").Body
  $bar   = (Get-Http "$base/features/org-chart/components/OrgChartDirectoryExportBar.tsx").Body
  $radar = (Get-Http "$base/features/competencies/components/CompetencyRadar.tsx").Code
  $faltan = @()
  if ($app -notmatch 'competency-explorer')       { $faltan += 'explorador de competencias' }
  if ($app -notmatch 'MyDataPage')                { $faltan += 'Mis datos' }
  if ($panel -notmatch 'PersonPresentationPanel') { $faltan += 'pestaña Presentación' }
  if ($panel -notmatch 'PersonCompetenciesPanel') { $faltan += 'pestaña Competencias' }
  if ($radar -ne 200)                             { $faltan += 'radar de competencias' }
  if ($bar -notmatch 'Descargar HTML')            { $faltan += 'botón HTML' }
  if ($bar -notmatch 'Descargar Excel')           { $faltan += 'botón Excel' }
  if ($faltan) { Write-Bad (":$Puerto no es el frontend robusto completo; falta: {0}" -f ($faltan -join ', ')); $ok = $false }
  if ($ok) { Write-Ok ":$Puerto frontend robusto → :$BackendEsperado (explorador, Mis datos, Presentación, Competencias + radar, botones HTML y Excel)" }
  $ok
}

# Configuración del backend robusto (conectado a producción). Se revisa antes de
# arrancar y en `verificar`. No imprime valores secretos.
function Test-ConfigRobusto {
  $envR = Read-EnvArchivo (Join-Path $Backend '.env')
  $antes = $script:Fallas.Count
  if ($envR['DEV_LOGIN_ENABLED'] -ne 'false') { Write-Bad 'backend\.env debe tener DEV_LOGIN_ENABLED=false (está conectado a producción)' }
  $api = "http://localhost:$($Cfg.RobustoBackend)"
  $pub = ([string]$envR['API_PUBLIC_BASE_URL']).TrimEnd('/')
  if ($pub -and $pub -ne $api) { Write-Bad "API_PUBLIC_BASE_URL=${pub}: las fotos se pedirían a otro backend (debe ser $api)" }
  $test = [string]$envR['ORG_CHART_PHOTO_TEST_URL']
  if ($test -and -not $test.StartsWith("$api/")) { Write-Bad "ORG_CHART_PHOTO_TEST_URL apunta fuera de $api" }
  $cors = [string]$envR['CORS_ORIGIN']
  if ($cors -notmatch [regex]::Escape("http://localhost:$PuertoRobustoFrontend")) { Write-Bad "CORS_ORIGIN no admite http://localhost:$PuertoRobustoFrontend" }
  # Credenciales de Drive (videos, CV) y de Workspace (foto desde Google en Mis datos):
  # deben existir, con ruta absoluta (las relativas dependen del directorio de
  # arranque) y fuera de control de versiones.
  $credOk = 0
  foreach ($k in 'GOOGLE_DRIVE_CV_TOKEN_PATH', 'GOOGLE_DRIVE_CV_OAUTH_CLIENT_PATH', 'GOOGLE_SERVICE_ACCOUNT_KEY_PATH') {
    $v = [string]$envR[$k]
    if (-not $v) { Write-Bad "$k no está definida"; continue }
    if (-not [IO.Path]::IsPathRooted($v)) { Write-Bad "$k es relativa ($v): no existe desde el worktree; use ruta absoluta"; continue }
    if (-not (Test-Path -LiteralPath $v -PathType Leaf)) { Write-Bad "$k apunta a un archivo inexistente"; continue }
    $dir = Split-Path $v -Parent; $hoja = Split-Path $v -Leaf
    if ((Invoke-GitSilencioso @('-C', $dir, 'ls-files', '--error-unmatch', '--', $hoja)) -eq 0) { Write-Bad "${k}: el archivo está VERSIONADO en Git"; continue }
    if ((Invoke-GitSilencioso @('-C', $dir, 'check-ignore', '-q', '--', $hoja)) -eq 1) { Write-Warn2 "${k}: el archivo no está en .gitignore (riesgo de commit accidental)" }
    $credOk++
  }
  if ($credOk -eq 3) { Write-Ok 'credenciales de Drive y Workspace presentes, con ruta absoluta y fuera de Git' }
  if ($script:Fallas.Count -eq $antes) { Write-Ok "configuración robusta: solo Google, fotos y CORS en :$($Cfg.RobustoBackend)/:$PuertoRobustoFrontend" }
  return ($script:Fallas.Count -eq $antes)
}

function Test-ConfigQa {
  $envQ = Read-EnvArchivo (Join-Path $QaBackend '.env')
  if ($envQ['DB_HOST'] -notin @('127.0.0.1', 'localhost')) { Write-Bad 'qa-backend\.env: DB_HOST debe ser local (127.0.0.1)'; return $false }
  if ($envQ['PORT'] -ne "$($Cfg.QaBackend)") { Write-Bad "qa-backend\.env: PORT debe ser $($Cfg.QaBackend)"; return $false }
  Write-Ok 'configuración QA: base local 127.0.0.1, puerto propio'
  $true
}

function Test-MainSinDevLogin {
  # El backend antiguo (main) apunta a la base de producción. Si alguien lo
  # arranca a mano (npm run start:dev en Organigrama_Backend) con el acceso por
  # correo habilitado, se podría entrar como cualquier persona sin Google.
  if (-not (Test-Path -LiteralPath $EnvMainAntiguo)) { return }
  $envM = Read-EnvArchivo $EnvMainAntiguo
  $local = $envM['DB_HOST'] -in @('127.0.0.1', 'localhost')
  if ($envM['DEV_LOGIN_ENABLED'] -eq 'true' -and -not $local) {
    Write-Bad 'Organigrama_Backend\.env (main, versión antigua) tiene DEV_LOGIN_ENABLED=true contra una base no local: cámbielo a false'
  } else {
    Write-Ok 'backend antiguo (main): sin acceso por correo contra una base no local'
  }
}

function Write-Veredicto {
  Write-Host ''
  if ($script:Fallas.Count -gt 0) {
    Write-Host ("  NO LISTO: {0} problema(s). Revise las líneas [X]." -f $script:Fallas.Count) -ForegroundColor Red
    Write-Host ''
    exit 1
  }
  $fr = $PuertosFrontendRobusto | Where-Object { $p = Get-Escucha $_; $p -and (Get-Origen $p) -eq 'frontend-integrado' } | Select-Object -First 1
  if ($fr) { Write-Host "  LISTO. Organigrama (versión robusta): http://localhost:$fr" -ForegroundColor Green }
  else { Write-Host '  Sin fallas, pero la versión robusta no está corriendo: .\organigrama iniciar' -ForegroundColor Yellow }
  Write-Host ''
}

# ── Arranque ──────────────────────────────────────────────────────────────
function Start-Robusto {
  Write-Host "`nRobusto: http://localhost:$PuertoRobustoFrontend → :$($Cfg.RobustoBackend) → Cloud SQL (solo Google)" -ForegroundColor Cyan
  if (-not (Test-ConfigRobusto)) { throw 'Configuración del backend robusto inválida (líneas [X]); no se inicia.' }
  foreach ($otro in $PuertosFrontendRobusto | Where-Object { $_ -ne $PuertoRobustoFrontend }) {
    $p = Get-Escucha $otro
    if ($p -and (Get-Origen $p) -eq 'frontend-integrado') { Write-Warn2 "también hay un frontend robusto en :$otro" }
  }
  Start-Node 'robusto-backend' $Cfg.RobustoBackend $Backend @('--enable-source-maps', $BackendMain)
  Start-Node 'robusto-frontend' $PuertoRobustoFrontend $Frontend @($ViteBin, '--port', "$PuertoRobustoFrontend", '--strictPort') @{
    VITE_API_BASE_URL = "http://localhost:$($Cfg.RobustoBackend)"
    VITE_ORG_CHART_VERSION_ADMIN_EMAILS = $null
  }
  if (-not (Wait-Api $Cfg.RobustoBackend)) { throw "El backend robusto no respondió; revise logs\robusto-backend.log" }
  if (-not (Wait-Puerto $PuertoRobustoFrontend)) { throw "El frontend robusto no arrancó; revise logs\robusto-frontend.log" }
  $okB = Test-Backend $Cfg.RobustoBackend $false
  if (-not $okB -and ((Get-Http "http://localhost:$($Cfg.RobustoBackend)/api/auth/dev-login/status").Body -match '"enabled"\s*:\s*true')) {
    Stop-Arbol (Get-Escucha $Cfg.RobustoBackend) '_integracion|dist[\\/]main'
    throw 'SEGURIDAD: el backend robusto reportó acceso por correo habilitado; se detuvo.'
  }
  Test-Frontend $PuertoRobustoFrontend $Cfg.RobustoBackend | Out-Null
}

function Start-Qa {
  Write-Host "`nQA: http://localhost:$($Cfg.QaFrontend) → :$($Cfg.QaBackend) → Docker 127.0.0.1:5434 (sintético, acceso por correo)" -ForegroundColor Cyan
  if (-not (Test-ConfigQa)) { throw 'Configuración QA inválida (líneas [X]); no se inicia.' }
  if (-not (docker ps --filter "name=$QaContainer" --format '{{.Names}}' 2>$null)) {
    Write-Host "  ...  iniciando contenedor $QaContainer (conserva sus datos)"
    docker start $QaContainer | Out-Null
    $fin = (Get-Date).AddSeconds(60)
    while ((Get-Date) -lt $fin) { docker exec $QaContainer pg_isready -U qa -d organigrama_qa 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 1 }
  }
  Write-Ok "PostgreSQL QA: $(docker ps --filter "name=$QaContainer" --format '{{.Status}}')"
  Start-Node 'qa-backend' $Cfg.QaBackend $QaBackend @('--enable-source-maps', $BackendMain)
  Start-Node 'qa-frontend' $Cfg.QaFrontend $Frontend @($ViteBin, '--port', "$($Cfg.QaFrontend)", '--strictPort') @{
    VITE_API_BASE_URL = "http://localhost:$($Cfg.QaBackend)"
    VITE_ORG_CHART_VERSION_ADMIN_EMAILS = 'qa_sintetico_directora@cun.edu.co'
  }
  if (-not (Wait-Api $Cfg.QaBackend)) { throw 'El backend QA no respondió; revise logs\qa-backend.log' }
  if (-not (Wait-Puerto $Cfg.QaFrontend)) { throw 'El frontend QA no arrancó; revise logs\qa-frontend.log' }
  Test-Backend $Cfg.QaBackend $true | Out-Null
  Test-Frontend $Cfg.QaFrontend $Cfg.QaBackend | Out-Null
}

function Stop-Entorno([string]$Cual) {
  $objetivos = @()
  if ($Cual -in 'robusto', 'todo') { $objetivos += $Cfg.RobustoBackend; $objetivos += $PuertosFrontendRobusto }
  if ($Cual -in 'qa', 'todo') { $objetivos += $Cfg.QaBackend; $objetivos += $Cfg.QaFrontend }
  foreach ($puerto in $objetivos) {
    $proc = Get-Escucha $puerto
    if (-not $proc) { continue }
    $o = Get-Origen $proc
    if ($o -notin 'frontend-integrado', 'backend-integrado') { if ($o -eq 'MAIN') { Write-Warn2 ":$puerto es main (use detener-main)" }; continue }
    Stop-Arbol $proc '_integracion|dist[\\/]main|vite'
    Write-Ok "detenido :$puerto"
  }
  if ($Cual -in 'qa', 'todo') { Write-Host '  (el contenedor PostgreSQL QA sigue activo y conserva los datos)' -ForegroundColor DarkGray }
}

function Show-Estado {
  Write-Host "`nOrganigrama — estado local" -ForegroundColor Cyan
  $main = @(Get-ProcesosMain)
  foreach ($m in $main) {
    $puertos = (Get-NetTCPConnection -OwningProcess $m.ProcessId -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort -Unique) -join ','
    Write-Bad "main (versión ANTIGUA) corriendo en :$puertos  →  .\organigrama detener-main"
  }
  if (-not $main) { Write-Ok 'main no está corriendo' }
  $filas = @(
    @{ N = 'robusto frontend'; Ps = $PuertosFrontendRobusto },
    @{ N = 'robusto backend';  Ps = @($Cfg.RobustoBackend) },
    @{ N = 'qa frontend';      Ps = @($Cfg.QaFrontend) },
    @{ N = 'qa backend';       Ps = @($Cfg.QaBackend) }
  )
  foreach ($f in $filas) {
    $encontrado = $false
    foreach ($pt in $f.Ps) {
      $proc = Get-Escucha $pt
      if ($proc -and (Get-Origen $proc) -ne 'MAIN') {
        Write-Host ("  {0,-17} :{1,-5} {2}" -f $f.N, $pt, (Get-Origen $proc)) -ForegroundColor Green; $encontrado = $true
      }
    }
    if (-not $encontrado) { Write-Host ("  {0,-17} detenido" -f $f.N) -ForegroundColor DarkGray }
  }
  $db = docker ps --filter "name=$QaContainer" --format '{{.Status}}' 2>$null
  Write-Host ("  {0,-17} {1}" -f 'postgres QA', $(if ($db) { ":5434 $db" } else { 'detenido' })) -ForegroundColor $(if ($db) { 'Green' } else { 'DarkGray' })
  $fr = $PuertosFrontendRobusto | Where-Object { $p = Get-Escucha $_; $p -and (Get-Origen $p) -eq 'frontend-integrado' } | Select-Object -First 1
  Write-Host ''
  if ($fr) { Write-Host "  Robusto: http://localhost:$fr  (Google)" -ForegroundColor Cyan }
  if (Get-Escucha $Cfg.QaFrontend) { Write-Host "  QA:      http://localhost:$($Cfg.QaFrontend)  (acceso por correo, usuarios qa_sintetico_*)" -ForegroundColor Cyan }
  Write-Host ''
}

function Test-EnvDespuesDeArranque([int]$Puerto, [string]$EnvArchivo, [string]$Nombre) {
  # Un .env editado después de arrancar el backend no está aplicado todavía.
  $proc = Get-Escucha $Puerto
  if (-not $proc) { return }
  $inicio = $proc.CreationDate
  if ((Get-Item $EnvArchivo).LastWriteTime -gt $inicio) { Write-Bad "$Nombre arrancó antes del último cambio de su .env: .\organigrama reiniciar $Nombre" }
}

function Invoke-Verificar {
  Write-Host "`nVerificación" -ForegroundColor Cyan
  Test-MainSinDevLogin
  Test-Worktrees
  if (Test-DistActualizado) { Write-Ok 'backend\dist corresponde al último commit de src' } else { Write-Bad 'backend\dist desactualizado: .\organigrama reiniciar todo -Compilar' }
  Write-Host "`n  Robusto" -ForegroundColor Cyan
  Test-ConfigRobusto | Out-Null
  Test-EnvDespuesDeArranque $Cfg.RobustoBackend (Join-Path $Backend '.env') 'robusto'
  if (Get-Escucha $Cfg.RobustoBackend) { Test-Backend $Cfg.RobustoBackend $false | Out-Null } else { Write-Bad 'backend robusto detenido (:3001)' }
  $fr = @($PuertosFrontendRobusto | Where-Object { $p = Get-Escucha $_; $p -and (Get-Origen $p) -eq 'frontend-integrado' })
  if (-not $fr) { Write-Bad 'frontend robusto detenido' }
  foreach ($pt in $fr) { Test-Frontend $pt $Cfg.RobustoBackend | Out-Null }
  Write-Host "`n  QA (separado, opcional)" -ForegroundColor Cyan
  if ((Get-Escucha $Cfg.QaBackend) -or (Get-Escucha $Cfg.QaFrontend)) {
    Test-ConfigQa | Out-Null
    Test-EnvDespuesDeArranque $Cfg.QaBackend (Join-Path $QaBackend '.env') 'qa'
    if (Get-Escucha $Cfg.QaBackend) { Test-Backend $Cfg.QaBackend $true | Out-Null } else { Write-Bad 'backend QA detenido (:3002)' }
    if (Get-Escucha $Cfg.QaFrontend) { Test-Frontend $Cfg.QaFrontend $Cfg.QaBackend | Out-Null } else { Write-Bad 'frontend QA detenido (:5175)' }
  } else { Write-Host '  (QA no está corriendo)' -ForegroundColor DarkGray }
}

function Invoke-Iniciar([string]$Cual) {
  Write-Host "`nPreparación" -ForegroundColor Cyan
  Stop-Main
  Test-MainSinDevLogin
  Test-Worktrees
  $requiereCompilar = $Compilar -or -not (Test-DistActualizado)
  if ($requiereCompilar) {
    if ((Get-Escucha $Cfg.RobustoBackend) -or (Get-Escucha $Cfg.QaBackend)) {
      Write-Bad 'dist desactualizado pero hay backends corriendo: use .\organigrama reiniciar todo -Compilar'
    } else { Invoke-Compilar }
  } else { Write-Ok 'backend\dist al día' }
  if ($Cual -in 'robusto', 'todo') { Start-Robusto }
  if ($Cual -in 'qa', 'todo') { Start-Qa }
  Show-Estado
}

switch ($Accion) {
  'estado'       { Show-Estado }
  'verificar'    { Invoke-Verificar; Show-Estado; Write-Veredicto }
  'detener-main' { Stop-Main; Show-Estado }
  'detener'      { Write-Host ''; Stop-Entorno $Entorno; Show-Estado }
  'iniciar'      { Invoke-Iniciar $Entorno; Write-Veredicto }
  'reiniciar'    { Write-Host ''; Stop-Entorno $Entorno; Start-Sleep -Seconds 1; Invoke-Iniciar $Entorno; Write-Veredicto }
}
