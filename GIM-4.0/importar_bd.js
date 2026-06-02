/**
 * IMPORTADOR DE BASE DE DATOS HISTÓRICA → SISTEMA GIM v3.6
 * =========================================================
 * Convierte BD_2025_Y_2026_.xlsm al formato interno del sistema:
 *   1. data/base_de_datos.xlsx  → hoja "Registros"   (historial de memorandums)
 *   2. data/base_de_datos.xlsx  → hoja "Trabajadores" (datos personales únicos)
 *   3. data/personal.xlsx       → hoja "Contratos"    (contratos por obra)
 *
 * Uso:  node importar_bd.js <ruta_xlsm>
 *       node importar_bd.js BD_2025_Y_2026_.xlsm
 */
'use strict';

const ExcelJS = require('exceljs');
const path    = require('path');
const fs      = require('fs-extra');

// ── Rutas del sistema ─────────────────────────────────────────────────────────
const RUTA_ENTRADA = process.argv[2] || path.join(__dirname, 'BD_2025_Y_2026_.xlsm');
const DATA_DIR     = path.join(__dirname, 'data');
const RUTA_BD      = path.join(DATA_DIR, 'base_de_datos.xlsx');
const RUTA_PERS    = path.join(DATA_DIR, 'personal.xlsx');

// ── Colores corporativos GIM ───────────────────────────────────────────────────
const COLOR_HEADER_BD   = 'FF1F4E79';  // Azul oscuro — base_de_datos
const COLOR_HEADER_PERS = 'FF1A3C6E';  // Azul GIM — personal
const COLOR_HEADER_TRAB = 'FF2E7D32';  // Verde — Trabajadores

// ── Columnas: hoja Registros (base_de_datos.xlsx) ────────────────────────────
const COLS_REGISTROS = [
  { header: 'N°',                key: 'nro',               width: 6  },
  { header: 'Reg. N°',           key: 'regNumero',          width: 12 },
  { header: 'Fecha Registro',    key: 'fechaRegistro',      width: 14 },
  { header: 'N° Memorándum',     key: 'numeroMemorandum',   width: 14 },
  { header: 'Fecha Memo',        key: 'fechaMemorandum',    width: 14 },
  { header: 'DNI',               key: 'dni',                width: 12 },
  { header: 'CIP/CAP',           key: 'cip',                width: 10 },
  { header: 'Apellidos y Nombres', key: 'apellidosNombres', width: 38 },
  { header: 'Cargo',             key: 'cargoCodigo',        width: 10 },
  { header: 'Cargo Descripción', key: 'cargoNombre',        width: 30 },
  { header: 'Proyecto',          key: 'proyecto',           width: 60 },
  { header: 'CUI',               key: 'cui',                width: 12 },
  { header: 'Componente',        key: 'componente',         width: 24 },
  { header: 'N° Resolución',     key: 'numeroResolucion',   width: 16 },
  { header: 'Teléfono 1',        key: 'telefono1',          width: 14 },
  { header: 'Teléfono 2',        key: 'telefono2',          width: 14 },
  { header: 'Teléfono Fijo',     key: 'telefonoFijo',       width: 14 },
  { header: 'Correo',            key: 'correo',             width: 30 },
  { header: 'Estado Civil',      key: 'estadoCivil',        width: 14 },
  { header: 'Barrio/Domicilio',  key: 'barrio',             width: 32 },
  { header: 'Distrito',          key: 'distrito',           width: 16 },
  { header: 'Provincia',         key: 'provincia',          width: 16 },
  { header: 'Departamento',      key: 'departamento',       width: 16 },
  { header: 'Observaciones',     key: 'observaciones',      width: 32 },
  { header: 'Archivo Memo',      key: 'archivoMemo',        width: 40 },
  { header: 'Fecha Generación',  key: 'fechaGeneracion',    width: 18 },
];

