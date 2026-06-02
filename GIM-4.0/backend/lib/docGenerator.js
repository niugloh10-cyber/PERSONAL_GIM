/**
 * SISTEMA GIM v3.0 - GENERADOR DE DOCUMENTOS
 * ============================================
 * Genera documentos DOCX reemplazando placeholders en plantillas.
 */

'use strict';

const PizZip = require('pizzip');
const fs     = require('fs-extra');

const XML_FILES = [
  'word/document.xml',
  'word/header1.xml', 'word/header2.xml', 'word/header3.xml',
  'word/footer1.xml',  'word/footer2.xml',  'word/footer3.xml',
  'word/footnotes.xml', 'word/endnotes.xml',
];

function escapeXml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Genera un documento DOCX a partir de una plantilla y datos.
 * @param {string} templatePath - Ruta absoluta a la plantilla .docx
 * @param {Object} data         - { _PLACEHOLDER_: 'valor', ... }
 * @returns {Buffer}
 */
function generarDocumento(templatePath, data) {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Plantilla no encontrada: ${templatePath}`);
  }

  const content = fs.readFileSync(templatePath);
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

// ── Helpers de fecha ──────────────────────────────────────────
const MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','setiembre','octubre','noviembre','diciembre',
];

function fechaATexto(fechaIso) {
  if (!fechaIso) return '';
  const [year, month, day] = fechaIso.split('-').map(Number);
  return `${day} de ${MESES[month - 1]} de ${year}`;
}

// ── Constructores de datos de plantilla ──────────────────────

function construirDataMemo(r) {
  return {
    _NM_:  r.numeroMemorandum || '',
    _AN_:  (r.apellidosNombres || '').toUpperCase(),
    _DNI_: r.dni  || '',
    _CIP_: r.cip  || '',
    _FD_:  r.fechaMemorandumTexto || fechaATexto(r.fechaMemorandum),
    _C_:   r.proyecto || '',
    _CUI_: r.cui  || '',
    _R_:   r.regNumero || '',
    _FR_:  r.fechaRegistroTexto || fechaATexto(r.fechaRegistro || r.fechaMemorandum),
  };
}

function construirDataDJ(r) {
  return {
    _AN_:   (r.apellidosNombres || '').toUpperCase(),
    _DNI_:  r.dni || '',
    _EC_:   r.estadoCivil || 'Soltero(a)',
    _DOM_:  r.barrio || '',
    _DIST_: r.distrito || '',
    _PROV_: r.provincia || '',
    _DEP_:  r.departamento || '',
    _EMAIL_:r.correo || '',
    _TFIJO_:r.telefonoFijo || '',
    _TEL_:  r.telefono1 || '',
    _FD_:   r.fechaMemorandumTexto || fechaATexto(r.fechaMemorandum),
  };
}

module.exports = { generarDocumento, construirDataMemo, construirDataDJ, fechaATexto };
