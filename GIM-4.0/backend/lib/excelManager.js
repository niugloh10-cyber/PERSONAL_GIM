const ExcelJS = require('exceljs');
const fs = require('fs-extra');
const path = require('path');

const COLUMNAS_BD = [
  { header: 'N°', key: 'nro', width: 6 },
  { header: 'Reg. N°', key: 'regNumero', width: 10 },
  { header: 'Fecha Registro', key: 'fechaRegistro', width: 14 },
  { header: 'N° Memorándum', key: 'numeroMemorandum', width: 14 },
  { header: 'Fecha Memo', key: 'fechaMemorandum', width: 14 },
  { header: 'DNI', key: 'dni', width: 12 },
  { header: 'CIP/CAP', key: 'cip', width: 10 },
  { header: 'Apellidos y Nombres', key: 'apellidosNombres', width: 36 },
  { header: 'Cargo', key: 'cargoCodigo', width: 10 },
  { header: 'Cargo Descripción', key: 'cargoNombre', width: 28 },
  { header: 'Proyecto', key: 'proyecto', width: 50 },
  { header: 'CUI', key: 'cui', width: 12 },
  { header: 'Componente', key: 'componente', width: 24 },
  { header: 'N° Resolución', key: 'numeroResolucion', width: 14 },
  { header: 'Teléfono 1', key: 'telefono1', width: 12 },
  { header: 'Teléfono 2', key: 'telefono2', width: 12 },
  { header: 'Teléfono Fijo', key: 'telefonoFijo', width: 12 },
  { header: 'Correo', key: 'correo', width: 28 },
  { header: 'Estado Civil', key: 'estadoCivil', width: 14 },
  { header: 'Barrio/Domicilio', key: 'barrio', width: 30 },
  { header: 'Distrito', key: 'distrito', width: 16 },
  { header: 'Provincia', key: 'provincia', width: 16 },
  { header: 'Departamento', key: 'departamento', width: 16 },
  { header: 'Observaciones', key: 'observaciones', width: 30 },
  { header: 'Archivo Memo', key: 'archivoMemo', width: 40 },
  { header: 'Fecha Generación', key: 'fechaGeneracion', width: 18 },
];

/**
 * Crea el archivo Excel con la estructura inicial si no existe.
 */
async function asegurarBaseDeDatos(rutaExcel) {
  if (await fs.pathExists(rutaExcel)) return;

  await fs.ensureDir(path.dirname(rutaExcel));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema GIM - MPP';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Registros', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = COLUMNAS_BD;

  // Estilo del encabezado
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E79' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  sheet.getRow(1).height = 28;

  await workbook.xlsx.writeFile(rutaExcel);
}

/**
 * Lee todos los registros de la base de datos Excel.
 */
async function leerRegistros(rutaExcel) {
  await asegurarBaseDeDatos(rutaExcel);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(rutaExcel);
  const sheet = workbook.getWorksheet('Registros');

  if (!sheet) return [];

  const registros = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // Encabezado

    const obj = {};
    COLUMNAS_BD.forEach((col, idx) => {
      const cell = row.getCell(idx + 1);
      let value = cell.value;
      if (value && typeof value === 'object' && value.text) value = value.text;
      if (value && value.result !== undefined) value = value.result;
      obj[col.key] = value !== null && value !== undefined ? String(value) : '';
    });
    obj._rowNumber = rowNumber;
    registros.push(obj);
  });

  return registros;
}

/**
 * Guarda un nuevo registro en la base de datos.
 */
async function guardarRegistro(rutaExcel, registro) {
  await asegurarBaseDeDatos(rutaExcel);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(rutaExcel);
  const sheet = workbook.getWorksheet('Registros');

  // Reasignar las keys de columnas (al leer un Excel existente se pierden)
  // Esto es CRÍTICO para que addRow(objeto) funcione correctamente.
  sheet.columns = COLUMNAS_BD;

  // Calcular el N° si no viene
  const numFilas = sheet.rowCount;
  if (!registro.nro) {
    registro.nro = numFilas; // Si hay 1 fila (encabezado), el siguiente es 1
  }

  if (!registro.fechaGeneracion) {
    registro.fechaGeneracion = new Date().toLocaleString('es-PE');
  }

  // Construir fila como array en el orden correcto (más confiable que objeto)
  const filaArray = COLUMNAS_BD.map((col) => registro[col.key] ?? '');
  const newRow = sheet.addRow(filaArray);
  newRow.eachCell((cell) => {
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
  });

  await workbook.xlsx.writeFile(rutaExcel);
  return registro;
}

/**
 * Actualiza un registro existente identificado por número de fila.
 */
