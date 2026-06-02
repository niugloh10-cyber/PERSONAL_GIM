/**
 * SISTEMA GIM v4.0 - GESTOR DE EXPEDIENTE ÚNICO DIGITAL (LEGAJO)
 * ==============================================================
 * Cada trabajador tiene un Expediente Único con código:
 *      GIM-RH-2026-000001
 *
 * Estructura física (storage/expedientes/<codigo>/):
 *      DNI, CV, Título, Certificados, Contratos, Memorandos,
 *      Informes, Evaluaciones, Asistencia, Carta de Conclusión, etc.
 *
 * Índice lógico en data/expedientes.json:
 *  { codigo, dni, apellidosNombres, fechaApertura, estado,
 *    documentos: [ { id, categoria, nombreOriginal, archivo, fecha, subidoPor } ] }
 */

'use strict';

const fs   = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

const CATEGORIAS = [
  'DNI', 'CV', 'TITULO', 'CERTIFICADOS', 'CONTRATOS', 'MEMORANDOS',
  'INFORMES', 'RESOLUCIONES', 'EVALUACIONES', 'ASISTENCIA', 'CARTA_CONCLUSION', 'OTROS',
];

/**
 * Tipos de ACTUACIÓN que alimentan la trayectoria del trabajador de forma
 * automática desde otros módulos (sin duplicar datos ni crear bases aisladas).
 */
const TIPOS_ACTUACION = [
  'CONTRATO', 'MEMORANDO', 'EVALUACION', 'CONCLUSION',
  'ASISTENCIA', 'RESOLUCION', 'INFORME', 'CERTIFICADO', 'OTRO',
];

/** Campos canónicos del trabajador que el Legajo centraliza (fuente única). */
const CAMPOS_CANONICOS = [
  'apellidosNombres', 'nombres', 'apellidos', 'nombresApellidos',
  'cip', 'cargo', 'cargoCodigo', 'estadoCivil',
  'telefono1', 'telefono2', 'telefonoFijo', 'correo',
  'barrio', 'distrito', 'provincia', 'departamento',
];

const ANIO_BASE = new Date().getFullYear(); // referencia (el correlativo recalcula por año)


function nuevoDocId() {
  return 'doc_' + crypto.randomBytes(8).toString('hex');
}

function nuevaActId() {
  return 'act_' + crypto.randomBytes(8).toString('hex');
}

/** Garantiza que todo expediente tenga la forma completa (compatibilidad). */
function _normalizar(exp) {
  if (!exp) return exp;
  if (!Array.isArray(exp.documentos)) exp.documentos = [];
  if (!Array.isArray(exp.actuaciones)) exp.actuaciones = [];
  if (!exp.datos || typeof exp.datos !== 'object') exp.datos = {};
  return exp;
}

async function _cargarIndice(rutaIndice) {
  try {
    if (await fs.pathExists(rutaIndice)) {
      return JSON.parse(await fs.readFile(rutaIndice, 'utf-8'));
    }
  } catch (_) {}
  return [];
}

async function _guardarIndice(rutaIndice, lista) {
  await fs.ensureDir(path.dirname(rutaIndice));
  await fs.writeFile(rutaIndice, JSON.stringify(lista, null, 2), 'utf-8');
}

