/**
 * SISTEMA GIM v4.1 - GESTOR DE CAPACITACIONES
 * ============================================
 * Control de cursos, talleres y capacitaciones del personal.
 * Almacenamiento: data/capacitaciones.json
 *
 * Registro: { id, titulo, tipo, institucion, fechaInicio, fechaFin,
 *             horas, modalidad, participantes[], creadoPor, fechaCreacion }
 * Participante: { dni, apellidosNombres, completado, nota }
 */

'use strict';

const fs     = require('fs-extra');
const crypto = require('crypto');
const path   = require('path');
const logger = require('./logger');

const MOD = 'capacitacionesManager';

const TIPOS = ['CURSO', 'TALLER', 'SEMINARIO', 'DIPLOMADO', 'INDUCCION', 'OTRO'];
const MODALIDADES = ['PRESENCIAL', 'VIRTUAL', 'SEMIPRESENCIAL'];

function nuevoId() {
  return 'cap_' + crypto.randomBytes(8).toString('hex');
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
 * Lista capacitaciones con filtros opcionales.
 * Filtros: tipo, modalidad, desde (fechaInicio >=), hasta (fechaInicio <=),
 *          dniParticipante (contiene al DNI en su lista de participantes)
 */
async function listar(ruta, filtros = {}) {
  let registros = await _cargar(ruta);
  if (filtros.tipo)       registros = registros.filter(r => r.tipo      === filtros.tipo);
  if (filtros.modalidad)  registros = registros.filter(r => r.modalidad === filtros.modalidad);
  if (filtros.desde)      registros = registros.filter(r => r.fechaInicio >= filtros.desde);
  if (filtros.hasta)      registros = registros.filter(r => r.fechaInicio <= filtros.hasta);
  if (filtros.dniParticipante) {
    const dni = filtros.dniParticipante;
    registros = registros.filter(r =>
      Array.isArray(r.participantes) && r.participantes.some(p => p.dni === dni)
    );
  }
  return registros;
}

/**
 * Crea una nueva capacitación con la lista de participantes vacía.
 */
async function crear(ruta, datos, usuarioEmail) {
  const { titulo, tipo, institucion, fechaInicio, fechaFin,
          horas, modalidad } = datos;

  if (!titulo || !titulo.trim())
    throw new Error('titulo es obligatorio');
  if (!TIPOS.includes(tipo))
    throw new Error('Tipo inválido: ' + tipo);
  if (!MODALIDADES.includes(modalidad))
    throw new Error('Modalidad inválida: ' + modalidad);
  if (!fechaInicio)
    throw new Error('fechaInicio es obligatorio');

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const ahora = new Date().toISOString();

    const nuevo = {
      id: nuevoId(),
      titulo: titulo.trim(),
      tipo,
      institucion: institucion || '',
      fechaInicio,
      fechaFin: fechaFin || '',
      horas: horas || 0,
      modalidad,
      participantes: [],
      creadoPor: usuarioEmail || '',
      fechaCreacion: ahora
    };
    lista.push(nuevo);
    await _guardar(ruta, lista);
    logger.info(MOD, 'Capacitación creada', { id: nuevo.id, titulo: nuevo.titulo });
    return nuevo;
  });
}

/**
 * Actualiza campos de una capacitación (no permite modificar id ni fechaCreacion).
 */
async function actualizar(ruta, id, datos) {
  if (!id) throw new Error('id es obligatorio');

  const CAMPOS_PROTEGIDOS = ['id', 'fechaCreacion', 'creadoPor'];

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const idx   = lista.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Capacitación no encontrada: ' + id);

    const limpio = Object.assign({}, datos);
    for (const c of CAMPOS_PROTEGIDOS) delete limpio[c];

    if (limpio.tipo      && !TIPOS.includes(limpio.tipo))
      throw new Error('Tipo inválido: ' + limpio.tipo);
    if (limpio.modalidad && !MODALIDADES.includes(limpio.modalidad))
      throw new Error('Modalidad inválida: ' + limpio.modalidad);

    // No permitir sobreescribir participantes desde aquí
    delete limpio.participantes;

    lista[idx] = { ...lista[idx], ...limpio };
    await _guardar(ruta, lista);
    logger.info(MOD, 'Capacitación actualizada', { id });
    return lista[idx];
  });
}