async function actualizarRegistro(rutaExcel, rowNumber, datos) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(rutaExcel);
  const sheet = workbook.getWorksheet('Registros');

  const row = sheet.getRow(rowNumber);
  COLUMNAS_BD.forEach((col, idx) => {
    if (datos[col.key] !== undefined) {
      row.getCell(idx + 1).value = datos[col.key];
    }
  });
  row.commit();
  await workbook.xlsx.writeFile(rutaExcel);
}

/**
 * Elimina un registro por número de fila.
 */
async function eliminarRegistro(rutaExcel, rowNumber) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(rutaExcel);
  const sheet = workbook.getWorksheet('Registros');
  sheet.spliceRows(rowNumber, 1);
  await workbook.xlsx.writeFile(rutaExcel);
}

/**
 * Verifica si ya existe un memorandum con ese número.
 */
async function existeMemorandum(rutaExcel, numeroMemorandum) {
  const registros = await leerRegistros(rutaExcel);
  return registros.some(
    (r) => String(r.numeroMemorandum).trim() === String(numeroMemorandum).trim(),
  );
}

/**
 * Importa la tabla salarial desde un archivo Excel.
 * Retorna un array de objetos { codigo, nombre, monto, requisitos }.
 */
async function importarTablaSalarial(rutaExcel) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(rutaExcel);
  const sheet = workbook.worksheets[0];

  const cargos = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= 2) return; // Saltar encabezados
    const cells = row.values;
    if (!cells || cells.length < 4) return;

    const nivel = String(cells[2] || '').trim();
    if (!nivel || nivel.toLowerCase().includes('cargo') || nivel.toLowerCase().includes('resumen'))
      return;

    const monto = parseFloat(cells[4]) || 0;
    if (monto === 0) return;

    cargos.push({
      codigo: generarCodigoCargo(nivel),
      nombre: nivel,
      requisitos: String(cells[3] || ''),
      monto: monto,
    });
  });

  return cargos;
}

function generarCodigoCargo(nombre) {
  return nombre
    .split(' ')
    .filter((w) => w.length > 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .substring(0, 4);
}

/**
 * Importa proyectos desde un archivo Excel.
 * Estructura esperada (con o sin encabezado, lo detecta):
 *   Columna A: CUI (obligatorio, numérico)
 *   Columna B: Nombre del proyecto (obligatorio)
 *   Columna C: Componente (opcional)
 *   Columna D: Resolución de aprobación (opcional)
 *
 * Retorna: {
 *   proyectos: [{ cui, nombre, componente, resolucion }, ...],
 *   errores:   [{ fila, mensajes: [...] }, ...]
 * }
 */
async function importarProyectos(rutaExcel) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(rutaExcel);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error('El archivo Excel no contiene hojas');
  }

  const proyectos = [];
  const errores = [];
  let primeraFilaProcesada = false;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells = row.values || [];
    // ExcelJS arranca el array en el índice 1
    const cuiRaw = limpiarCelda(cells[1]);
    const nombreRaw = limpiarCelda(cells[2]);
    const componenteRaw = limpiarCelda(cells[3]);
    const resolucionRaw = limpiarCelda(cells[4]);

    // Detectar fila de encabezado (heurística): primera fila si CUI no es numérico
    if (!primeraFilaProcesada) {
      primeraFilaProcesada = true;
      if (!cuiRaw || !/^\d+$/.test(cuiRaw)) {
        // Fila de encabezado, saltar
        return;
      }
    }

    // Saltar filas completamente vacías
    if (!cuiRaw && !nombreRaw) return;

    const erroresFila = [];
    if (!cuiRaw) {
      erroresFila.push('CUI vacío');
    } else if (!/^\d+$/.test(cuiRaw)) {
      erroresFila.push(`CUI inválido (no numérico): "${cuiRaw}"`);
    } else if (cuiRaw.length < 5 || cuiRaw.length > 10) {
      erroresFila.push(`CUI debe tener entre 5 y 10 dígitos: "${cuiRaw}"`);
    }

    if (!nombreRaw) {
      erroresFila.push('Nombre del proyecto vacío');
    } else if (nombreRaw.length < 5) {
      erroresFila.push(`Nombre demasiado corto: "${nombreRaw}"`);
    }

    if (erroresFila.length > 0) {
      errores.push({ fila: rowNumber, mensajes: erroresFila });
      return;
    }

    proyectos.push({
      cui: cuiRaw,
      nombre: nombreRaw.toUpperCase(),
      componente: componenteRaw,
      resolucion: resolucionRaw,
    });
  });

  return { proyectos, errores };
}

/**
 * Limpia un valor de celda Excel a string usable.
 */
