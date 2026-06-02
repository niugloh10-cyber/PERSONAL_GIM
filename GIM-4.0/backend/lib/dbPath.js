/**
 * SISTEMA GIM v4.0 - HELPER: RUTA DE BASE DE DATOS ACTIVA
 * Resuelve la ruta de la BD configurada (o la por defecto).
 */
'use strict';
const { RUTAS } = require('./config');
const configMgr = require('./configManager');

async function obtenerRutaBD() {
  const config = await configMgr.cargarConfig(RUTAS.CONFIG);
  return (config.rutaBaseDatos && config.rutaBaseDatos.trim())
    ? config.rutaBaseDatos
    : RUTAS.BD_DEFAULT;
}

module.exports = { obtenerRutaBD };