/**
 * Agrega o actualiza (upsert) un participante por DNI.
 * participante: { dni, apellidosNombres, completado?, nota? }
 */
async function agregarParticipante(ruta, id, participante) {
  if (!id) throw new Error('id es obligatorio');
  const { dni, apellidosNombres } = participante || {};
  if (!dni || !/^\d{8}$/.test(dni)) throw new Error('DNI inválido');

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const idx   = lista.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Capacitación no encontrada: ' + id);

    const cap   = lista[idx];
    const parts = Array.isArray(cap.participantes) ? [...cap.participantes] : [];
    const pIdx  = parts.findIndex(p => p.dni === dni);

    const entrada = {
      dni,
      apellidosNombres: apellidosNombres || (pIdx >= 0 ? parts[pIdx].apellidosNombres : ''),
      completado: participante.completado !== undefined
        ? !!participante.completado
        : (pIdx >= 0 ? parts[pIdx].completado : false),
      nota: participante.nota !== undefined
        ? participante.nota
        : (pIdx >= 0 ? parts[pIdx].nota : null)
    };

    if (pIdx >= 0) {
      parts[pIdx] = entrada;
    } else {
      parts.push(entrada);
    }

    lista[idx] = { ...cap, participantes: parts };
    await _guardar(ruta, lista);
    logger.info(MOD, 'Participante upsert', { id, dni });
    return lista[idx];
  });
}

/**
 * Actualiza los campos completado/nota de un participante existente.
 */
async function actualizarParticipante(ruta, id, dni, datos) {
  if (!id)  throw new Error('id es obligatorio');
  if (!dni || !/^\d{8}$/.test(dni)) throw new Error('DNI inválido');

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const idx   = lista.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Capacitación no encontrada: ' + id);

    const cap   = lista[idx];
    const parts = Array.isArray(cap.participantes) ? [...cap.participantes] : [];
    const pIdx  = parts.findIndex(p => p.dni === dni);
    if (pIdx === -1) throw new Error('Participante no encontrado: ' + dni);

    const permitidos = ['completado', 'nota', 'apellidosNombres'];
    for (const k of permitidos) {
      if (datos[k] !== undefined) parts[pIdx][k] = datos[k];
    }

    lista[idx] = { ...cap, participantes: parts };
    await _guardar(ruta, lista);
    logger.info(MOD, 'Participante actualizado', { id, dni });
    return lista[idx];
  });
}

/**
 * Elimina una capacitación del registro.
 */
async function eliminar(ruta, id) {
  if (!id) throw new Error('id es obligatorio');

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const idx   = lista.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Capacitación no encontrada: ' + id);

    lista.splice(idx, 1);
    await _guardar(ruta, lista);
    logger.info(MOD, 'Capacitación eliminada', { id });
    return { ok: true };
  });
}

/**
 * Resumen de todas las capacitaciones en las que participa un DNI,
 * incluyendo horas totales completadas.
 */
async function resumenDni(ruta, dni) {
  if (!dni || !/^\d{8}$/.test(dni))
    throw new Error('DNI inválido');

  const lista = await _cargar(ruta);
  const participadas = lista.filter(r =>
    Array.isArray(r.participantes) && r.participantes.some(p => p.dni === dni)
  );

  let horasTotal     = 0;
  let horasCompletadas = 0;
  const detalle = [];

  for (const cap of participadas) {
    const p = cap.participantes.find(x => x.dni === dni);
    horasTotal += cap.horas || 0;
    if (p.completado) horasCompletadas += cap.horas || 0;
    detalle.push({
      id: cap.id,
      titulo: cap.titulo,
      tipo: cap.tipo,
      institucion: cap.institucion,
      fechaInicio: cap.fechaInicio,
      fechaFin: cap.fechaFin,
      horas: cap.horas,
      modalidad: cap.modalidad,
      completado: p.completado,
      nota: p.nota
    });
  }

  return { dni, totalCapacitaciones: participadas.length, horasTotal, horasCompletadas, detalle };
}

module.exports = {
  TIPOS,
  MODALIDADES,
  listar,
  crear,
  actualizar,
  agregarParticipante,
  actualizarParticipante,
  eliminar,
  resumenDni
};
