/**
 * SISTEMA GIM v4.1 - GESTOR DE VACACIONES Y LICENCIAS
 * ====================================================
 * Control de solicitudes de vacaciones y licencias del personal.
 * Almacenamiento: data/vacaciones.json
 *
 * Registro: { id, dni, apellidosNombres, tipo, fechaInicio, fechaFin,
 *             diasSolicitados, estado, motivoSolicitud, motivoRechazo,
 *             aprobadoPor, creadoPor, fechaCreacion, fechaActualizacion }
 */

'use strict';

const fs     = require('fs-extra');
const crypto = require('crypto');
const path   = require('path');
const logger = require('./logger');

const MOD = 'vacacionesManager';

const TIPOS = [
  'VACACIONES',
  'LICENCIA_CON_GOCE',
  'LICENCIA_SIN_GOCE',
  'PERMISO_PERSONAL',
  'MATERNIDAD',
  'PATERNIDAD',
  'DUELO',
  'ENFERMEDAD'
];

const ESTADOS = ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'ANULADA'];

function nuevoId() {
  return 'vac_' + crypto.randomBytes(8).toString('hex');
}

// ── Cola de escritura por ruta ────────────────────────────────
const _colas = new Map();

function _encolar(ruta, fn) {
  const anterior  = _colas.get(ruta) || Promise.resolve();
  const siguiente = anterior.then(() => fn()).catch(e => { throw e; });
  _colas.set(ruta, siguiente.catch(() => {}));
  return siguiente;
}

async function _cargar(ruta) {
  try {
    if (await fs.pathExists(ruta)) {
      return JSON.parse(await fs.readFile(ruta, 'utf-8'));
    }
  } catch (_) { /* archivo corrupto -> reiniciar */ }
  return [];
}

async function _guardar(ruta, lista) {
  await fs.ensureDir(path.dirname(ruta));
  const tmp = ruta + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(lista, null, 2), 'utf-8');
  await fs.move(tmp, ruta, { overwrite: true });
}

/** Comprueba si dos rangos de fechas se solapan. */
function _solapan(ini1, fin1, ini2, fin2) {
  return ini1 <= fin2 && ini2 <= fin1;
}

// ── API pública ───────────────────────────────────────────────

/**
 * Lista solicitudes con filtros opcionales.
 * Filtros: dni, tipo, estado, desde (fechaInicio >=), hasta (fechaInicio <=)
 */
async function listar(ruta, filtros = {}) {
  let registros = await _cargar(ruta);
  if (filtros.dni)    registros = registros.filter(r => r.dni    === filtros.dni);
  if (filtros.tipo)   registros = registros.filter(r => r.tipo   === filtros.tipo);
  if (filtros.estado) registros = registros.filter(r => r.estado === filtros.estado);
  if (filtros.desde)  registros = registros.filter(r => r.fechaInicio >= filtros.desde);
  if (filtros.hasta)  registros = registros.filter(r => r.fechaInicio <= filtros.hasta);
  return registros;
}

/**
 * Crea una nueva solicitud de vacaciones/licencia.
 * Valida que no se solape con otra solicitud APROBADA del mismo DNI.
 */
async function crear(ruta, datos, usuarioEmail) {
  const { dni, apellidosNombres, tipo, fechaInicio, fechaFin,
          diasSolicitados, motivoSolicitud } = datos;

  if (!dni || !/^\d{8}$/.test(dni))
    throw new Error('DNI inválido');
  if (!TIPOS.includes(tipo))
    throw new Error('Tipo de licencia inválido: ' + tipo);
  if (!fechaInicio || !fechaFin)
    throw new Error('fechaInicio y fechaFin son obligatorios');
  if (fechaFin < fechaInicio)
    throw new Error('fechaFin no puede ser anterior a fechaInicio');

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);

    // Verificar solapamiento con solicitudes APROBADAS del mismo DNI
    const conflicto = lista.find(r =>
      r.dni === dni &&
      r.estado === 'APROBADA' &&
      _solapan(r.fechaInicio, r.fechaFin, fechaInicio, fechaFin)
    );
    if (conflicto) {
      throw new Error(
        `Conflicto con solicitud aprobada (${conflicto.id}) del ${conflicto.fechaInicio} al ${conflicto.fechaFin}`
      );
    }

    const ahora  = new Date().toISOString();
    const nuevo  = {
      id: nuevoId(),
      dni,
      apellidosNombres: apellidosNombres || '',
      tipo,
      fechaInicio,
      fechaFin,
      diasSolicitados: diasSolicitados || 0,
      estado: 'PENDIENTE',
      motivoSolicitud: motivoSolicitud || '',
      motivoRechazo: '',
      aprobadoPor: '',
      creadoPor: usuarioEmail || '',
      fechaCreacion: ahora,
      fechaActualizacion: ahora
    };
    lista.push(nuevo);
    await _guardar(ruta, lista);
    logger.info(MOD, 'Solicitud creada', { id: nuevo.id, dni, tipo });
    return nuevo;
  });
}

