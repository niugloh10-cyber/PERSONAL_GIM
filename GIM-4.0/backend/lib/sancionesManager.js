/**
 * SISTEMA GIM v4.1 - GESTOR DE SANCIONES DISCIPLINARIAS
 * ======================================================
 * Control de sanciones disciplinarias del personal.
 * Almacenamiento: data/sanciones.json
 *
 * Registro: { id, dni, apellidosNombres, tipo, motivo, descripcion,
 *             fechaSancion, diasSuspension, estado, resolucion,
 *             creadoPor, fechaCreacion, fechaActualizacion }
 */

'use strict';

const fs     = require('fs-extra');
const crypto = require('crypto');
const path   = require('path');
const logger = require('./logger');

const MOD = 'sancionesManager';

const TIPOS = [
  'AMONESTACION_VERBAL',
  'AMONESTACION_ESCRITA',
  'SUSPENSION',
  'PAD',
  'OTRO'
];

const ESTADOS = ['VIGENTE', 'APELADA', 'ANULADA', 'CUMPLIDA'];

function nuevoId() {
  return 'san_' + crypto.randomBytes(8).toString('hex');
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

// ── API pública ───────────────────────────────────────────────

/**
 * Lista sanciones con filtros opcionales.
 * Filtros: dni, tipo, estado, desde (fechaSancion >=), hasta (fechaSancion <=)
 */
async function listar(ruta, filtros = {}) {
  let registros = await _cargar(ruta);
  if (filtros.dni)    registros = registros.filter(r => r.dni    === filtros.dni);
  if (filtros.tipo)   registros = registros.filter(r => r.tipo   === filtros.tipo);
  if (filtros.estado) registros = registros.filter(r => r.estado === filtros.estado);
  if (filtros.desde)  registros = registros.filter(r => r.fechaSancion >= filtros.desde);
  if (filtros.hasta)  registros = registros.filter(r => r.fechaSancion <= filtros.hasta);
  return registros.sort((a, b) => (b.fechaSancion || '').localeCompare(a.fechaSancion || ''));
}

/**
 * Crea una nueva sanción disciplinaria.
 */
async function crear(ruta, datos, usuarioEmail) {
  const { dni, apellidosNombres, tipo, motivo, descripcion,
          fechaSancion, diasSuspension, resolucion } = datos;

  if (!dni || !/^\d{8}$/.test(dni))
    throw new Error('DNI inválido (8 dígitos)');
  if (!TIPOS.includes(tipo))
    throw new Error('Tipo de sanción inválido: ' + tipo);
  if (!motivo || !motivo.trim())
    throw new Error('motivo es obligatorio');
  if (!fechaSancion)
    throw new Error('fechaSancion es obligatorio');

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const ahora = new Date().toISOString();

    const nuevo = {
      id: nuevoId(),
      dni,
      apellidosNombres: apellidosNombres || '',
      tipo,
      motivo: motivo.trim(),
      descripcion: descripcion || '',
      fechaSancion,
      diasSuspension: tipo === 'SUSPENSION' ? (diasSuspension || 0) : 0,
      estado: 'VIGENTE',
      resolucion: resolucion || '',
      creadoPor: usuarioEmail || '',
      fechaCreacion: ahora,
      fechaActualizacion: ahora
    };
    lista.push(nuevo);
    await _guardar(ruta, lista);
    logger.info(MOD, 'Sanción creada', { id: nuevo.id, dni, tipo });
    return nuevo;
  });
}

/**
 * Actualiza campos de una sanción existente (no permite cambiar id, dni ni fechaCreacion).
 */
async function actualizar(ruta, id, datos) {
  if (!id) throw new Error('id es obligatorio');

  const CAMPOS_PROTEGIDOS = ['id', 'dni', 'fechaCreacion', 'creadoPor'];

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const idx   = lista.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Sanción no encontrada: ' + id);

    const limpio = Object.assign({}, datos);
    for (const c of CAMPOS_PROTEGIDOS) delete limpio[c];

    if (limpio.tipo   && !TIPOS.includes(limpio.tipo))
      throw new Error('Tipo inválido: ' + limpio.tipo);
    if (limpio.estado && !ESTADOS.includes(limpio.estado))
      throw new Error('Estado inválido: ' + limpio.estado);

    lista[idx] = {
      ...lista[idx],
      ...limpio,
      fechaActualizacion: new Date().toISOString()
    };
    await _guardar(ruta, lista);
    logger.info(MOD, 'Sanción actualizada', { id });
    return lista[idx];
  });
}

/**
 * Cambia el estado de una sanción.
 * estados válidos: VIGENTE | APELADA | ANULADA | CUMPLIDA
 */
async function cambiarEstado(ruta, id, estado, usuarioEmail) {
  if (!id) throw new Error('id es obligatorio');
  if (!ESTADOS.includes(estado))
    throw new Error('Estado inválido: ' + estado);

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const idx   = lista.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Sanción no encontrada: ' + id);

    lista[idx] = {
      ...lista[idx],
      estado,
      fechaActualizacion: new Date().toISOString()
    };
    await _guardar(ruta, lista);
    logger.info(MOD, 'Estado de sanción cambiado', { id, estado, usuarioEmail });
    return lista[idx];
  });
}

/**
 * Elimina una sanción del registro.
 */
async function eliminar(ruta, id) {
  if (!id) throw new Error('id es obligatorio');

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const idx   = lista.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Sanción no encontrada: ' + id);

    lista.splice(idx, 1);
    await _guardar(ruta, lista);
    logger.info(MOD, 'Sanción eliminada', { id });
    return { ok: true };
  });
}

/**
 * Retorna el historial completo de sanciones de un trabajador.
 */
async function resumenDni(ruta, dni) {
  if (!dni || !/^\d{8}$/.test(dni))
    throw new Error('DNI inválido');

  const lista   = await _cargar(ruta);
  const propias = lista.filter(r => r.dni === dni)
                       .sort((a, b) => (b.fechaSancion || '').localeCompare(a.fechaSancion || ''));

  const porTipo   = {};
  const porEstado = {};
  for (const tipo   of TIPOS)   porTipo[tipo]     = 0;
  for (const estado of ESTADOS) porEstado[estado] = 0;

  let diasSuspensionTotal = 0;

  for (const r of propias) {
    if (r.tipo   && porTipo[r.tipo]     !== undefined) porTipo[r.tipo]++;
    if (r.estado && porEstado[r.estado] !== undefined) porEstado[r.estado]++;
    if (r.tipo === 'SUSPENSION' && r.estado !== 'ANULADA') {
      diasSuspensionTotal += r.diasSuspension || 0;
    }
  }

  return {
    dni,
    total: propias.length,
    diasSuspensionTotal,
    porTipo,
    porEstado,
    registros: propias
  };
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
    if (r.tipo   && porTipo[r.tipo]     !== undefined) porTipo[r.tipo]++;
    if (r.estado && porEstado[r.estado] !== undefined) porEstado[r.estado]++;
  }

  return { total: lista.length, porTipo, porEstado };
}

module.exports = {
  TIPOS,
  ESTADOS,
  listar,
  crear,
  actualizar,
  cambiarEstado,
  eliminar,
  resumenDni,
  estadisticas
};
