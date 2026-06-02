/**
 * SISTEMA GIM v4.0 - GESTOR DE ASISTENCIA
 * ========================================
 * Control de asistencia del personal. Almacenamiento JSON simple
 * (data/asistencia.json) con registro diario por DNI.
 *
 * Registro: { id, dni, apellidosNombres, fecha (YYYY-MM-DD),
 *             horaEntrada, horaSalida, estado, observacion, creadoPor }
 * Estados: PRESENTE | TARDANZA | FALTA | PERMISO | VACACIONES | DESCANSO
 *
 * v4.1: cola de escritura serializada para evitar race conditions cuando
 *       llegan múltiples requests simultáneos sobre el mismo archivo JSON.
 */

'use strict';

const fs     = require('fs-extra');
const crypto = require('crypto');
const path   = require('path');

const ESTADOS = ['PRESENTE', 'TARDANZA', 'FALTA', 'PERMISO', 'VACACIONES', 'DESCANSO'];

function nuevoId() {
  return 'asi_' + crypto.randomBytes(8).toString('hex');
}

// ── Cola de escritura por ruta ────────────────────────────────
// Garantiza que solo una escritura ocurra a la vez por archivo,
// evitando corrupción de datos en peticiones concurrentes.
const _colas = new Map(); // rutaArchivo -> Promise (última en cola)

function _encolar(ruta, fn) {
  const anterior = _colas.get(ruta) || Promise.resolve();
  const siguiente = anterior.then(() => fn()).catch(e => { throw e; });
  // Guardar solo la promesa activa para no acumular cadenas infinitas
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
  // Escritura atómica: escribir en archivo temporal y renombrar
  const tmp = ruta + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(lista, null, 2), 'utf-8');
  await fs.move(tmp, ruta, { overwrite: true });
}

/** Lista registros con filtros opcionales (dni, fecha, desde, hasta, estado). */
async function listar(ruta, filtros = {}) {
  let registros = await _cargar(ruta);
  if (filtros.dni)    registros = registros.filter(r => r.dni === filtros.dni);
  if (filtros.fecha)  registros = registros.filter(r => r.fecha === filtros.fecha);
  if (filtros.desde)  registros = registros.filter(r => r.fecha >= filtros.desde);
  if (filtros.hasta)  registros = registros.filter(r => r.fecha <= filtros.hasta);
  if (filtros.estado) registros = registros.filter(r => r.estado === filtros.estado);
  return registros.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
}

/** Registra o actualiza la asistencia de un trabajador para una fecha. */
async function registrar(ruta, datos, usuarioEmail = '') {
  if (!datos.dni || !/^\d{8}$/.test(datos.dni)) throw new Error('DNI inválido (8 dígitos)');
  if (!datos.fecha) throw new Error('Fecha requerida (YYYY-MM-DD)');
  const estado = ESTADOS.includes(datos.estado) ? datos.estado : 'PRESENTE';

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const idx = lista.findIndex(r => r.dni === datos.dni && r.fecha === datos.fecha);
    const reg = {
      id:               idx >= 0 ? lista[idx].id : nuevoId(),
      dni:              datos.dni,
      apellidosNombres: datos.apellidosNombres || (idx >= 0 ? lista[idx].apellidosNombres : ''),
      fecha:            datos.fecha,
      horaEntrada:      datos.horaEntrada || '',
      horaSalida:       datos.horaSalida || '',
      estado,
      observacion:      datos.observacion || '',
      creadoPor:        usuarioEmail,
      fechaRegistro:    idx >= 0 ? lista[idx].fechaRegistro : new Date().toISOString(),
      fechaActualizacion: new Date().toISOString(),
    };
    if (idx >= 0) lista[idx] = reg; else lista.push(reg);
    await _guardar(ruta, lista);
    return reg;
  });
}

async function eliminar(ruta, id) {
  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const filtrados = lista.filter(r => r.id !== id);
    await _guardar(ruta, filtrados);
    return { ok: true, eliminados: lista.length - filtrados.length };
  });
}

/** Resumen mensual de un trabajador (conteo por estado). */
async function resumenMensual(ruta, dni, anioMes) {
  const lista = await listar(ruta, { dni });
  const delMes = anioMes ? lista.filter(r => (r.fecha || '').startsWith(anioMes)) : lista;
  const conteo = {};
  ESTADOS.forEach(e => { conteo[e] = 0; });
  delMes.forEach(r => { if (conteo[r.estado] !== undefined) conteo[r.estado]++; });
  return { dni, anioMes: anioMes || 'TODOS', total: delMes.length, conteo, registros: delMes };
}

/** Estadísticas globales de asistencia (para reportes). */
async function estadisticas(ruta) {
  const lista = await _cargar(ruta);
  const conteo = {};
  ESTADOS.forEach(e => { conteo[e] = 0; });
  lista.forEach(r => { if (conteo[r.estado] !== undefined) conteo[r.estado]++; });
  const trabajadores = new Set(lista.map(r => r.dni)).size;
  return { totalRegistros: lista.length, trabajadores, conteo };
}

module.exports = {
  ESTADOS, listar, registrar, eliminar, resumenMensual, estadisticas,
};
