@echo off
chcp 65001 >nul
title Sistema GIM v4.0 - Arquitectura Modular - MPP
echo.
echo  ============================================================
echo    SISTEMA GIM v4.0 - Municipalidad Provincial de Puno
echo    Arquitectura Modular Empresarial
echo  ============================================================
echo.

node --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js no esta instalado.
    echo  Descargue desde https://nodejs.org  ^(version 14 o superior^)
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo  Primera ejecucion: instalando dependencias...
    call npm install
    if errorlevel 1 ( echo  ERROR durante la instalacion. & pause & exit /b 1 )
)

echo  Iniciando servidor en http://localhost:3000 ...
echo  El navegador se abrira automaticamente. Para detener: Ctrl + C
echo.
start "" http://localhost:3000
node backend/server.js
pause