/** Aprueba una solicitud (PENDIENTE -> APROBADA). */
async function aprobar(ruta, id, aprobadoPor) {
  if (!id) throw new Error('id es obligatorio');

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const idx   = lista.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Solicitud no encontrada: ' + id);

    const reg = lista[idx];
    if (reg.estado !== 'PENDIENTE')
      throw new Error(`No se puede aprobar una solicitud en estado ${reg.estado}`);

    lista[idx] = {
      ...reg,
      estado: 'APROBADA',
      aprobadoPor: aprobadoPor || '',
      fechaActualizacion: new Date().toISOString()
    };
    await _guardar(ruta, lista);
    logger.info(MOD, 'Solicitud aprobada', { id, aprobadoPor });
    return lista[idx];
  });
}

/** Rechaza una solicitud (PENDIENTE -> RECHAZADA). */
async function rechazar(ruta, id, motivo, rechazadoPor) {
  if (!id) throw new Error('id es obligatorio');

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const idx   = lista.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Solicitud no encontrada: ' + id);

    const reg = lista[idx];
    if (reg.estado !== 'PENDIENTE')
      throw new Error(`No se puede rechazar una solicitud en estado ${reg.estado}`);

    lista[idx] = {
      ...reg,
      estado: 'RECHAZADA',
      motivoRechazo: motivo || '',
      aprobadoPor: rechazadoPor || '',
      fechaActualizacion: new Date().toISOString()
    };
    await _guardar(ruta, lista);
    logger.info(MOD, 'Solicitud rechazada', { id, rechazadoPor });
    return lista[idx];
  });
}

/** Anula una solicitud (solo si está PENDIENTE o APROBADA). */
async function anular(ruta, id, usuarioEmail) {
  if (!id) throw new Error('id es obligatorio');

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const idx   = lista.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Solicitud no encontrada: ' + id);

    const reg = lista[idx];
    if (!['PENDIENTE', 'APROBADA'].includes(reg.estado))
      throw new Error(`No se puede anular una solicitud en estado ${reg.estado}`);

    lista[idx] = {
      ...reg,
      estado: 'ANULADA',
      aprobadoPor: reg.aprobadoPor || usuarioEmail || '',
      fechaActualizacion: new Date().toISOString()
    };
    await _guardar(ruta, lista);
    logger.info(MOD, 'Solicitud anulada', { id, usuarioEmail });
    return lista[idx];
  });
}

/**
 * Retorna el total de días por tipo para un DNI (solo solicitudes APROBADAS).
 */
async function resumenDni(ruta, dni) {
  if (!dni || !/^\d{8}$/.test(dni))
    throw new Error('DNI inválido');

  const lista = await _cargar(ruta);
  const propias = lista.filter(r => r.dni === dni && r.estado === 'APROBADA');

  const totales = {};
  for (const tipo of TIPOS) totales[tipo] = 0;

  for (const r of propias) {
    totales[r.tipo] = (totales[r.tipo] || 0) + (r.diasSolicitados || 0);
  }

  return { dni, totalesPorTipo: totales, registros: propias };
}

/**
 * Estadísticas globales: conteos por tipo y por estado.
 */
async function estadisticas(ruta) {
  const lista = await _cargar(ruta);

  const porTipo   = {};
  const porEstado = {};

  for (const tipo   of TIPOS)   porTipo[tipo]     = 0;
  for (const estado of ESTADOS) porEstado[estado] = 0;

  for (const r of lista) {
    if (r.tipo   && porTipo[r.tipo]     !== undefined)   porTipo[r.tipo]++;
    if (r.estado && porEstado[r.estado] !== undefined) porEstado[r.estado]++;
  }

  return { total: lista.length, porTipo, porEstado };
}

module.exports = {
  TIPOS,
  ESTADOS,
  listar,
  crear,
  aprobar,
  rechazar,
  anular,
  resumenDni,
  estadisticas
};
