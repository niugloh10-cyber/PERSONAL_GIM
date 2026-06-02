/**
 * SISTEMA GIM v3.4 - GESTOR DE PERSONAL
 * =======================================
 * Gestión completa del personal de obras:
 * - Contratos (ingreso, término, estado)
 * - Alertas automáticas (contratos por vencer)
 * - Historial por trabajador
 * - Estadísticas para dashboard gerencial
 */
'use strict';

const ExcelJS = require('exceljs');
const fs      = require('fs-extra');
const path    = require('path');

// ─── Columnas hoja Contratos ───────────────────────────────────
const COLUMNAS_CONTRATOS = [
  { header: 'ID Contrato',         key: 'id',               width: 16 },
  { header: 'DNI',                 key: 'dni',              width: 12 },
  { header: 'Apellidos y Nombres', key: 'apellidosNombres', width: 38 },
  { header: 'Cargo Código',        key: 'cargoCodigo',      width: 12 },
  { header: 'Cargo Nombre',        key: 'cargoNombre',      width: 30 },
  { header: 'CUI Proyecto',        key: 'cui',              width: 14 },
  { header: 'Proyecto',            key: 'proyecto',         width: 50 },
  { header: 'Componente',          key: 'componente',       width: 24 },
  { header: 'Fecha Inicio',        key: 'fechaInicio',      width: 14 },
  { header: 'Fecha Término',       key: 'fechaTermino',     width: 14 },
  { header: 'Estado',              key: 'estado',           width: 12 },
  { header: 'N° Memorándum',       key: 'numeroMemo',       width: 14 },
  { header: 'N° Resolución',       key: 'numeroResolucion', width: 18 },
  { header: 'Monto Mensual',       key: 'monto',            width: 14 },
  { header: 'Funciones',           key: 'funciones',        width: 50 },
  { header: 'Observaciones',       key: 'observaciones',    width: 30 },
  { header: 'Alertado',            key: 'alertado',         width: 10 },
  { header: 'Registrado Por',      key: 'registradoPor',    width: 22 },
  { header: 'Fecha Registro',      key: 'fechaRegistroSys', width: 20 },
  { header: 'Última Actualización',key: 'ultimaActualizacion', width: 20 },
];

// ─── Columnas hoja Evaluaciones ───────────────────────────────
const COLUMNAS_EVALUACIONES = [
  { header: 'ID',                  key: 'id',               width: 16 },
  { header: 'DNI',                 key: 'dni',              width: 12 },
  { header: 'Apellidos y Nombres', key: 'apellidosNombres', width: 38 },
  { header: 'ID Contrato',         key: 'idContrato',       width: 16 },
  { header: 'Proyecto',            key: 'proyecto',         width: 40 },
  { header: 'Periodo',             key: 'periodo',          width: 14 },
  { header: 'Puntaje',             key: 'puntaje',          width: 10 },
  { header: 'Calificación',        key: 'calificacion',     width: 16 },
  { header: 'Comentarios',         key: 'comentarios',      width: 40 },
  { header: 'Evaluador',           key: 'evaluador',        width: 24 },
  { header: 'Fecha',               key: 'fecha',            width: 16 },
];

// ─── Estilo cabecera ──────────────────────────────────────────
function estilarCabecera(sheet, color = 'FF1F4E79') {
  sheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
  });
  sheet.getRow(1).height = 28;
}

// ─── Asegurar hojas en el workbook ────────────────────────────
async function _asegurarHojas(rutaExcel) {
  await fs.ensureDir(path.dirname(rutaExcel));
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema GIM v3.4 - MPP';

  if (await fs.pathExists(rutaExcel)) {
    await workbook.xlsx.readFile(rutaExcel);
  }

  if (!workbook.getWorksheet('Contratos')) {
    const sh = workbook.addWorksheet('Contratos', { views: [{ state:'frozen', ySplit:1 }] });
    sh.columns = COLUMNAS_CONTRATOS;
    estilarCabecera(sh, 'FF1F4E79');
  }
  if (!workbook.getWorksheet('Evaluaciones')) {
    const sh = workbook.addWorksheet('Evaluaciones', { views: [{ state:'frozen', ySplit:1 }] });
    sh.columns = COLUMNAS_EVALUACIONES;
    estilarCabecera(sh, 'FF2E7D32');
  }

  await workbook.xlsx.writeFile(rutaExcel);
  return workbook;
}

function _leerHoja(sheet, columnas) {
  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = {};
    columnas.forEach((col, idx) => {
      let v = row.getCell(idx + 1).value;
      if (v && typeof v === 'object' && v.text) v = v.text;
      if (v && v.result !== undefined) v = v.result;
      obj[col.key] = v !== null && v !== undefined ? String(v) : '';
    });
    obj._rowNumber = rowNumber;
    rows.push(obj);
  });
  return rows;
}

