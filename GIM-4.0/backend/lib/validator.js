/**
 * SISTEMA GIM v3.0 - VALIDADOR CENTRALIZADO
 * ==========================================
 * Sanitización y validación de todos los inputs del sistema.
 */

'use strict';

/**
 * Escapa caracteres HTML peligrosos para prevenir XSS
 */
function sanitizarTexto(valor) {
  if (valor == null) return '';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/**
 * Elimina caracteres de control y normaliza espacios
 */
function limpiarString(valor, maxLen = 500) {
  if (valor == null) return '';
  return String(valor)
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .substring(0, maxLen);
}

/**
 * Valida que sea un DNI peruano válido (8 dígitos)
 */
function esDNIValido(dni) {
  return /^\d{8}$/.test(String(dni || '').trim());
}

/**
 * Valida formato de correo electrónico
 */
function esEmailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

/**
 * Valida contraseña fuerte (mín 8 chars, 1 mayúscula, 1 número)
 */
function esContrasenaValida(pass) {
  return /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(pass || ''));
}

/**
 * Valida y limpia un nombre de archivo (sin path traversal)
 */
function sanitizarNombreArchivo(nombre) {
  return String(nombre || '')
    .replace(/[/\\]/g, '')
    .replace(/\.\./g, '')
    .replace(/[^a-zA-Z0-9._\-\s]/g, '')
    .trim()
    .substring(0, 200);
}

/**
 * Sanitiza nombre de archivo para usar en paths de salida (solo ASCII)
 */
function sanitizarParaRuta(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\-_ ]/g, '')
    .replace(/\s+/g, '-')
    .toUpperCase()
    .trim()
    .substring(0, 80);
}

/**
 * Valida los datos del formulario principal de generación
 */
function validarDatosGenerar(datos) {
  const errores = [];
  if (!esDNIValido(datos.dni))
    errores.push('DNI debe tener exactamente 8 dígitos numéricos');
  if (!limpiarString(datos.apellidosNombres))
    errores.push('Apellidos y nombres es obligatorio');
  if (!limpiarString(datos.numeroMemorandum))
    errores.push('Número de memorándum es obligatorio');
  if (!limpiarString(datos.cargoCodigo))
    errores.push('Cargo es obligatorio');
  if (!limpiarString(datos.fechaMemorandum))
    errores.push('Fecha del memorándum es obligatoria');
  if (!limpiarString(datos.proyecto))
    errores.push('Nombre del proyecto es obligatorio');
  if (!limpiarString(datos.cui))
    errores.push('CUI es obligatorio');
  if (!limpiarString(datos.telefono1))
    errores.push('Teléfono 1 es obligatorio');
  if (!esEmailValido(datos.correo))
    errores.push('Correo electrónico inválido');
  return errores;
}

module.exports = {
  sanitizarTexto,
  limpiarString,
  esDNIValido,
  esEmailValido,
  esContrasenaValida,
  sanitizarNombreArchivo,
  sanitizarParaRuta,
  validarDatosGenerar,
};
