# Entorno local de Organigrama (copias de respaldo)

Estos archivos viven **fuera** de los repositorios, en el computador donde se montó el entorno el 23-nov-2026. Se versionan aquí solo como respaldo, para reconstruir el mismo entorno en otro computador. No contienen credenciales; el único correo que aparece es uno sintético de QA.

| Archivo aquí | Ubicación original | Para qué sirve |
|---|---|---|
| `organigrama.cmd` | `C:\dev\Organigrama\organigrama.cmd` | Comando `.\organigrama estado / iniciar / detener / verificar` |
| `organigrama-dev.ps1` | `C:\dev\Organigrama\_integracion\organigrama-dev.ps1` | Lógica del comando: arranca y verifica el robusto (:5173 → :3001) y QA (:5175 → :3002) |
| `COMO-INICIAR.md` | `C:\dev\Organigrama\_integracion\COMO-INICIAR.md` | Guía completa: entornos, puertos, OAuth y qué hacer si arranca `main` por error |
| `organigrama-robusto.code-workspace` | `C:\dev\Organigrama\organigrama-robusto.code-workspace` | Workspace de VS Code o Cursor con los worktrees robustos |
| `vscode-tasks.json` | `C:\dev\Organigrama\.vscode\tasks.json` | Tareas «Organigrama: …» de VS Code |
| `QA-VACANTES.md` | `C:\dev\Organigrama\_integracion\qa-vacantes\COMO-USAR.md` | QA sintético de vacantes: Docker 5436, backend 3012 y frontend 5176 |
| `RECUPERAR-EN-OTRO-COMPUTADOR.md` | (solo aquí) | Procedimiento para recuperar todo en otro computador |

## Supuestos del lanzador

- Las rutas son fijas: `C:\dev\Organigrama\_integracion\{backend,frontend,qa-backend,logs}`.
- El lanzador espera que `_integracion\backend` y `_integracion\frontend` estén en la rama `integracion/organigrama-exportadores-20261123`. Es la versión robusta base: backend `d060340` y frontend `16b490d`.
  - **No arranca** el worktree del rediseño (`_integracion\backend-html`). Para probar el rediseño contra datos reales, ver `docs/CONTINUIDAD-ORGANIGRAMA.md` §6.
  - **Desfase desde el 26-nov-2026:** esos worktrees están en `feat/vacantes-por-coordinacion-20261125`, así que `verificar` puede marcar la rama como inesperada.
  - Tampoco conoce la rama base `integracion/organigrama-20261127` (`_integracion\backend-integrado`). Para trabajar con ella, use `docs/CONTINUIDAD-ORGANIGRAMA.md` §6.1.
- El backend robusto lee `_integracion\backend\.env`, que no está en Git.
  - Debe tener `PORT=3001`, `DEV_LOGIN_ENABLED=false`, `API_PUBLIC_BASE_URL=http://localhost:3001` y `CORS_ORIGIN=http://localhost:5173,http://localhost:5174`.
  - Las rutas de credenciales de Google deben ser absolutas y estar fuera de Git.
- El frontend lee `_integracion\frontend\.env.development.local` con `VITE_API_BASE_URL=http://localhost:3001`.
- QA necesita Docker (contenedor `organigrama-qa-exports`, PostgreSQL en `127.0.0.1:5434`) y `_integracion\qa-backend\.env`.

## Restaurar en otro computador

Solo copiar si el archivo **no existe** ya en el destino:

```powershell
$Base = 'C:\dev\Organigrama'
$Docs = "$Base\_integracion\backend-html\docs\entorno-local"   # worktree con esta rama
$Mapa = @{
  'organigrama.cmd'                    = "$Base\organigrama.cmd"
  'organigrama-robusto.code-workspace' = "$Base\organigrama-robusto.code-workspace"
  'vscode-tasks.json'                  = "$Base\.vscode\tasks.json"
  'organigrama-dev.ps1'                = "$Base\_integracion\organigrama-dev.ps1"
  'COMO-INICIAR.md'                    = "$Base\_integracion\COMO-INICIAR.md"
}
foreach ($k in $Mapa.Keys) {
  $dest = $Mapa[$k]
  if (Test-Path $dest) { "YA EXISTE, no se toca: $dest" }
  else { New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null; Copy-Item "$Docs\$k" $dest; "copiado: $dest" }
}
```