function _escribirFila(sheet, columnas, datos) {
  sheet.columns = columnas;
  const fila = columnas.map(col => datos[col.key] ?? '');
  const row  = sheet.addRow(fila);
  row.eachCell(cell => {
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = {
      top:{style:'thin',color:{argb:'FFCCCCCC'}}, bottom:{style:'thin',color:{argb:'FFCCCCCC'}},
      left:{style:'thin',color:{argb:'FFCCCCCC'}}, right:{style:'thin',color:{argb:'FFCCCCCC'}},
    };
  });
  return row;
}

// ─── Generar ID único ─────────────────────────────────────────
function generarId(prefijo = 'C') {
  return `${prefijo}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// ─── Días entre dos fechas ────────────────────────────────────
function diasEntre(fechaA, fechaB) {
  const a = new Date(fechaA);
  const b = new Date(fechaB);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// ════════════════════════════════════════════════════════════════
//  CONTRATOS
// ════════════════════════════════════════════════════════════════

/**
 * Lista todos los contratos
 */
async function listarContratos(rutaExcel) {
  const wb = await _asegurarHojas(rutaExcel);
  const sheet = wb.getWorksheet('Contratos');
  const contratos = _leerHoja(sheet, COLUMNAS_CONTRATOS);
  // Enriquecer con días restantes y estado calculado
  const hoy = new Date();
  return contratos.map(c => {
    const fin = c.fechaTermino ? new Date(c.fechaTermino) : null;
    const dias = fin ? diasEntre(hoy.toISOString().split('T')[0], c.fechaTermino) : null;
    return { ...c, diasRestantes: dias, estadoCalc: calcularEstado(c, dias) };
  });
}

function calcularEstado(c, dias) {
  if (c.estado === 'CONCLUIDO' || c.estado === 'RESCINDIDO') return c.estado;
  if (dias === null) return c.estado || 'ACTIVO';
  if (dias < 0) return 'VENCIDO';
  if (dias <= 7)  return 'POR_VENCER';
  if (dias <= 30) return 'PROXIMO_VENCER';
  return 'ACTIVO';
}

/**
 * Registra un nuevo contrato
 */
async function registrarContrato(rutaExcel, datos, usuarioEmail) {
  const wb = await _asegurarHojas(rutaExcel);
  const sheet = wb.getWorksheet('Contratos');

  const contrato = {
    id:               generarId('C'),
    dni:              datos.dni,
    apellidosNombres: (datos.apellidosNombres || '').toUpperCase(),
    cargoCodigo:      datos.cargoCodigo || '',
    cargoNombre:      (datos.cargoNombre || '').toUpperCase(),
    cui:              datos.cui || '',
    proyecto:         (datos.proyecto || '').toUpperCase(),
    componente:       datos.componente || '',
    fechaInicio:      datos.fechaInicio || '',
    fechaTermino:     datos.fechaTermino || '',
    estado:           'ACTIVO',
    numeroMemo:       datos.numeroMemo || '',
    numeroResolucion: datos.numeroResolucion || '',
    monto:            datos.monto || '',
    funciones:        datos.funciones || '',
    observaciones:    datos.observaciones || '',
    alertado:         'NO',
    registradoPor:    usuarioEmail || 'SISTEMA',
    fechaRegistroSys: new Date().toLocaleString('es-PE'),
    ultimaActualizacion: new Date().toLocaleString('es-PE'),
  };

  _escribirFila(sheet, COLUMNAS_CONTRATOS, contrato);
  await wb.xlsx.writeFile(rutaExcel);
  return contrato;
}

/**
 * Actualiza un contrato por ID
 */
async function actualizarContrato(rutaExcel, idContrato, datos) {
  const wb = await _asegurarHojas(rutaExcel);
  const sheet = wb.getWorksheet('Contratos');
  let actualizado = null;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const idCell = row.getCell(1).value;
    if (String(idCell) === String(idContrato)) {
      COLUMNAS_CONTRATOS.forEach((col, idx) => {
        if (datos[col.key] !== undefined && col.key !== 'id') {
          row.getCell(idx + 1).value = datos[col.key];
        }
      });
      row.getCell(COLUMNAS_CONTRATOS.findIndex(c => c.key === 'ultimaActualizacion') + 1).value
        = new Date().toLocaleString('es-PE');
      row.commit();
      actualizado = { id: idContrato, ...datos };
    }
  });

  if (!actualizado) throw new Error(`Contrato ${idContrato} no encontrado`);
  await wb.xlsx.writeFile(rutaExcel);
  return actualizado;
}

/**
 * Cambia el estado de un contrato (ACTIVO, CONCLUIDO, RESCINDIDO)
 */
async function cambiarEstadoContrato(rutaExcel, idContrato, nuevoEstado, observacion) {
  return actualizarContrato(rutaExcel, idContrato, {
    estado: nuevoEstado,
    observaciones: observacion || '',
  });
}

/**
 * Obtiene contratos próximos a vencer (dentro de `dias` días)
 */
async function obtenerAlertasVencimiento(rutaExcel, diasUmbral = 30) {
  const contratos = await listarContratos(rutaExcel);
  return contratos.filter(c =>
    c.estadoCalc === 'POR_VENCER' || c.estadoCalc === 'PROXIMO_VENCER' || c.estadoCalc === 'VENCIDO'
  ).sort((a, b) => (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999));
}

/**
 * Historial completo de un trabajador (por DNI)
 */
async function historialTrabajador(rutaExcel, dni) {
  const todos = await listarContratos(rutaExcel);
  const contratos = todos.filter(c => c.dni === dni);

  // Calcular totales
  let diasTotales = 0;
  contratos.forEach(c => {
    if (c.fechaInicio && c.fechaTermino) {
      const d = diasEntre(c.fechaInicio, c.fechaTermino);
      if (d > 0) diasTotales += d;
    }
  });

  const obras    = [...new Set(contratos.map(c => c.proyecto).filter(Boolean))];
  const cargos   = [...new Set(contratos.map(c => c.cargoNombre).filter(Boolean))];

  return { contratos, obras, cargos, diasTotales };
}

// ════════════════════════════════════════════════════════════════
//  EVALUACIONES
// ════════════════════════════════════════════════════════════════

async function listarEvaluaciones(rutaExcel, dni = null) {
  const wb    = await _asegurarHojas(rutaExcel);
  const sheet = wb.getWorksheet('Evaluaciones');
  const evs   = _leerHoja(sheet, COLUMNAS_EVALUACIONES);
  return dni ? evs.filter(e => e.dni === dni) : evs;
}

async function registrarEvaluacion(rutaExcel, datos, evaluador) {
  const wb    = await _asegurarHojas(rutaExcel);
  const sheet = wb.getWorksheet('Evaluaciones');

  const puntaje = parseFloat(datos.puntaje) || 0;
  const ev = {
    id:               generarId('E'),
    dni:              datos.dni,
    apellidosNombres: (datos.apellidosNombres || '').toUpperCase(),
    idContrato:       datos.idContrato || '',
    proyecto:         datos.proyecto || '',
    periodo:          datos.periodo || new Date().toISOString().substring(0, 7),
    puntaje:          String(puntaje),
    calificacion:     puntaje >= 90 ? 'EXCELENTE' : puntaje >= 75 ? 'BUENO' : puntaje >= 60 ? 'REGULAR' : 'DEFICIENTE',
    comentarios:      datos.comentarios || '',
    evaluador:        evaluador || 'SISTEMA',
    fecha:            new Date().toLocaleString('es-PE'),
  };

  _escribirFila(sheet, COLUMNAS_EVALUACIONES, ev);
  await wb.xlsx.writeFile(rutaExcel);
  return ev;
}

// ════════════════════════════════════════════════════════════════
//  DASHBOARD GERENCIAL
// ════════════════════════════════════════════════════════════════

async function obtenerEstadisticas(rutaExcel) {
  const contratos     = await listarContratos(rutaExcel);
  const evaluaciones  = await listarEvaluaciones(rutaExcel);
  const hoy           = new Date().toISOString().split('T')[0];

  const activos     = contratos.filter(c => c.estadoCalc === 'ACTIVO' || c.estadoCalc === 'POR_VENCER' || c.estadoCalc === 'PROXIMO_VENCER');
  const porVencer   = contratos.filter(c => c.estadoCalc === 'POR_VENCER' || c.estadoCalc === 'PROXIMO_VENCER');
  const vencidos    = contratos.filter(c => c.estadoCalc === 'VENCIDO');
  const concluidos  = contratos.filter(c => c.estado === 'CONCLUIDO');

  // Personal por obra (solo activos)
  const porObra = {};
  activos.forEach(c => {
    const key = c.proyecto || 'Sin proyecto';
    if (!porObra[key]) porObra[key] = { proyecto: key, cui: c.cui, cantidad: 0, personas: [] };
    porObra[key].cantidad++;
    if (!porObra[key].personas.includes(c.apellidosNombres))
      porObra[key].personas.push(c.apellidosNombres);
  });

  // Alertas próximas 7 días
  const alertas7d = porVencer.filter(c => (c.diasRestantes ?? 999) <= 7);
  // Alertas 8-30 días
  const alertas30d = porVencer.filter(c => (c.diasRestantes ?? 999) > 7);

  // Funciones pendientes (contratos activos sin conclusión)
  const funcionesPendientes = activos.filter(c =>
    c.funciones && c.estado === 'ACTIVO'
  ).length;

  return {
    totalContratos:   contratos.length,
    personalActivo:   activos.length,
    porVencer:        porVencer.length,
    vencidos:         vencidos.length,
    concluidos:       concluidos.length,
    alertas7d:        alertas7d.length,
    alertas30d:       alertas30d.length,
    funcionesPendientes,
    porObra:          Object.values(porObra).sort((a,b) => b.cantidad - a.cantidad),
    proximosVencer:   porVencer.slice(0, 10),
    totalEvaluaciones: evaluaciones.length,
  };
}

module.exports = {
  listarContratos,
  registrarContrato,
  actualizarContrato,
  cambiarEstadoContrato,
  obtenerAlertasVencimiento,
  historialTrabajador,
  listarEvaluaciones,
  registrarEvaluacion,
  obtenerEstadisticas,
  COLUMNAS_CONTRATOS,
  COLUMNAS_EVALUACIONES,
  diasEntre,
};
