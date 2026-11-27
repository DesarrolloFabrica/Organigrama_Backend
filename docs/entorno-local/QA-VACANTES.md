> **Copia de respaldo** de `C:\dev\Organigrama\_integracion\qa-vacantes\COMO-USAR.md` (27-nov-2026). Ese entorno vive fuera de Git.
>
> - Su `.env` (`qa-vacantesackend-cwd\.env`: `PORT=3012`, base Docker `127.0.0.1:5436`, `DEV_LOGIN_ENABLED=true` **solo** para la base sintética) no se versiona.
> - Para recrearlo en otro computador: copie `.env.example`, ajuste esos valores y cree el contenedor con la estructura del QA de exportadores más los seeds `test/qa/directory-export/00`–`07` y `test/qa/vacancies/08`.
> - `backend-cwd\src` es un enlace a `_integracionackend\src`; hoy conviene apuntarlo a `_integracionackend-integrado`.

# QA aislado — plazas solicitadas (rama feat/vacantes-por-coordinacion-20261125)

Datos 100 % sintéticos. No usa el lanzador `.\organigrama` ni los puertos de robusto (5173/3001) o QA (5175/3002).

| Pieza | Valor |
|---|---|
| Frontend | http://localhost:5176 (vite dev del worktree `_integracion\frontend`) |
| Backend | http://localhost:3012 (`_integracion\backend\dist\main.js`, cwd `qa-vacantes\backend-cwd`) |
| Base | Docker `organigrama-qa-vacantes`, `127.0.0.1:5436`, `organigrama_qa`, usuario `qa` |
| Ingreso | «Acceso dev»: `desarrollofabrica@cun.edu.co` o `qa_sintetico_directora@cun.edu.co` (tiene HTML y Excel) |

La base se armó con la estructura (sin filas) del contenedor QA `organigrama-qa-exports`
más los seeds `00`–`07` de `test/qa/directory-export` y `08` de `test/qa/vacancies`.

## Arrancar (Git Bash)

```bash
docker start organigrama-qa-vacantes
cd /c/dev/Organigrama/_integracion/qa-vacantes/backend-cwd
nohup node ../../backend/dist/main.js > ../logs/backend.log 2>&1 &
cd /c/dev/Organigrama/_integracion/frontend
VITE_API_BASE_URL=http://localhost:3012 \
VITE_ORG_CHART_VERSION_ADMIN_EMAILS=qa_sintetico_directora@cun.edu.co \
  nohup npx vite --port 5176 --strictPort > ../qa-vacantes/logs/frontend.log 2>&1 &
```

`VITE_API_BASE_URL` debe ir en la línea de comandos: `.env.development.local` apunta a 3001 (producción).

## Detener

Cerrar los procesos que escuchan en 3012 y 5176 (`netstat -ano | findstr ":3012 :5176"` y `taskkill /PID <pid> /F`)
y `docker stop organigrama-qa-vacantes`. Borrar todo: `docker rm -f organigrama-qa-vacantes`.

## Capturas y resultados

`capturas\` — una captura por nodo (página completa y panel), la transición «Cargando…»,
`resultados.json` y los informes `export-rama.html` / `export-rama.xlsx`.