/** Genera el siguiente código correlativo GIM-RH-AAAA-NNNNNN. */
function _siguienteCodigo(lista) {
  const anio = new Date().getFullYear();
  const delAnio = lista.filter(e => e.codigo && e.codigo.includes(`GIM-RH-${anio}`));
  let max = 0;
  delAnio.forEach(e => {
    const m = e.codigo.match(/-(\d{6})$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  const correlativo = String(max + 1).padStart(6, '0');
  return `GIM-RH-${anio}-${correlativo}`;
}

/** Lista todos los expedientes (sin contenido de archivos). */
async function listar(rutaIndice, filtros = {}) {
  let lista = await _cargarIndice(rutaIndice);
  if (filtros.dni) lista = lista.filter(e => e.dni === filtros.dni);
  if (filtros.q) {
    const q = filtros.q.toLowerCase();
    lista = lista.filter(e =>
      (e.apellidosNombres || '').toLowerCase().includes(q) ||
      (e.dni || '').includes(q) ||
      (e.codigo || '').toLowerCase().includes(q));
  }
  return lista
    .map(_normalizar)
    .sort((a, b) => (b.fechaApertura || '').localeCompare(a.fechaApertura || ''));
}

async function obtenerPorDni(rutaIndice, dni) {
  const lista = await _cargarIndice(rutaIndice);
  return _normalizar(lista.find(e => e.dni === dni) || null);
}

async function obtenerPorCodigo(rutaIndice, codigo) {
  const lista = await _cargarIndice(rutaIndice);
  return _normalizar(lista.find(e => e.codigo === codigo) || null);
}

/** Abre un expediente nuevo para un trabajador (si no existe). */
async function abrir(rutaIndice, dirExpedientes, datos) {
  if (!datos.dni || !/^\d{8}$/.test(datos.dni)) throw new Error('DNI inválido (8 dígitos)');
  const lista = await _cargarIndice(rutaIndice);
  const existente = lista.find(e => e.dni === datos.dni);
  if (existente) return existente;

  const codigo = _siguienteCodigo(lista);
  const expediente = {
    codigo,
    dni:              datos.dni,
    apellidosNombres: datos.apellidosNombres || '',
    cargo:            datos.cargo || '',
    fechaApertura:    new Date().toISOString(),
    estado:           'ACTIVO',
    datos:            {},   // datos canónicos del trabajador (fuente única)
    documentos:       [],   // archivos físicos del expediente
    actuaciones:      [],   // trayectoria automática (contratos, memos, etc.)
  };
  // Crear carpeta física
  await fs.ensureDir(path.join(dirExpedientes, codigo));
  lista.push(expediente);
  await _guardarIndice(rutaIndice, lista);
  return expediente;
}

/** Registra un documento subido en el expediente. */
async function agregarDocumento(rutaIndice, dirExpedientes, dni, doc, archivoTempPath, usuarioEmail = '') {
  const lista = await _cargarIndice(rutaIndice);
  let exp = lista.find(e => e.dni === dni);
  if (!exp) {
    exp = await abrir(rutaIndice, dirExpedientes, { dni, apellidosNombres: doc.apellidosNombres });
    // recargar
    const recar = await _cargarIndice(rutaIndice);
    exp = recar.find(e => e.dni === dni);
    lista.length = 0; recar.forEach(x => lista.push(x));
  }

  const categoria = CATEGORIAS.includes(doc.categoria) ? doc.categoria : 'OTROS';
  const docId = nuevoDocId();
  const ext = path.extname(doc.nombreOriginal || archivoTempPath) || '';
  const nombreArchivo = `${categoria}_${docId}${ext}`;
  const destino = path.join(dirExpedientes, exp.codigo, nombreArchivo);
  await fs.ensureDir(path.dirname(destino));
  await fs.move(archivoTempPath, destino, { overwrite: true });

  const registro = {
    id:            docId,
    categoria,
    nombreOriginal: doc.nombreOriginal || nombreArchivo,
    archivo:       nombreArchivo,
    descripcion:   doc.descripcion || '',
    fecha:         new Date().toISOString(),
    subidoPor:     usuarioEmail,
  };
  exp.documentos.push(registro);
  await _guardarIndice(rutaIndice, lista);
  return { expediente: exp, documento: registro };
}

/** Devuelve la ruta física de un documento del expediente. */
async function rutaDocumento(rutaIndice, dirExpedientes, codigo, docId) {
  const exp = await obtenerPorCodigo(rutaIndice, codigo);
  if (!exp) return null;
  const doc = exp.documentos.find(d => d.id === docId);
  if (!doc) return null;
  return { ruta: path.join(dirExpedientes, codigo, doc.archivo), doc };
}

async function eliminarDocumento(rutaIndice, dirExpedientes, codigo, docId) {
  const lista = await _cargarIndice(rutaIndice);
  const exp = lista.find(e => e.codigo === codigo);
  if (!exp) throw new Error('Expediente no encontrado');
  const doc = exp.documentos.find(d => d.id === docId);
  if (doc) {
    await fs.remove(path.join(dirExpedientes, codigo, doc.archivo)).catch(() => {});
    exp.documentos = exp.documentos.filter(d => d.id !== docId);
    await _guardarIndice(rutaIndice, lista);
  }
  return { ok: true };
}

async function estadisticas(rutaIndice) {
  const lista = await _cargarIndice(rutaIndice);
  const totalDocs = lista.reduce((s, e) => s + (e.documentos?.length || 0), 0);
  const totalAct  = lista.reduce((s, e) => s + (e.actuaciones?.length || 0), 0);
  return {
    totalExpedientes: lista.length,
    activos: lista.filter(e => e.estado === 'ACTIVO').length,
    totalDocumentos: totalDocs,
    totalActuaciones: totalAct,
  };
}

/* ════════════════════════════════════════════════════════════════
 *  EXPEDIENTE ÚNICO DIGITAL — REPOSITORIO CENTRAL Y TRANSVERSAL
 *  Todos los módulos consultan/actualizan al trabajador AQUÍ, evitando
 *  duplicidad de datos y bases aisladas. El legajo es dinámico,
 *  acumulativo y permanentemente actualizable.
 * ════════════════════════════════════════════════════════════════ */

/**
 * Vincula/actualiza al trabajador en su Expediente Único (lo abre si no
 * existe) y consolida sus DATOS CANÓNICOS. Es la fuente única de verdad:
 * cualquier módulo que conozca datos del trabajador debe llamarla.
 */
async function vincularTrabajador(rutaIndice, dirExpedientes, datos = {}) {
  const dni = (datos.dni || '').replace(/\D/g, '');
  if (!/^\d{8}$/.test(dni)) throw new Error('DNI inválido (8 dígitos)');

  const lista = await _cargarIndice(rutaIndice);
  let exp = lista.find(e => e.dni === dni);

  if (!exp) {
    await abrir(rutaIndice, dirExpedientes, {
      dni, apellidosNombres: datos.apellidosNombres, cargo: datos.cargo,
    });
    const recar = await _cargarIndice(rutaIndice);
    lista.length = 0; recar.forEach(x => lista.push(x));
    exp = lista.find(e => e.dni === dni);
  }
  _normalizar(exp);

  // Identidad principal (no se borra con valores vacíos)
  if (datos.apellidosNombres) exp.apellidosNombres = datos.apellidosNombres;
  if (datos.cargo)            exp.cargo = datos.cargo;

  // Soporte de orden "Nombres y Apellidos": si llegan separados, se guardan
  // ambos y se deriva el display, manteniendo apellidosNombres para los
  // documentos oficiales (formato "APELLIDOS NOMBRES").
  if (datos.nombres)   exp.datos.nombres = datos.nombres;
  if (datos.apellidos) exp.datos.apellidos = datos.apellidos;
  if (datos.nombres && datos.apellidos) {
    exp.datos.nombresApellidos = `${datos.nombres} ${datos.apellidos}`.trim();
    if (!datos.apellidosNombres) exp.apellidosNombres = `${datos.apellidos} ${datos.nombres}`.trim();
  }

  // Consolidar datos canónicos (merge no destructivo)
  CAMPOS_CANONICOS.forEach(k => {
    if (datos[k] !== undefined && datos[k] !== null && datos[k] !== '') exp.datos[k] = datos[k];
  });
  exp.datos.ultimaActualizacion = new Date().toISOString();

  await _guardarIndice(rutaIndice, lista);
  return exp;
}

/**
 * Incorpora una ACTUACIÓN a la trayectoria del trabajador (abre el
 * expediente si hace falta). Evita duplicados por `referencia` estable.
 *   act = { tipo, titulo, detalle, referencia, fecha, origen, usuario,
 *           apellidosNombres }
 */
async function agregarActuacion(rutaIndice, dirExpedientes, dni, act = {}) {
  dni = (dni || '').replace(/\D/g, '');
  if (!/^\d{8}$/.test(dni)) throw new Error('DNI inválido (8 dígitos)');

  const lista = await _cargarIndice(rutaIndice);
  let exp = lista.find(e => e.dni === dni);
  if (!exp) {
    await abrir(rutaIndice, dirExpedientes, { dni, apellidosNombres: act.apellidosNombres });
    const recar = await _cargarIndice(rutaIndice);
    lista.length = 0; recar.forEach(x => lista.push(x));
    exp = lista.find(e => e.dni === dni);
  }
  _normalizar(exp);

  // Dedup por referencia (idempotente ante reintentos/sincronizaciones)
  if (act.referencia && exp.actuaciones.some(a => a.referencia === act.referencia)) {
    return { expediente: exp, actuacion: exp.actuaciones.find(a => a.referencia === act.referencia), duplicado: true };
  }

  const tipo = TIPOS_ACTUACION.includes(act.tipo) ? act.tipo : 'OTRO';
  const registro = {
    id:        nuevaActId(),
    tipo,
    titulo:    act.titulo || tipo,
    detalle:   act.detalle || '',
    referencia: act.referencia || null,
    fecha:     act.fecha || new Date().toISOString(),
    origen:    act.origen || '',
    usuario:   act.usuario || '',
    creado:    new Date().toISOString(),
  };
  exp.actuaciones.push(registro);
  await _guardarIndice(rutaIndice, lista);
  return { expediente: exp, actuacion: registro };
}

/**
 * Trayectoria integral: fusiona documentos + actuaciones en una sola línea
 * de tiempo ordenada cronológicamente (de lo más reciente a lo más antiguo).
 */
async function obtenerTrayectoria(rutaIndice, codigo) {
  const exp = await obtenerPorCodigo(rutaIndice, codigo);
  if (!exp) return null;

  const eventosDoc = (exp.documentos || []).map(d => ({
    clase: 'DOCUMENTO',
    tipo: d.categoria,
    titulo: d.nombreOriginal,
    detalle: d.descripcion || '',
    fecha: d.fecha,
    usuario: d.subidoPor || '',
    refId: d.id,
  }));
  const eventosAct = (exp.actuaciones || []).map(a => ({
    clase: 'ACTUACION',
    tipo: a.tipo,
    titulo: a.titulo,
    detalle: a.detalle || '',
    fecha: a.fecha,
    usuario: a.usuario || '',
    origen: a.origen || '',
    refId: a.id,
  }));

  const timeline = [...eventosDoc, ...eventosAct]
    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

  return { expediente: exp, timeline };
}

/**
 * SINCRONIZACIÓN MASIVA — genera/actualiza el Expediente Único de TODO el
 * personal existente, comunicándose por DNI. Opera en memoria y guarda una
 * sola vez (idempotente: re-ejecutarla no duplica). Integra el legajo con el
 * resto del sistema sin bases aisladas.
 *
 *   fuentes = { trabajadores:[], registros:[], contratos:[], evaluaciones:[] }
 */
async function sincronizarMasivo(rutaIndice, dirExpedientes, fuentes = {}) {
  const lista = await _cargarIndice(rutaIndice);
  lista.forEach(_normalizar);
  const porDni = new Map(lista.map(e => [e.dni, e]));
  const refsExistentes = new Set();
  lista.forEach(e => (e.actuaciones || []).forEach(a => { if (a.referencia) refsExistentes.add(a.referencia); }));

  let nuevosExp = 0, nuevasAct = 0, actualizados = 0;

  const dniValido = (d) => /^\d{8}$/.test(String(d || '').replace(/\D/g, ''));
  const limpiarDni = (d) => String(d || '').replace(/\D/g, '');

  function asegurarExp(dni, datosBase = {}) {
    dni = limpiarDni(dni);
    let exp = porDni.get(dni);
    if (!exp) {
      const codigo = _siguienteCodigo(lista);
      exp = {
        codigo, dni,
        apellidosNombres: datosBase.apellidosNombres || '',
        cargo: datosBase.cargo || '',
        fechaApertura: new Date().toISOString(),
        estado: 'ACTIVO',
        datos: {}, documentos: [], actuaciones: [],
      };
      lista.push(exp);
      porDni.set(dni, exp);
      nuevosExp++;
    }
    return exp;
  }

  function consolidar(exp, datos) {
    let cambio = false;
    if (datos.apellidosNombres && !exp.apellidosNombres) { exp.apellidosNombres = datos.apellidosNombres; cambio = true; }
    if (datos.cargo && !exp.cargo) { exp.cargo = datos.cargo; cambio = true; }
    CAMPOS_CANONICOS.forEach(k => {
      if (datos[k] !== undefined && datos[k] !== null && datos[k] !== '' && exp.datos[k] === undefined) {
        exp.datos[k] = datos[k]; cambio = true;
      }
    });
    if (cambio) { exp.datos.ultimaActualizacion = new Date().toISOString(); actualizados++; }
  }

  function pushAct(exp, act) {
    if (act.referencia && refsExistentes.has(act.referencia)) return;
    const reg = {
      id: nuevaActId(),
      tipo: TIPOS_ACTUACION.includes(act.tipo) ? act.tipo : 'OTRO',
      titulo: act.titulo || act.tipo,
      detalle: act.detalle || '',
      referencia: act.referencia || null,
      fecha: act.fecha || new Date().toISOString(),
      origen: act.origen || 'Sincronización',
      usuario: act.usuario || '',
      creado: new Date().toISOString(),
    };
    exp.actuaciones.push(reg);
    if (reg.referencia) refsExistentes.add(reg.referencia);
    nuevasAct++;
  }

  // 1) Ficha de trabajadores (datos canónicos)
  (fuentes.trabajadores || []).forEach(t => {
    if (!dniValido(t.dni)) return;
    const exp = asegurarExp(t.dni, { apellidosNombres: t.apellidosNombres });
    consolidar(exp, {
      apellidosNombres: t.apellidosNombres, cip: t.cip, estadoCivil: t.estadoCivil,
      telefono1: t.telefono1, telefono2: t.telefono2, telefonoFijo: t.telefonoFijo,
      correo: t.correo, barrio: t.barrio, distrito: t.distrito,
      provincia: t.provincia, departamento: t.departamento,
    });
  });

  // 2) Registros (memorandos)
  (fuentes.registros || []).forEach(r => {
    if (!dniValido(r.dni)) return;
    const exp = asegurarExp(r.dni, { apellidosNombres: r.apellidosNombres, cargo: r.cargoNombre });
    consolidar(exp, { apellidosNombres: r.apellidosNombres, cargo: r.cargoNombre, correo: r.correo, telefono1: r.telefono1 });
    pushAct(exp, {
      tipo: 'MEMORANDO',
      titulo: `Memorándum N° ${r.numeroMemorandum}`,
      detalle: `${r.cargoNombre || ''} — ${r.proyecto || ''}`.trim(),
      referencia: `MEMO:${limpiarDni(r.dni)}:${r.numeroMemorandum}`,
      fecha: r.fechaMemorandum || r.fechaCreacion,
      origen: 'Gestión Documental',
    });
  });

  // 3) Contratos
  (fuentes.contratos || []).forEach(c => {
    if (!dniValido(c.dni)) return;
    const exp = asegurarExp(c.dni, { apellidosNombres: c.apellidosNombres, cargo: c.cargoNombre });
    consolidar(exp, { apellidosNombres: c.apellidosNombres, cargo: c.cargoNombre, cargoCodigo: c.cargoCodigo });
    pushAct(exp, {
      tipo: 'CONTRATO',
      titulo: `Contrato — ${c.cargoNombre || ''}`.trim(),
      detalle: `CUI ${c.cui || '—'} · ${c.proyecto || ''} · ${c.estado || ''}`.trim(),
      referencia: `CONTRATO:${limpiarDni(c.dni)}:${c.id || c.numeroMemo || ''}`,
      fecha: c.fechaInicio || c.fechaRegistroSys,
      origen: 'Personal',
    });
  });

  // 4) Evaluaciones
  (fuentes.evaluaciones || []).forEach(ev => {
    if (!dniValido(ev.dni)) return;
    const exp = asegurarExp(ev.dni, { apellidosNombres: ev.apellidosNombres });
    pushAct(exp, {
      tipo: 'EVALUACION',
      titulo: `Evaluación de desempeño${ev.periodo ? ' — ' + ev.periodo : ''}`,
      detalle: `Puntaje: ${ev.puntaje || '—'}${ev.calificacion ? ' · ' + ev.calificacion : ''}`,
      referencia: ev.id ? `EVAL:${ev.id}` : null,
      fecha: ev.fecha,
      origen: 'Evaluaciones',
    });
  });

  // Asegurar carpetas físicas de expedientes nuevos
  for (const exp of lista) {
    try { await fs.ensureDir(path.join(dirExpedientes, exp.codigo)); } catch (_) {}
  }

  await _guardarIndice(rutaIndice, lista);
  return { totalExpedientes: lista.length, nuevosExpedientes: nuevosExp, nuevasActuaciones: nuevasAct, expedientesActualizados: actualizados };
}

module.exports = {
  CATEGORIAS, TIPOS_ACTUACION, CAMPOS_CANONICOS,
  listar, obtenerPorDni, obtenerPorCodigo, abrir,
  agregarDocumento, rutaDocumento, eliminarDocumento, estadisticas,
  vincularTrabajador, agregarActuacion, obtenerTrayectoria, sincronizarMasivo,
};
