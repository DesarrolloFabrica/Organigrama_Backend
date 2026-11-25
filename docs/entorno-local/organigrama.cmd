@echo off
rem Organigrama - comando oficial (version robusta). Ejemplos:
rem   .\organigrama            estado
rem   .\organigrama iniciar    robusto + QA
rem   .\organigrama detener
rem Ver C:\dev\Organigrama\_integracion\COMO-INICIAR.md
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_integracion\organigrama-dev.ps1" %*
