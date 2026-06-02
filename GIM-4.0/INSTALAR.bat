@echo off
chcp 65001 >nul
title Instalacion - Sistema GIM v4.0
echo.
echo  Instalando dependencias de Sistema GIM v4.0 ...
echo.
node --version >nul 2>&1
if errorlevel 1 ( echo  ERROR: Node.js no esta instalado. Descargue desde https://nodejs.org & pause & exit /b 1 )
call npm install
if errorlevel 1 ( echo  ERROR durante la instalacion. & pause & exit /b 1 )
echo.
echo  Instalacion completada. Ejecute INICIAR.bat para arrancar el sistema.
echo.
pause
