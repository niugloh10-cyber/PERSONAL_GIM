/**
 * SISTEMA GIM v3.4 - GENERADOR CARTA DE CONCLUSIÓN DE FUNCIONES
 * ==============================================================
 * Genera la carta automática de conclusión con:
 * - Datos personales y cargo
 * - Obra y periodo trabajado
 * - Funciones realizadas
 * - QR de verificación
 */
'use strict';

const PizZip = require('pizzip');
const fs     = require('fs-extra');
const path   = require('path');
const { diasEntre } = require('./personalManager');

const MESES = ['enero','febrero','marzo','abril','mayo','junio',
               'julio','agosto','setiembre','octubre','noviembre','diciembre'];

function fechaTexto(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m-1]} de ${y}`;
}

function calcularPeriodo(fechaInicio, fechaTermino) {
  if (!fechaInicio) return '';
  const inicio = new Date(fechaInicio);
  const fin    = fechaTermino ? new Date(fechaTermino) : new Date();
  const dias   = Math.max(0, diasEntre(fechaInicio, fechaTermino || new Date().toISOString().split('T')[0]));
  const meses  = Math.floor(dias / 30);
  const diasResto = dias % 30;
  const partes = [];
  if (meses > 0)    partes.push(`${meses} mes${meses > 1 ? 'es' : ''}`);
  if (diasResto > 0) partes.push(`${diasResto} día${diasResto > 1 ? 's' : ''}`);
  return partes.length ? partes.join(' y ') : `${dias} días`;
}

function escapeXml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function escapeRegex(t) { return String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const XML_FILES = [
  'word/document.xml',
  'word/header1.xml','word/header2.xml','word/header3.xml',
  'word/footer1.xml','word/footer2.xml','word/footer3.xml',
];

/**
 * Genera la carta de conclusión de funciones.
 * @param {string} plantillaPath - Ruta a la plantilla DOCX de carta
 * @param {Object} contrato      - Datos del contrato
 * @param {Object} trabajador    - Datos del trabajador (opcional, enriquece)
 * @param {string} codigoQR      - Código único para QR de verificación
 * @returns {Buffer}
 */
function generarCartaConclusionFunciones(plantillaPath, contrato, trabajador = {}, codigoQR = '') {
  if (!fs.existsSync(plantillaPath)) {
    throw new Error(`Plantilla de carta no encontrada: ${plantillaPath}`);
  }

  const hoy = new Date();
  const periodo = calcularPeriodo(contrato.fechaInicio, contrato.fechaTermino);

  const data = {
    // Fecha del documento
    _FECHA_DOC_:       fechaTexto(hoy.toISOString().split('T')[0]),
    _DIA_:             String(hoy.getDate()).padStart(2, '0'),
    _MES_:             MESES[hoy.getMonth()],
    _ANIO_:            String(hoy.getFullYear()),

    // Trabajador
    _AN_:              (contrato.apellidosNombres || trabajador.apellidosNombres || '').toUpperCase(),
    _DNI_:             contrato.dni || trabajador.dni || '',
    _CIP_:             trabajador.cip || '',
    _CARGO_:           (contrato.cargoNombre || '').toUpperCase(),
    _CARGO_COD_:       contrato.cargoCodigo || '',

    // Proyecto / Obra
    _PROYECTO_:        (contrato.proyecto || '').toUpperCase(),
    _CUI_:             contrato.cui || '',
    _COMPONENTE_:      contrato.componente || '',

    // Periodo
    _FECHA_INICIO_:    fechaTexto(contrato.fechaInicio),
    _FECHA_TERMINO_:   fechaTexto(contrato.fechaTermino || hoy.toISOString().split('T')[0]),
    _PERIODO_:         periodo,
    _DIAS_TRABAJADOS_: String(diasEntre(contrato.fechaInicio || '', contrato.fechaTermino || hoy.toISOString().split('T')[0])),

    // Funciones
    _FUNCIONES_:       contrato.funciones || 'Las propias del cargo asignado.',
    _OBSERVACIONES_:   contrato.observaciones || '',

    // Documentos
    _NRO_:             contrato.numeroCarta || contrato.numeroCarta || '',
    _NUM_MEMO_:        contrato.numeroMemo || '',
    _NUM_RES_:         contrato.numeroResolucion || '',
    _MONTO_:           contrato.monto ? `S/. ${contrato.monto}` : '',

    // QR / Verificación
    _QR_CODIGO_:       codigoQR,
    _ID_CONTRATO_:     contrato.id || '',

    // Institución (placeholders estándar GIM)
    _ENTIDAD_:         'MUNICIPALIDAD PROVINCIAL DE PUNO',
    _GERENCIA_:        'GERENCIA DE INGENIERÍA MUNICIPAL',
  };

  const content = fs.readFileSync(plantillaPath);
  const zip = new PizZip(content);

  for (const fileName of XML_FILES) {
    const file = zip.file(fileName);
    if (!file) continue;
    let xml = file.asText();
    for (const [key, rawValue] of Object.entries(data)) {
      const value = escapeXml(String(rawValue ?? ''));
      xml = xml.replace(new RegExp(escapeRegex(key), 'g'), value);
    }
    zip.file(fileName, xml);
  }

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/**
 * Genera un código de verificación único para el QR
 */
function generarCodigoVerificacion(contrato) {
  const base = `${contrato.id}-${contrato.dni}-${Date.now()}`;
  // Hash simple legible (no criptográfico, solo verificación visual)
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) - hash) + base.charCodeAt(i);
    hash |= 0;
  }
  return `GIM-${Math.abs(hash).toString(36).toUpperCase().padStart(8, '0')}`;
}

module.exports = {
  generarCartaConclusionFunciones,
  generarCodigoVerificacion,
  calcularPeriodo,
  fechaTexto,
};
