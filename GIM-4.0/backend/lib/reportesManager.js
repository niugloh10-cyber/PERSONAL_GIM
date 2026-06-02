/**
 * SISTEMA GIM v4.0 - GESTOR DE REPORTES
 * ======================================
 * Agrega indicadores y estadísticas de todos los módulos:
 * documentos, personal/contratos, proyectos, asistencia, expedientes.
 *
 * v4.1: caché en memoria con TTL de 60 s para evitar lecturas repetidas del
 *       Excel y los JSON en cada petición al panel de inicio / reportes.
 */

'use strict';

const { RUTAS } = require('./config');
const excelMgr      = require('./excelManager');
const personalMgr   = require('./personalManager');
const proyectosMgr  = require('./proyectosManager');
const asistenciaMgr = require('./asistenciaManager');
const legajoMgr     = require('./legajoManager');
const configMgr     = require('./configManager');

// ── Caché simple con TTL ──────────────────────────────────────
const CACHE_TTL_MS = 60 * 1000; // 60 segundos
const _cache = new Map(); // clave -> { datos, expiraEn }

function _cacheGet(clave) {
  const e = _cache.get(clave);
  if (!e || Date.now() > e.expiraEn) { _cache.delete(clave); return null; }
  return e.datos;
}

function _cacheSet(clave, datos) {
  _cache.set(clave, { datos, expiraEn: Date.now() + CACHE_TTL_MS });
}

/** Invalida toda la caché de reportes (llamar tras operaciones de escritura). */
function invalidarCache() {
  _cache.clear();
}

async function _rutaBD() {
  const config = await configMgr.cargarConfig(RUTAS.CONFIG);
  return (config.rutaBaseDatos && config.rutaBaseDatos.trim()) ? config.rutaBaseDatos : RUTAS.BD_DEFAULT;
}

/** Indicadores generales del sistema (tarjetas del panel de Reportes / Inicio). */
async function indicadores() {
  const cached = _cacheGet('indicadores');
  if (cached) return cached;

  const rutaBD = await _rutaBD();
  const [registros, contratos, proyectos, statsPersonal, statsAsi, statsExp] = await Promise.all([
    excelMgr.leerRegistros(rutaBD).catch(() => []),
    personalMgr.listarContratos(RUTAS.PERSONAL_BD).catch(() => []),
    proyectosMgr.cargarProyectos(RUTAS.PROYECTOS).catch(() => []),
    personalMgr.obtenerEstadisticas(RUTAS.PERSONAL_BD).catch(() => ({})),
    asistenciaMgr.estadisticas(RUTAS.ASISTENCIA).catch(() => ({})),
    legajoMgr.estadisticas(RUTAS.EXPEDIENTES_INDEX).catch(() => ({})),
  ]);

  const contratosActivos = contratos.filter(c =>
    ['ACTIVO', 'POR_VENCER', 'PROXIMO_VENCER'].includes(c.estadoCalc || c.estado)).length;
  const proyectosActivos = proyectos.filter(p => p.activo !== false).length;

  const resultado = {
    documentos: { totalMemorandos: registros.length },
    personal: { totalContratos: contratos.length, contratosActivos, ...statsPersonal },
    proyectos: { total: proyectos.length, activos: proyectosActivos, cerrados: proyectos.length - proyectosActivos },
    asistencia: statsAsi,
    expedientes: statsExp,
  };

  _cacheSet('indicadores', resultado);
  return resultado;
}

/** Estadísticas detalladas: distribución por cargo, proyecto, estado de contrato. */
async function estadisticas() {
  const cached = _cacheGet('estadisticas');
  if (cached) return cached;

  const contratos = await personalMgr.listarContratos(RUTAS.PERSONAL_BD).catch(() => []);

  const porCargo = {};
  const porProyecto = {};
  const porEstado = {};
  contratos.forEach(c => {
    const cargo = c.cargoNombre || c.cargoCodigo || 'SIN CARGO';
    const proy  = c.proyecto || 'SIN PROYECTO';
    const est   = c.estadoCalc || c.estado || 'DESCONOCIDO';
    porCargo[cargo]   = (porCargo[cargo] || 0) + 1;
    porProyecto[proy] = (porProyecto[proy] || 0) + 1;
    porEstado[est]    = (porEstado[est] || 0) + 1;
  });

  const resultado = {
    totalContratos: contratos.length,
    porCargo:    Object.entries(porCargo).map(([k, v]) => ({ etiqueta: k, valor: v })).sort((a, b) => b.valor - a.valor),
    porProyecto: Object.entries(porProyecto).map(([k, v]) => ({ etiqueta: k, valor: v })).sort((a, b) => b.valor - a.valor),
    porEstado:   Object.entries(porEstado).map(([k, v]) => ({ etiqueta: k, valor: v })),
  };

  _cacheSet('estadisticas', resultado);
  return resultado;
}

module.exports = { indicadores, estadisticas, invalidarCache };
