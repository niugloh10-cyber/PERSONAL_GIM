const fs = require('fs-extra');
const path = require('path');

const CONFIG_DEFAULT = {
  carpetaSalida: '', // Se solicita al usuario en primera ejecución
  rutaBaseDatos: '', // Se autocompleta
  numeroResolucion: '',
  ultimoNumeroMemo: 0,
  prefijoMemo: '0',
  anio: new Date().getFullYear(),
};

async function cargarConfig(rutaConfig) {
  if (!(await fs.pathExists(rutaConfig))) {
    await guardarConfig(rutaConfig, CONFIG_DEFAULT);
    return { ...CONFIG_DEFAULT };
  }
  try {
    const contenido = await fs.readFile(rutaConfig, 'utf-8');
    return { ...CONFIG_DEFAULT, ...JSON.parse(contenido) };
  } catch (e) {
    return { ...CONFIG_DEFAULT };
  }
}

async function guardarConfig(rutaConfig, config) {
  await fs.ensureDir(path.dirname(rutaConfig));
  await fs.writeFile(rutaConfig, JSON.stringify(config, null, 2), 'utf-8');
}

module.exports = { cargarConfig, guardarConfig };