function limpiarCelda(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'object') {
    if (valor.text) return String(valor.text).trim();
    if (valor.result !== undefined) return String(valor.result).trim();
    if (valor.richText) {
      return valor.richText.map((r) => r.text).join('').trim();
    }
    return String(valor).trim();
  }
  return String(valor).trim();
}

/**
 * Importa registros desde un archivo Excel externo con la misma estructura
 * que la base de datos (o compatible). Retorna:
 *   { importados, duplicados, errores, registros }
 * donde `registros` son los registros leídos (para refrescar el estado en el cliente).
 */
async function importarHistorialExcel(rutaArchivoExcel) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(rutaArchivoExcel);

  // Intentar hoja "Registros", si no existe usar la primera hoja
  let sheet = workbook.getWorksheet('Registros') || workbook.worksheets[0];
  if (!sheet) throw new Error('El archivo Excel no contiene hojas');

  const registros = [];
  const errores = [];
  let encabezadoProcesado = false;
  let mapaColumnas = null; // índice de columna → key

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    // Detectar fila de encabezado en la primera fila no vacía
    if (!encabezadoProcesado) {
      encabezadoProcesado = true;
      // Intentar mapear por nombre de columna (flexible)
      const valoresFila = row.values; // índice 1-based
      mapaColumnas = {};
      for (let i = 1; i < valoresFila.length; i++) {
        const headerVal = limpiarCelda(valoresFila[i]).toLowerCase().trim();
        // Buscar coincidencia con COLUMNAS_BD
        const colDef = COLUMNAS_BD.find((c) => {
          const h = c.header.toLowerCase();
          return h === headerVal || c.key === headerVal;
        });
        if (colDef) mapaColumnas[i] = colDef.key;
      }
      // Si no se detectó ningún encabezado conocido, asumir orden fijo de COLUMNAS_BD
      if (Object.keys(mapaColumnas).length === 0) {
        mapaColumnas = null; // usar orden por defecto
        // Pero esta fila podría ser de datos; re-procesarla
      } else {
        return; // era fila de encabezado, continuar
      }
    }

    const cells = row.values; // 1-based
    const obj = {};

    if (mapaColumnas) {
      // Mapeo por nombre de columna detectado
      Object.entries(mapaColumnas).forEach(([idx, key]) => {
        obj[key] = limpiarCelda(cells[parseInt(idx)]);
      });
    } else {
      // Mapeo por posición (orden de COLUMNAS_BD)
      COLUMNAS_BD.forEach((col, idx) => {
        obj[col.key] = limpiarCelda(cells[idx + 1]);
      });
    }

    // Validar campos mínimos
    const dni = (obj.dni || '').replace(/\D/g, '');
    if (!dni || dni.length !== 8) {
      if (dni || obj.apellidosNombres) {
        errores.push({ fila: rowNumber, mensaje: `DNI inválido: "${obj.dni || ''}"` });
      }
      return;
    }
    obj.dni = dni;
    obj._rowNumber = rowNumber;
    registros.push(obj);
  });

  return { registros, totalLeidos: registros.length, errores };
}


/**
 * Hoja exclusiva de Datos de Trabajador (v3.1)
 * Columnas: DNI | Apellidos y Nombres | CIP/CAP | Tel1 | Tel2 | TelFijo
 *           Correo | Estado Civil | Barrio | Distrito | Provincia | Departamento
 *           Observaciones | _registradoPor | _fechaRegistro | _ultimaActualizacion
 */
const COLUMNAS_TRABAJADORES = [
  { header: 'DNI',                  key: 'dni',                  width: 12 },
  { header: 'Apellidos y Nombres',  key: 'apellidosNombres',     width: 38 },
  { header: 'CIP/CAP',              key: 'cip',                  width: 12 },
  { header: 'Teléfono 1',           key: 'telefono1',            width: 14 },
  { header: 'Teléfono 2',           key: 'telefono2',            width: 14 },
  { header: 'Teléfono Fijo',        key: 'telefonoFijo',         width: 14 },
  { header: 'Correo',               key: 'correo',               width: 30 },
  { header: 'Estado Civil',         key: 'estadoCivil',          width: 14 },
  { header: 'Barrio/Domicilio',     key: 'barrio',               width: 32 },
  { header: 'Distrito',             key: 'distrito',             width: 16 },
  { header: 'Provincia',            key: 'provincia',            width: 16 },
  { header: 'Departamento',         key: 'departamento',         width: 16 },
  { header: 'Observaciones',        key: 'observaciones',        width: 30 },
  { header: 'Registrado Por',       key: '_registradoPor',       width: 20 },
  { header: 'Fecha Registro',       key: '_fechaRegistro',       width: 20 },
  { header: 'Última Actualización', key: '_ultimaActualizacion', width: 20 },
];

