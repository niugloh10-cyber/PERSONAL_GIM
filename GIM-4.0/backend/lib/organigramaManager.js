/**
 * SISTEMA GIM v4.1 - GESTOR DE ORGANIGRAMA
 * ==========================================
 * Almacena la estructura jerárquica de la GIM en data/organigrama.json.
 *
 * Nodo: { id, nombre, cargo, dni (opcional), parentId, orden, activo, color }
 */
'use strict';

const fs     = require('fs-extra');
const crypto = require('crypto');
const path   = require('path');
const logger = require('./logger');

const MOD = 'organigramaManager';

function nuevoId() {
  return 'org_' + crypto.randomBytes(8).toString('hex');
}

async function _cargar(ruta) {
  try {
    if (await fs.pathExists(ruta)) return JSON.parse(await fs.readFile(ruta, 'utf-8'));
  } catch (_) {}
  return { nodos: [], version: 1 };
}

async function _guardar(ruta, datos) {
  await fs.ensureDir(path.dirname(ruta));
  const tmp = ruta + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(datos, null, 2), 'utf-8');
  await fs.move(tmp, ruta, { overwrite: true });
}

/** Retorna el organigrama completo. */
async function obtener(ruta) {
  const datos = await _cargar(ruta);
  return datos;
}

/** Agrega un nodo nuevo. */
async function agregarNodo(ruta, datos, usuarioEmail) {
  if (!datos.nombre) throw new Error('nombre es obligatorio');
  const doc = await _cargar(ruta);
  const nodo = {
    id:       nuevoId(),
    nombre:   String(datos.nombre).trim(),
    cargo:    String(datos.cargo || '').trim(),
    dni:      datos.dni || null,
    parentId: datos.parentId || null,
    orden:    parseInt(datos.orden) || doc.nodos.length,
    activo:   datos.activo !== false,
    color:    datos.color || '#3b82f6',
    creadoPor: usuarioEmail,
    fechaCreacion: new Date().toISOString(),
  };
  doc.nodos.push(nodo);
  await _guardar(ruta, doc);
  logger.info(MOD, 'Nodo agregado', { id: nodo.id, nombre: nodo.nombre });
  return nodo;
}

/** Actualiza un nodo existente. */
async function actualizarNodo(ruta, id, datos) {
  const doc = await _cargar(ruta);
  const idx = doc.nodos.findIndex(n => n.id === id);
  if (idx === -1) throw new Error('Nodo no encontrado');
  const n = doc.nodos[idx];
  if (datos.nombre  !== undefined) n.nombre  = String(datos.nombre).trim();
  if (datos.cargo   !== undefined) n.cargo   = String(datos.cargo).trim();
  if (datos.dni     !== undefined) n.dni     = datos.dni || null;
  if (datos.parentId !== undefined) n.parentId = datos.parentId || null;
  if (datos.orden   !== undefined) n.orden   = parseInt(datos.orden) || 0;
  if (datos.activo  !== undefined) n.activo  = Boolean(datos.activo);
  if (datos.color   !== undefined) n.color   = datos.color;
  n.fechaActualizacion = new Date().toISOString();
  doc.nodos[idx] = n;
  await _guardar(ruta, doc);
  return n;
}

/** Elimina un nodo (y re-parentea sus hijos a null). */
async function eliminarNodo(ruta, id) {
  const doc = await _cargar(ruta);
  const idx = doc.nodos.findIndex(n => n.id === id);
  if (idx === -1) throw new Error('Nodo no encontrado');
  // Re-parentear hijos al padre del nodo eliminado
  const parentId = doc.nodos[idx].parentId;
  doc.nodos = doc.nodos.filter(n => n.id !== id);
  doc.nodos.forEach(n => { if (n.parentId === id) n.parentId = parentId; });
  await _guardar(ruta, doc);
  return { ok: true };
}

/** Reemplaza el organigrama completo (importación masiva). */
async function guardarCompleto(ruta, nodos, usuarioEmail) {
  if (!Array.isArray(nodos)) throw new Error('nodos debe ser un array');
  const doc = { nodos, version: 1, actualizadoPor: usuarioEmail, fechaActualizacion: new Date().toISOString() };
  await _guardar(ruta, doc);
  logger.info(MOD, 'Organigrama guardado', { nodos: nodos.length });
  return doc;
}

module.exports = { obtener, agregarNodo, actualizarNodo, eliminarNodo, guardarCompleto };
