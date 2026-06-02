/**
 * SISTEMA GIM v4.1 - GESTOR DE ACTIVOS / BIENES
 * ===============================================
 * Control de activos y bienes asignados al personal.
 * Almacenamiento: data/activos.json
 *
 * Registro: { id, codigo, descripcion, categoria, marca, modelo, serie,
 *             estado, asignadoA, apellidosNombresAsignado, fechaAsignacion,
 *             observaciones, fechaCreacion, creadoPor }
 */

'use strict';

const fs     = require('fs-extra');
const crypto = require('crypto');
const path   = require('path');
const logger = require('./logger');

const MOD = 'activosManager';

const CATEGORIAS = [
  'EQUIPO_COMPUTO',
  'MOBILIARIO',
  'VEHICULO',
  'HERRAMIENTA',
  'INSTRUMENTO',
  'OTRO'
];

const ESTADOS = ['OPERATIVO', 'EN_MANTENIMIENTO', 'DADO_DE_BAJA', 'EXTRAVIADO'];

function nuevoId() {
  return 'act_' + crypto.randomBytes(8).toString('hex');
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

/** Genera el siguiente código correlativo GIM-ACT-NNNN. */
function _generarCodigo(lista) {
  let max = 0;
  for (const a of lista) {
    const m = a.codigo && a.codigo.match(/^GIM-ACT-(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return 'GIM-ACT-' + String(max + 1).padStart(4, '0');
}

// ── API pública ───────────────────────────────────────────────

/**
 * Lista activos con filtros opcionales.
 * Filtros: dni (asignadoA), categoria, estado, q (texto libre en descripcion/codigo/serie)
 */
async function listar(ruta, filtros = {}) {
  let registros = await _cargar(ruta);
  if (filtros.dni)       registros = registros.filter(r => r.asignadoA === filtros.dni);
  if (filtros.categoria) registros = registros.filter(r => r.categoria === filtros.categoria);
  if (filtros.estado)    registros = registros.filter(r => r.estado    === filtros.estado);
  if (filtros.q) {
    const q = filtros.q.toLowerCase();
    registros = registros.filter(r =>
      (r.descripcion && r.descripcion.toLowerCase().includes(q)) ||
      (r.codigo      && r.codigo.toLowerCase().includes(q))      ||
      (r.serie       && r.serie.toLowerCase().includes(q))
    );
  }
  return registros;
}

/**
 * Crea un nuevo activo con código auto-incremental GIM-ACT-NNNN.
 */
async function crear(ruta, datos, usuarioEmail) {
  const { descripcion, categoria, marca, modelo, serie,
          estado, observaciones } = datos;

  if (!descripcion || !descripcion.trim())
    throw new Error('descripcion es obligatoria');
  if (!CATEGORIAS.includes(categoria))
    throw new Error('Categoría inválida: ' + categoria);

  return _encolar(ruta, async () => {
    const lista  = await _cargar(ruta);
    const codigo = _generarCodigo(lista);
    const ahora  = new Date().toISOString();

    const nuevo = {
      id: nuevoId(),
      codigo,
      descripcion: descripcion.trim(),
      categoria,
      marca: marca    || '',
      modelo: modelo  || '',
      serie: serie    || '',
      estado: ESTADOS.includes(estado) ? estado : 'OPERATIVO',
      asignadoA: null,
      apellidosNombresAsignado: '',
      fechaAsignacion: null,
      observaciones: observaciones || '',
      fechaCreacion: ahora,
      creadoPor: usuarioEmail || ''
    };
    lista.push(nuevo);
    await _guardar(ruta, lista);
    logger.info(MOD, 'Activo creado', { id: nuevo.id, codigo });
    return nuevo;
  });
}

/**
 * Actualiza campos de un activo existente (no permite cambiar id ni codigo).
 */
async function actualizar(ruta, id, datos) {
  if (!id) throw new Error('id es obligatorio');

  const CAMPOS_PROTEGIDOS = ['id', 'codigo', 'fechaCreacion', 'creadoPor'];

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const idx   = lista.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Activo no encontrado: ' + id);

    const limpio = Object.assign({}, datos);
    for (const c of CAMPOS_PROTEGIDOS) delete limpio[c];

    if (limpio.categoria && !CATEGORIAS.includes(limpio.categoria))
      throw new Error('Categoría inválida: ' + limpio.categoria);
    if (limpio.estado && !ESTADOS.includes(limpio.estado))
      throw new Error('Estado inválido: ' + limpio.estado);

    lista[idx] = { ...lista[idx], ...limpio };
    await _guardar(ruta, lista);
    logger.info(MOD, 'Activo actualizado', { id });
    return lista[idx];
  });
}

/**
 * Asigna un activo a un trabajador por DNI.
 */
async function asignar(ruta, id, dni, apellidosNombres, fechaAsignacion, usuarioEmail) {
  if (!id)  throw new Error('id es obligatorio');
  if (!dni || !/^\d{8}$/.test(dni)) throw new Error('DNI inválido');

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const idx   = lista.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Activo no encontrado: ' + id);

    lista[idx] = {
      ...lista[idx],
      asignadoA: dni,
      apellidosNombresAsignado: apellidosNombres || '',
      fechaAsignacion: fechaAsignacion || new Date().toISOString().slice(0, 10)
    };
    await _guardar(ruta, lista);
    logger.info(MOD, 'Activo asignado', { id, dni, usuarioEmail });
    return lista[idx];
  });
}

/**
 * Desasigna un activo (pone asignadoA = null).
 */
async function desasignar(ruta, id, usuarioEmail) {
  if (!id) throw new Error('id es obligatorio');

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const idx   = lista.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Activo no encontrado: ' + id);

    lista[idx] = {
      ...lista[idx],
      asignadoA: null,
      apellidosNombresAsignado: '',
      fechaAsignacion: null
    };
    await _guardar(ruta, lista);
    logger.info(MOD, 'Activo desasignado', { id, usuarioEmail });
    return lista[idx];
  });
}

/**
 * Elimina un activo del registro.
 */
async function eliminar(ruta, id) {
  if (!id) throw new Error('id es obligatorio');

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const idx   = lista.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Activo no encontrado: ' + id);

    lista.splice(idx, 1);
    await _guardar(ruta, lista);
    logger.info(MOD, 'Activo eliminado', { id });
    return { ok: true };
  });
}

/**
 * Estadísticas globales: conteo por categoría y por estado.
 */
async function estadisticas(ruta) {
  const lista = await _cargar(ruta);

  const porCategoria = {};
  const porEstado    = {};

  for (const cat   of CATEGORIAS) porCategoria[cat]   = 0;
  for (const est   of ESTADOS)    porEstado[est]       = 0;

  for (const r of lista) {
    if (r.categoria && porCategoria[r.categoria] !== undefined) porCategoria[r.categoria]++;
    if (r.estado    && porEstado[r.estado]        !== undefined) porEstado[r.estado]++;
  }

  const asignados = lista.filter(r => r.asignadoA).length;

  return { total: lista.length, asignados, sinAsignar: lista.length - asignados, porCategoria, porEstado };
}

module.exports = {
  CATEGORIAS,
  ESTADOS,
  listar,
  crear,
  actualizar,
  asignar,
  desasignar,
  eliminar,
  estadisticas
};