async function _asegurarHojaTrabajadores(workbook) {
  let sheet = workbook.getWorksheet('Trabajadores');
  if (!sheet) {
    sheet = workbook.addWorksheet('Trabajadores', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = COLUMNAS_TRABAJADORES;
    sheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
    });
    sheet.getRow(1).height = 28;
  }
  return sheet;
}

/**
 * Busca un trabajador por DNI en la hoja Trabajadores.
 * Devuelve el objeto o null.
 */
async function buscarTrabajadorPorDni(rutaExcel, dni) {
  await asegurarBaseDeDatos(rutaExcel);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(rutaExcel);
  await _asegurarHojaTrabajadores(workbook);
  const sheet = workbook.getWorksheet('Trabajadores');

  let encontrado = null;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = {};
    COLUMNAS_TRABAJADORES.forEach((col, idx) => {
      const cell = row.getCell(idx + 1);
      let v = cell.value;
      if (v && typeof v === 'object' && v.text) v = v.text;
      if (v && v.result !== undefined) v = v.result;
      obj[col.key] = v !== null && v !== undefined ? String(v) : '';
    });
    obj._rowNumber = rowNumber;
    if (obj.dni === dni) encontrado = obj;
  });
  return encontrado;
}

/**
 * Registra un nuevo trabajador. Lanza error si el DNI ya existe.
 */
async function registrarTrabajador(rutaExcel, datos) {
  await asegurarBaseDeDatos(rutaExcel);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(rutaExcel);
  const sheet = await _asegurarHojaTrabajadores(workbook);

  // Verificar duplicado
  let duplicado = false;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    if (String(row.getCell(1).value) === datos.dni) duplicado = true;
  });
  if (duplicado) throw new Error(`Ya existe un registro para el DNI ${datos.dni}`);

  sheet.columns = COLUMNAS_TRABAJADORES;
  const fila = COLUMNAS_TRABAJADORES.map(col => datos[col.key] || '');
  const newRow = sheet.addRow(fila);
  newRow.eachCell(cell => {
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = {
      top:{style:'thin',color:{argb:'FFCCCCCC'}}, bottom:{style:'thin',color:{argb:'FFCCCCCC'}},
      left:{style:'thin',color:{argb:'FFCCCCCC'}}, right:{style:'thin',color:{argb:'FFCCCCCC'}},
    };
  });
  await workbook.xlsx.writeFile(rutaExcel);
  return datos;
}

/**
 * Actualiza un trabajador existente por DNI. Lanza error si no existe.
 */
async function actualizarTrabajador(rutaExcel, dni, datos) {
  await asegurarBaseDeDatos(rutaExcel);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(rutaExcel);
  await _asegurarHojaTrabajadores(workbook);
  const sheet = workbook.getWorksheet('Trabajadores');

  let rowTarget = null;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    if (String(row.getCell(1).value) === dni) rowTarget = row;
  });
  if (!rowTarget) throw new Error(`No existe trabajador con DNI ${dni}`);

  COLUMNAS_TRABAJADORES.forEach((col, idx) => {
    if (datos[col.key] !== undefined && col.key !== 'dni') {
      rowTarget.getCell(idx + 1).value = datos[col.key];
    }
  });
  rowTarget.commit();
  await workbook.xlsx.writeFile(rutaExcel);
  return datos;
}


/**
 * Lista todos los trabajadores de la hoja Trabajadores.
 */
async function listarTrabajadores(rutaExcel) {
  await asegurarBaseDeDatos(rutaExcel);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(rutaExcel);
  await _asegurarHojaTrabajadores(workbook);
  const sheet = workbook.getWorksheet('Trabajadores');
  const resultado = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = {};
    COLUMNAS_TRABAJADORES.forEach((col, idx) => {
      const cell = row.getCell(idx + 1);
      let v = cell.value;
      if (v && typeof v === 'object' && v.text) v = v.text;
      if (v && v.result !== undefined) v = v.result;
      obj[col.key] = v !== null && v !== undefined ? String(v) : '';
    });
    obj._rowNumber = rowNumber;
    resultado.push(obj);
  });
  return resultado;
}

module.exports = {
  asegurarBaseDeDatos,
  leerRegistros,
  guardarRegistro,
  actualizarRegistro,
  eliminarRegistro,
  existeMemorandum,
  importarTablaSalarial,
  importarProyectos,
  importarHistorialExcel,
  COLUMNAS_BD,
  buscarTrabajadorPorDni,
  registrarTrabajador,
  actualizarTrabajador,
  listarTrabajadores,
  COLUMNAS_TRABAJADORES,
};