@echo off
chcp 65001 >nul
title IMPORTAR BASE DE DATOS - SISTEMA GIM v4.0
echo.
echo  ============================================================
echo    IMPORTADOR DE BASE DE DATOS  -  SISTEMA GIM v4.0 - MPP
echo  ============================================================
echo.
node --version >nul 2>&1
if errorlevel 1 ( echo  [ERROR] Node.js no esta instalado. https://nodejs.org & pause & exit /b 1 )
if "%~1"=="" (
    echo  Uso: arrastre el archivo .xlsm/.xlsx sobre este .bat
    echo  o ejecute:  node importar_bd.js  "ruta\del\archivo.xlsx"
    echo.
    set /p ARCHIVO="  Ruta del archivo a importar: "
) else (
    set "ARCHIVO=%~1"
)
node importar_bd.js "%ARCHIVO%"
echo.
pause
