@echo off
set ELEC_DIR=%~dp0node_modules\electron
set ELEC_INDEX=%ELEC_DIR%\index.js
set ELEC_BAK=%ELEC_DIR%\index.js.dev-bak

if exist "%ELEC_INDEX%" rename "%ELEC_INDEX%" index.js.dev-bak

"%ELEC_DIR%\dist\electron.exe" %~dp0

if exist "%ELEC_BAK%" rename "%ELEC_BAK%" index.js