// ── Columnas: hoja Trabajadores (base_de_datos.xlsx) ─────────────────────────
const COLS_TRABAJADORES = [
  { header: 'DNI',                  key: 'dni',                width: 12 },
  { header: 'Apellidos y Nombres',  key: 'apellidosNombres',   width: 38 },
  { header: 'CIP/CAP',              key: 'cip',                width: 12 },
  { header: 'Teléfono 1',           key: 'telefono1',          width: 14 },
  { header: 'Teléfono 2',           key: 'telefono2',          width: 14 },
  { header: 'Teléfono Fijo',        key: 'telefonoFijo',       width: 14 },
  { header: 'Correo',               key: 'correo',             width: 30 },
  { header: 'Estado Civil',         key: 'estadoCivil',        width: 14 },
  { header: 'Barrio/Domicilio',     key: 'barrio',             width: 32 },
  { header: 'Distrito',             key: 'distrito',           width: 16 },
  { header: 'Provincia',            key: 'provincia',          width: 16 },
  { header: 'Departamento',         key: 'departamento',       width: 16 },
  { header: 'Observaciones',        key: 'observaciones',      width: 30 },
  { header: 'Registrado Por',       key: '_registradoPor',     width: 20 },
  { header: 'Fecha Registro',       key: '_fechaRegistro',     width: 20 },
  { header: 'Última Actualización', key: '_ultimaActualizacion', width: 20 },
];

