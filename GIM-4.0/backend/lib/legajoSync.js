/**
 * SISTEMA GIM v4.0 - SINCRONIZADOR DEL EXPEDIENTE ÚNICO
 * ======================================================
 * Reúne TODO el personal existente desde las distintas fuentes del sistema
 * (ficha de trabajadores, registros de memorandos, contratos y evaluaciones)
 * y genera/actualiza su Legajo Digital, comunicándose por DNI. Idempotente.
 */
'use strict';

const legajoMgr   = require('./legajoManager');
const excelMgr    = require('./excelManager');
const personalMgr = require('./personalManager');
const logger      = require('./logger');
const { RUTAS }   = require('./config');
const { obtenerRutaBD } = require('./dbPath');

async function sincronizarTodo() {
  const rutaBD = await obtenerRutaBD().catch(() => RUTAS.BD_DEFAULT);

  const [trabajadores, registros, contratos, evaluaciones] = await Promise.all([
    excelMgr.listarTrabajadores(rutaBD).catch(() => []),
    excelMgr.leerRegistros(rutaBD).catch(() => []),
    personalMgr.listarContratos(RUTAS.PERSONAL_BD).catch(() => []),
    personalMgr.listarEvaluaciones(RUTAS.PERSONAL_BD).catch(() => []),
  ]);

  const resumen = await legajoMgr.sincronizarMasivo(
    RUTAS.EXPEDIENTES_INDEX, RUTAS.EXPEDIENTES_DIR,
    { trabajadores, registros, contratos, evaluaciones }
  );

  logger.info('LegajoSync', 'Sincronización del Expediente Único completada', resumen);
  return resumen;
}

module.exports = { sincronizarTodo };
