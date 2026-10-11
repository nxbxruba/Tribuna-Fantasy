@echo off
chcp 65001 >nul
echo Actualizando Fantasy, alineaciones probables y fichajes...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0actualizar-datos.ps1"
echo.
pause