// ── Columnas: hoja Contratos (personal.xlsx) ─────────────────────────────────
const COLS_CONTRATOS = [
  { header: 'ID Contrato',         key: 'id',               width: 22 },
  { header: 'DNI',                 key: 'dni',              width: 12 },
  { header: 'Apellidos y Nombres', key: 'apellidosNombres', width: 38 },
  { header: 'Cargo Código',        key: 'cargoCodigo',      width: 12 },
  { header: 'Cargo Nombre',        key: 'cargoNombre',      width: 30 },
  { header: 'CUI Proyecto',        key: 'cui',              width: 14 },
  { header: 'Proyecto',            key: 'proyecto',         width: 60 },
  { header: 'Componente',          key: 'componente',       width: 24 },
  { header: 'Fecha Inicio',        key: 'fechaInicio',      width: 14 },
  { header: 'Fecha Término',       key: 'fechaTermino',     width: 14 },
  { header: 'Estado',              key: 'estado',           width: 14 },
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizarCargo(cargo) {
  if (!cargo) return { codigo: 'OT', nombre: 'OTRO' };
  const c = cargo.trim().toUpperCase();
  const mapa = {
    'RESIDENTE':            { codigo: 'RO',  nombre: 'RESIDENTE DE OBRA' },
    'RESIDENTE DE OBRA':    { codigo: 'RO',  nombre: 'RESIDENTE DE OBRA' },
    'ENCARGADO RESIDENTE':  { codigo: 'RO',  nombre: 'RESIDENTE DE OBRA' },
    'ASISTENTE TECNICO':    { codigo: 'AT',  nombre: 'ASISTENTE TÉCNICO' },
    'ASISTENTE TECNICO  I': { codigo: 'AT',  nombre: 'ASISTENTE TÉCNICO I' },
    'ASISTENTE TECNICO  II':{ codigo: 'AT2', nombre: 'ASISTENTE TÉCNICO II' },
    'ASISTENTE EN ARQUITECTURA': { codigo: 'AAR', nombre: 'ASISTENTE EN ARQUITECTURA' },
    'ASISTENTE ADMINISTRATIVO':  { codigo: 'AAD', nombre: 'ASISTENTE ADMINISTRATIVO' },
    'TOPOGRAFO':            { codigo: 'TOP', nombre: 'TOPÓGRAFO' },
    'TOPOGRAFO ':           { codigo: 'TOP', nombre: 'TOPÓGRAFO' },
    'GUARDIAN':             { codigo: 'GRD', nombre: 'GUARDIÁN' },
    'GUARDIAN ':            { codigo: 'GRD', nombre: 'GUARDIÁN' },
    'GUARDIAN DE OBRA':     { codigo: 'GRD', nombre: 'GUARDIÁN' },
    'GUIARDIAN':            { codigo: 'GRD', nombre: 'GUARDIÁN' },
    'CHOFER':               { codigo: 'CHF', nombre: 'CHOFER' },
    'CHOFER ':              { codigo: 'CHF', nombre: 'CHOFER' },
    'CHOFER DE OBRA':       { codigo: 'CHF', nombre: 'CHOFER' },
    'CHOFER de obra':       { codigo: 'CHF', nombre: 'CHOFER' },
    'ALMACENERO':           { codigo: 'ALM', nombre: 'ALMACENERO' },
    'ALMACENERO DE OBRA':   { codigo: 'ALM', nombre: 'ALMACENERO' },
    'ALMACENERA':           { codigo: 'ALM', nombre: 'ALMACENERO' },
    'TECNICO EN SEGURIDAD': { codigo: 'SEG', nombre: 'TÉCNICO EN SEGURIDAD' },
    'TECNICO EN SEGURIDAD - SOMA': { codigo: 'SEG', nombre: 'TÉCNICO EN SEGURIDAD - SOMA' },
    'ESPESIALISTA EN SEGURIDAD':   { codigo: 'SEG', nombre: 'ESPECIALISTA EN SEGURIDAD' },
    'INGENIERO EN SEGURIDAD':      { codigo: 'SEG', nombre: 'INGENIERO EN SEGURIDAD' },
    'GESTOR SOCIAL':        { codigo: 'GS',  nombre: 'GESTOR SOCIAL' },
    'ADMINISTRADOR DE OBRA':{ codigo: 'ADM', nombre: 'ADMINISTRADOR DE OBRA' },
    'ARQUEOLOGA':           { codigo: 'ARQ', nombre: 'ARQUEÓLOGO' },
    'ING AMBIENTAL':        { codigo: 'AMB', nombre: 'ING. AMBIENTAL' },
    'ESPECIALISTA EN SANITARIO':   { codigo: 'SAN', nombre: 'ESPECIALISTA EN SANITARIO' },
    'ESPECIALISTA EN SANITARIO ':  { codigo: 'SAN', nombre: 'ESPECIALISTA EN SANITARIO' },
    'ING ESPESIALISTA EN ELECTRICAS': { codigo: 'ELE', nombre: 'ING. ESPECIALISTA EN ELÉCTRICAS' },
    'INGENIERO EN CALIDAD': { codigo: 'CAL', nombre: 'INGENIERO EN CALIDAD' },
    'AUXILIAR DE OBRA':     { codigo: 'AUX', nombre: 'AUXILIAR DE OBRA' },
    'AUXILIAR DE OBRA -  ALMACEN': { codigo: 'AUX', nombre: 'AUXILIAR DE OBRA - ALMACÉN' },
    'AUXILIAR DE OBRA -  TECNICO': { codigo: 'AUX', nombre: 'AUXILIAR DE OBRA - TÉCNICO' },
    'AUXILIAR DE OBRA -  TOPOGRAFO': { codigo: 'AUX', nombre: 'AUXILIAR DE OBRA - TOPÓGRAFO' },
    'AUXILIAR DE OBRA - ADMINISTRATIVO': { codigo: 'AUX', nombre: 'AUXILIAR DE OBRA - ADMINISTRATIVO' },
    'AUXILIAR DE OBRA SOMA':{ codigo: 'AUX', nombre: 'AUXILIAR DE OBRA SOMA' },
    'AUXILIAR EN OBRA':     { codigo: 'AUX', nombre: 'AUXILIAR DE OBRA' },
  };
  // Búsqueda directa
  if (mapa[c]) return mapa[c];
  // Búsqueda parcial
  for (const [k, v] of Object.entries(mapa)) {
    if (c.includes(k) || k.includes(c)) return v;
  }
  return { codigo: 'OT', nombre: c };
}

function generarId(dni, cui, memo) {
  const ts = Date.now().toString(36).toUpperCase();
  const base = `${dni}-${cui || 'XX'}-${memo || '0'}`.replace(/\s+/g, '');
  let h = 0;
  for (let i = 0; i < base.length; i++) { h = ((h << 5) - h) + base.charCodeAt(i); h |= 0; }
  return `CONT-${Math.abs(h).toString(36).toUpperCase().padStart(6, '0')}-${ts}`;
}

function strv(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().split('T')[0];
  const s = String(v).trim();
  return (s === '0' || s === 'None' || s === 'null') ? '' : s;
}

function fechaIso(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().split('T')[0];
  if (typeof v === 'number' && v > 40000) {
    // Excel serial date
    const d = new Date((v - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }
  return '';
}

function estilarCabecera(sheet, color) {
  sheet.getRow(1).eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Arial' };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border    = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };
  });
  sheet.getRow(1).height = 28;
}

function estilarFila(row) {
  row.eachCell({ includeEmpty: true }, cell => {
    cell.font      = { name: 'Arial', size: 10 };
    cell.alignment = { vertical: 'middle', wrapText: false };
    cell.border    = {
      top:    { style: 'thin', color: { argb: 'FFDDDDDD' } },
      bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      left:   { style: 'thin', color: { argb: 'FFDDDDDD' } },
      right:  { style: 'thin', color: { argb: 'FFDDDDDD' } },
    };
  });
  row.height = 16;
}

// ── LECTURA DEL XLSM DE ENTRADA ───────────────────────────────────────────────
async function leerBD(rutaEntrada) {
  console.log(`\n📂 Leyendo: ${rutaEntrada}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(rutaEntrada);
  const ws = wb.getWorksheet('BD');
  if (!ws) throw new Error('No se encontró la hoja "BD" en el archivo.');

  const registros = [];
  let fila = 0;
  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum === 1) return; // cabecera
    const v = (idx) => row.getCell(idx).value;
    const dni = strv(v(1));
    if (!dni) return;

    fila++;
    registros.push({
      dni,
      cip:              strv(v(2)),
      apellidosNombres: strv(v(3)),
      numeroMemorandum: strv(v(4)),
      fechaMemorandum:  fechaIso(v(5)),
      cui:              strv(v(6)),
      proyecto:         strv(v(7)),
      regNumero:        strv(v(8)),
      fechaRegistro:    fechaIso(v(9)),
      telefono1:        strv(v(10)),
      telefono2:        strv(v(11)),
      barrio:           strv(v(12)) || strv(v(13)),
      distrito:         strv(v(14)),
      correo:           strv(v(15)),
      cargo:            strv(v(16)),
      observaciones:    strv(v(17)),
      numeroResolucion: strv(v(18)),
      componente:       strv(v(19)),
      fechaInicio:      fechaIso(v(31)), // col AE - DESDE
      fechaTermino:     fechaIso(v(32)), // col AF - HASTA
    });
  });

  console.log(`   ✅ ${registros.length} registros leídos.`);
  return registros;
}

// ── GENERAR base_de_datos.xlsx ────────────────────────────────────────────────
async function generarBaseDeDatos(registros) {
  console.log('\n📊 Generando base_de_datos.xlsx...');

  const wb = new ExcelJS.Workbook();
  wb.creator    = 'Sistema GIM v3.6 - MPP';
  wb.created    = new Date();
  wb.properties = { date1904: false };

  // ── Hoja 1: Registros ────────────────────────────────────────
  const wsReg = wb.addWorksheet('Registros', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsReg.columns = COLS_REGISTROS;
  estilarCabecera(wsReg, COLOR_HEADER_BD);

  registros.forEach((r, i) => {
    const cargo = normalizarCargo(r.cargo);
    const row = wsReg.addRow({
      nro:              i + 1,
      regNumero:        r.regNumero,
      fechaRegistro:    r.fechaRegistro,
      numeroMemorandum: r.numeroMemorandum,
      fechaMemorandum:  r.fechaMemorandum,
      dni:              r.dni,
      cip:              r.cip,
      apellidosNombres: r.apellidosNombres,
      cargoCodigo:      cargo.codigo,
      cargoNombre:      r.cargo.trim().toUpperCase() || cargo.nombre,
      proyecto:         r.proyecto,
      cui:              r.cui,
      componente:       r.componente,
      numeroResolucion: r.numeroResolucion,
      telefono1:        r.telefono1,
      telefono2:        r.telefono2,
      telefonoFijo:     '',
      correo:           r.correo,
      estadoCivil:      '',
      barrio:           r.barrio,
      distrito:         r.distrito,
      provincia:        'PUNO',
      departamento:     'PUNO',
      observaciones:    r.observaciones,
      archivoMemo:      '',
      fechaGeneracion:  new Date().toISOString().split('T')[0],
    });
    estilarFila(row);
    // Alternar fila par/impar
    if (i % 2 === 0) {
      row.eachCell({ includeEmpty: true }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FF' } };
      });
    }
  });

  // ── Hoja 2: Trabajadores (únicos por DNI) ────────────────────
  const wsT = wb.addWorksheet('Trabajadores', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsT.columns = COLS_TRABAJADORES;
  estilarCabecera(wsT, COLOR_HEADER_TRAB);

  const dniVistos = new Map();
  registros.forEach(r => {
    if (!r.dni || dniVistos.has(r.dni)) return;
    dniVistos.set(r.dni, true);
    const row = wsT.addRow({
      dni:                  r.dni,
      apellidosNombres:     r.apellidosNombres,
      cip:                  r.cip,
      telefono1:            r.telefono1,
      telefono2:            r.telefono2,
      telefonoFijo:         '',
      correo:               r.correo,
      estadoCivil:          '',
      barrio:               r.barrio,
      distrito:             r.distrito,
      provincia:            'PUNO',
      departamento:         'PUNO',
      observaciones:        r.observaciones,
      _registradoPor:       'IMPORTACIÓN BD 2025-2026',
      _fechaRegistro:       new Date().toISOString().split('T')[0],
      _ultimaActualizacion: new Date().toISOString().split('T')[0],
    });
    estilarFila(row);
  });

  // Hoja resumen
  const wsRes = wb.addWorksheet('Resumen Importación');
  wsRes.columns = [
    { header: 'Dato', key: 'dato', width: 35 },
    { header: 'Valor', key: 'valor', width: 20 },
  ];
  estilarCabecera(wsRes, 'FF1F4E79');
  const resumen = [
    ['Total registros importados', registros.length],
    ['Trabajadores únicos (por DNI)', dniVistos.size],
    ['Fecha importación', new Date().toLocaleDateString('es-PE')],
    ['Fuente', 'BD_2025_Y_2026_.xlsm'],
    ['Sistema', 'GIM v3.6 - MPP'],
  ];
  resumen.forEach(([dato, valor]) => {
    const row = wsRes.addRow({ dato, valor });
    estilarFila(row);
  });

  await fs.ensureDir(DATA_DIR);
  await wb.xlsx.writeFile(RUTA_BD);
  console.log(`   ✅ base_de_datos.xlsx → ${registros.length} registros, ${dniVistos.size} trabajadores únicos`);
  return dniVistos.size;
}

// ── GENERAR personal.xlsx (contratos) ─────────────────────────────────────────
async function generarPersonal(registros) {
  console.log('\n👥 Generando personal.xlsx (contratos)...');

  const wb = new ExcelJS.Workbook();
  wb.creator    = 'Sistema GIM v3.6 - MPP';
  wb.created    = new Date();
  wb.properties = { date1904: false };

  // ── Hoja Contratos ───────────────────────────────────────────
  const wsCont = wb.addWorksheet('Contratos', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsCont.columns = COLS_CONTRATOS;
  estilarCabecera(wsCont, COLOR_HEADER_PERS);

  const hoy = new Date().toISOString().split('T')[0];

  registros.forEach((r, i) => {
    const cargo  = normalizarCargo(r.cargo);
    const id     = generarId(r.dni, r.cui, r.numeroMemorandum);

    // Estado: si tiene fecha término → CONCLUIDO; si no → ACTIVO
    let estado = 'ACTIVO';
    if (r.fechaTermino && r.fechaTermino < hoy) estado = 'CONCLUIDO';
    else if (!r.fechaTermino && r.fechaMemorandum) {
      // Contratos de 2025 sin fecha término: asumimos activos (el usuario corregirá)
      estado = 'ACTIVO';
    }

    const row = wsCont.addRow({
      id,
      dni:                r.dni,
      apellidosNombres:   r.apellidosNombres,
      cargoCodigo:        cargo.codigo,
      cargoNombre:        r.cargo.trim().toUpperCase() || cargo.nombre,
      cui:                r.cui,
      proyecto:           r.proyecto,
      componente:         r.componente,
      fechaInicio:        r.fechaInicio || r.fechaMemorandum || '',
      fechaTermino:       r.fechaTermino || '',
      estado,
      numeroMemo:         r.numeroMemorandum,
      numeroResolucion:   r.numeroResolucion,
      monto:              '',
      funciones:          '',
      observaciones:      r.observaciones,
      alertado:           'NO',
      registradoPor:      'IMPORTACIÓN BD 2025-2026',
      fechaRegistroSys:   hoy,
      ultimaActualizacion: hoy,
    });
    estilarFila(row);
    if (i % 2 === 0) {
      row.eachCell({ includeEmpty: true }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7FF' } };
      });
    }
  });

  // ── Hoja Evaluaciones (vacía, lista para uso) ─────────────────
  const wsEval = wb.addWorksheet('Evaluaciones', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsEval.columns = [
    { header: 'ID',                  key: 'id',               width: 22 },
    { header: 'DNI',                 key: 'dni',              width: 12 },
    { header: 'Apellidos y Nombres', key: 'apellidosNombres', width: 38 },
    { header: 'ID Contrato',         key: 'idContrato',       width: 22 },
    { header: 'Proyecto',            key: 'proyecto',         width: 40 },
    { header: 'Periodo',             key: 'periodo',          width: 14 },
    { header: 'Puntaje',             key: 'puntaje',          width: 10 },
    { header: 'Calificación',        key: 'calificacion',     width: 16 },
    { header: 'Comentarios',         key: 'comentarios',      width: 40 },
    { header: 'Evaluador',           key: 'evaluador',        width: 24 },
    { header: 'Fecha',               key: 'fecha',            width: 16 },
  ];
  estilarCabecera(wsEval, 'FF6B7280');

  await wb.xlsx.writeFile(RUTA_PERS);
  console.log(`   ✅ personal.xlsx → ${registros.length} contratos importados`);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  IMPORTADOR BD HISTÓRICA → SISTEMA GIM v3.6 - MPP    ');
  console.log('═══════════════════════════════════════════════════════');

  if (!await fs.pathExists(RUTA_ENTRADA)) {
    console.error(`❌ Archivo no encontrado: ${RUTA_ENTRADA}`);
    process.exit(1);
  }

  try {
    const registros = await leerBD(RUTA_ENTRADA);

    if (registros.length === 0) {
      console.error('❌ No se encontraron registros válidos en el archivo.');
      process.exit(1);
    }

    const nTrab = await generarBaseDeDatos(registros);
    await generarPersonal(registros);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  ✅ IMPORTACIÓN COMPLETADA                           ');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  📊 Registros en base_de_datos.xlsx : ${registros.length}`);
    console.log(`  👤 Trabajadores únicos              : ${nTrab}`);
    console.log(`  📋 Contratos en personal.xlsx       : ${registros.length}`);
    console.log(`  📁 Archivos en: ${DATA_DIR}`);
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error(`\n❌ Error durante la importación: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
