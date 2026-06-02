const fs = require('fs-extra');
const path = require('path');

/**
 * Carga la lista de cargos desde el archivo JSON.
 */
async function cargarCargos(rutaJson) {
  if (!(await fs.pathExists(rutaJson))) {
    const cargosDefault = obtenerCargosDefault();
    await guardarCargos(rutaJson, cargosDefault);
    return cargosDefault;
  }
  const contenido = await fs.readFile(rutaJson, 'utf-8');
  try {
    return JSON.parse(contenido);
  } catch (e) {
    return obtenerCargosDefault();
  }
}

async function guardarCargos(rutaJson, cargos) {
  await fs.ensureDir(path.dirname(rutaJson));
  await fs.writeFile(rutaJson, JSON.stringify(cargos, null, 2), 'utf-8');
}

/**
 * Cargos por defecto, mapeados a las plantillas existentes.
 */
function obtenerCargosDefault() {
  return [
    {
      codigo: 'AR',
      nombre: 'RESIDENTE DE OBRA I',
      plantilla: 'AR.docx',
      monto: 4000.0,
      requisitos: 'Ingeniero, arquitecto o según el tipo de PIP. Colegiatura de 0 a más años.',
      requiereCIP: true,
      activo: true,
    },
    {
      codigo: 'AAT',
      nombre: 'ASISTENTE TÉCNICO I',
      plantilla: 'AAT.docx',
      monto: 2700.0,
      requisitos: 'Bachiller en Ingeniería y/o Arquitectura y/o Titulado en Ingeniería.',
      requiereCIP: false,
      activo: true,
    },
    {
      codigo: 'AAA',
      nombre: 'ASISTENTE ADMINISTRATIVO I',
      plantilla: 'AAA.docx',
      monto: 2100.0,
      requisitos: 'Técnico en Contabilidad, Administración o estudios universitarios (Bachiller). Y/o titulado.',
      requiereCIP: false,
      activo: true,
    },
    {
      codigo: 'AAL',
      nombre: 'ALMACENERO',
      plantilla: 'AAL.docx',
      monto: 2100.0,
      requisitos: 'Técnico en Contabilidad, Administración o estudios universitarios (Bachiller) o estudios concluidos.',
      requiereCIP: false,
      activo: true,
    },
    {
      codigo: 'AG',
      nombre: 'GUARDIÁN DE OBRA',
      plantilla: 'AG.docx',
      monto: 1800.0,
      requisitos: 'Secundaria completa.',
      requiereCIP: false,
      activo: true,
    },
    {
      codigo: 'AM',
      nombre: 'MAESTRO DE OBRA',
      plantilla: 'AM.docx',
      monto: 2600.0,
      requisitos: 'Técnico en Construcción Civil o contar experiencia de 3 años.',
      requiereCIP: false,
      activo: true,
    },
    {
      codigo: 'AT',
      nombre: 'TOPÓGRAFO',
      plantilla: 'AT.docx',
      monto: 2700.0,
      requisitos: 'Técnico o Bachiller en Topografía o Ingeniería c/experiencia.',
      requiereCIP: false,
      activo: true,
    },
    {
      codigo: 'ATS',
      nombre: 'TÉCNICO EN SEGURIDAD',
      plantilla: 'ATS.docx',
      monto: 2500.0,
      requisitos: 'Bachiller en Ingeniería y/o Arquitectura.',
      requiereCIP: false,
      activo: true,
    },
  ];
}

module.exports = {
  cargarCargos,
  guardarCargos,
  obtenerCargosDefault,
};
