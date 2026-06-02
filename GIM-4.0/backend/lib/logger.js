/**
 * SISTEMA GIM v3.0 - LOGGER
 * =========================
 * Registro estructurado de eventos del sistema.
 */

'use strict';

const fs   = require('fs-extra');
const path = require('path');
const { RUTAS } = require('./config');

const NIVELES = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const nivelActual = NIVELES[process.env.LOG_LEVEL] ?? NIVELES.INFO;

function formatearLinea(nivel, modulo, mensaje, datos) {
  const ts  = new Date().toISOString();
  const dat = datos ? ' ' + JSON.stringify(datos) : '';
  return `[${ts}] [${nivel}] [${modulo}] ${mensaje}${dat}\n`;
}

async function escribir(nivel, modulo, mensaje, datos) {
  if (NIVELES[nivel] < nivelActual) return;
  const linea = formatearLinea(nivel, modulo, mensaje, datos);
  process.stdout.write(linea);
  try {
    await fs.ensureDir(RUTAS.LOGS_DIR);
    await fs.appendFile(RUTAS.LOGS_SISTEMA, linea);
  } catch (_) { /* no bloquear por errores de log */ }
}

const logger = {
  debug: (mod, msg, dat) => escribir('DEBUG', mod, msg, dat),
  info:  (mod, msg, dat) => escribir('INFO',  mod, msg, dat),
  warn:  (mod, msg, dat) => escribir('WARN',  mod, msg, dat),
  error: (mod, msg, dat) => escribir('ERROR', mod, msg, dat),
};

module.exports = logger;
