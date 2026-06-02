/**
 * SISTEMA GIM v4.1 - GESTOR DE NOTIFICACIONES
 * ============================================
 * Notificaciones internas para usuarios y roles.
 * Almacenamiento: data/notificaciones.json
 *
 * Registro: { id, para, paraRol, tipo, titulo, mensaje, referencia,
 *             leida, creadaEn, leidaEn, origen }
 */

'use strict';

const fs     = require('fs-extra');
const crypto = require('crypto');
const path   = require('path');
const logger = require('./logger');

const MOD = 'notificacionesManager';

const TIPOS = [
  'CONTRATO_POR_VENCER',
  'ASISTENCIA_PENDIENTE',
  'LEGAJO_INCOMPLETO',
  'VACACION_PENDIENTE',
  'SANCION_NUEVA',
  'SISTEMA',
  'MANUAL'
];

function nuevoId() {
  return 'not_' + crypto.randomBytes(8).toString('hex');
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

/** Determina si una notificación le pertenece al usuario/rol dado. */
function _pertenece(notif, usuarioId, rol) {
  if (notif.para === null && notif.paraRol === null) return true; // broadcast a todos
  if (notif.para !== null && notif.para === usuarioId) return true;
  if (notif.paraRol !== null && notif.paraRol === rol) return true;
  return false;
}

// ── API pública ───────────────────────────────────────────────

/**
 * Lista notificaciones para el usuario/rol, más recientes primero.
 * Filtros opcionales: tipo, leida (boolean string)
 */
async function listar(ruta, usuarioId, rol, filtros = {}) {
  let registros = await _cargar(ruta);

  registros = registros.filter(n => _pertenece(n, usuarioId, rol));

  if (filtros.tipo) registros = registros.filter(n => n.tipo === filtros.tipo);
  if (filtros.leida !== undefined && filtros.leida !== '') {
    const leida = filtros.leida === 'true' || filtros.leida === true;
    registros = registros.filter(n => n.leida === leida);
  }

  return registros.sort((a, b) => (b.creadaEn || '').localeCompare(a.creadaEn || ''));
}

/**
 * Crea una nueva notificación.
 * datos: { para, paraRol, tipo, titulo, mensaje, referencia, origen }
 */
async function crear(ruta, datos) {
  const { para = null, paraRol = null, tipo, titulo, mensaje,
          referencia = null, origen = 'sistema' } = datos;

  if (!TIPOS.includes(tipo))
    throw new Error('Tipo de notificación inválido: ' + tipo);
  if (!titulo || !titulo.trim())
    throw new Error('titulo es obligatorio');
  if (!mensaje || !mensaje.trim())
    throw new Error('mensaje es obligatorio');

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const ahora = new Date().toISOString();

    const nueva = {
      id: nuevoId(),
      para,
      paraRol,
      tipo,
      titulo: titulo.trim(),
      mensaje: mensaje.trim(),
      referencia,
      leida: false,
      creadaEn: ahora,
      leidaEn: null,
      origen: origen || 'sistema'
    };

    lista.push(nueva);
    await _guardar(ruta, lista);
    logger.info(MOD, 'Notificación creada', { id: nueva.id, tipo, para, paraRol });
    return nueva;
  });
}

/**
 * Marca una notificación como leída, verificando que pertenezca al usuario.
 */
async function marcarLeida(ruta, id, usuarioId, rol) {
  if (!id) throw new Error('id es obligatorio');

  return _encolar(ruta, async () => {
    const lista = await _cargar(ruta);
    const idx   = lista.findIndex(n => n.id === id);
    if (idx === -1) throw new Error('Notificación no encontrada: ' + id);

    if (!_pertenece(lista[idx], usuarioId, rol))
      throw new Error('No tienes permiso para marcar esta notificación');

    if (lista[idx].leida) return lista[idx]; // ya estaba leída

    lista[idx] = {
      ...lista[idx],
      leida: true,
      leidaEn: new Date().toISOString()
    };
    await _guardar(ruta, lista);
    return lista[idx];
  });
}

/**
 * Marca todas las notificaciones del usuario/rol como leídas.
 */
async function marcarTodasLeidas(ruta, usuarioId, rol) {
  return _encolar(ruta, async () => {
    const lista  = await _cargar(ruta);
    const ahora  = new Date().toISOString();
    let count    = 0;

    for (let i = 0; i < lista.length; i++) {
      if (_pertenece(lista[i], usuarioId, rol) && !lista[i].leida) {
        lista[i] = { ...lista[i], leida: true, leidaEn: ahora };
        count++;
      }
    }

    if (count > 0) await _guardar(ruta, lista);
    logger.info(MOD, 'Todas leídas', { usuarioId, rol, count });
    return { marcadas: count };
  });
}

/**
 * Retorna el número de notificaciones no leídas del usuario/rol.
 */
async function contarNoLeidas(ruta, usuarioId, rol) {
  const lista = await _cargar(ruta);
  return lista.filter(n => _pertenece(n, usuarioId, rol) && !n.leida).length;
}

/**
 * Elimina notificaciones leídas con más de N días de antigüedad.
 */
async function eliminarAntiguas(ruta, diasRetener = 30) {
  return _encolar(ruta, async () => {
    const lista    = await _cargar(ruta);
    const corte    = new Date();
    corte.setDate(corte.getDate() - diasRetener);
    const corteStr = corte.toISOString();

    const antes    = lista.length;
    const filtrada = lista.filter(n => {
      if (!n.leida) return true; // conservar no leídas siempre
      return (n.leidaEn || n.creadaEn) > corteStr;
    });

    const eliminadas = antes - filtrada.length;
    if (eliminadas > 0) await _guardar(ruta, filtrada);
    logger.info(MOD, 'Notificaciones antiguas eliminadas', { eliminadas, diasRetener });
    return { eliminadas };
  });
}

module.exports = {
  TIPOS,
  listar,
  crear,
  marcarLeida,
  marcarTodasLeidas,
  contarNoLeidas,
  eliminarAntiguas
};
