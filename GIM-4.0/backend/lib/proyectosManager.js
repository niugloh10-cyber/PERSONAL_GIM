const fs = require('fs-extra');
const path = require('path');

/**
 * Carga la lista de proyectos desde el archivo JSON.
 */
async function cargarProyectos(rutaJson) {
  if (!(await fs.pathExists(rutaJson))) {
    await guardarProyectos(rutaJson, []);
    return [];
  }
  try {
    const contenido = await fs.readFile(rutaJson, 'utf-8');
    const lista = JSON.parse(contenido);
    return Array.isArray(lista) ? lista : [];
  } catch (e) {
    return [];
  }
}

async function guardarProyectos(rutaJson, proyectos) {
  await fs.ensureDir(path.dirname(rutaJson));
  await fs.writeFile(rutaJson, JSON.stringify(proyectos, null, 2), 'utf-8');
}

/**
 * Validación de un proyecto.
 * Retorna un array de mensajes de error (vacío si todo está OK).
 */
function validarProyecto(p) {
  const errores = [];
  if (!p) {
    errores.push('Proyecto vacío');
    return errores;
  }
  const cui = String(p.cui || '').trim();
  const nombre = String(p.nombre || '').trim();

  if (!cui) {
    errores.push('CUI obligatorio');
  } else if (!/^\d+$/.test(cui)) {
    errores.push('CUI debe contener solo dígitos');
  } else if (cui.length < 5 || cui.length > 10) {
    errores.push('CUI debe tener entre 5 y 10 dígitos');
  }

  if (!nombre) {
    errores.push('Nombre del proyecto obligatorio');
  } else if (nombre.length < 5) {
    errores.push('Nombre demasiado corto (mínimo 5 caracteres)');
  } else if (nombre.length > 500) {
    errores.push('Nombre demasiado largo (máximo 500 caracteres)');
  }

  return errores;
}

/**
 * Normaliza un proyecto a su estructura canónica.
 */
function normalizarProyecto(p) {
  return {
    cui: String(p.cui || '').trim(),
    nombre: String(p.nombre || '').trim().toUpperCase(),
    componente: String(p.componente || '').trim(),
    resolucion: String(p.resolucion || '').trim(),
    activo: p.activo !== false, // Por defecto activo
    fechaCreacion: p.fechaCreacion || new Date().toISOString(),
  };
}

/**
 * Inserta o actualiza un proyecto (usa CUI como identificador único).
 * Retorna { ok, accion: 'creado'|'actualizado', errores }.
 */
async function upsertProyecto(rutaJson, datos) {
  const errores = validarProyecto(datos);
  if (errores.length > 0) {
    return { ok: false, errores };
  }

  const proyectos = await cargarProyectos(rutaJson);
  const proyecto = normalizarProyecto(datos);

  const idx = proyectos.findIndex((p) => p.cui === proyecto.cui);
  let accion = 'creado';
  if (idx >= 0) {
    proyectos[idx] = { ...proyectos[idx], ...proyecto };
    accion = 'actualizado';
  } else {
    proyectos.push(proyecto);
  }

  await guardarProyectos(rutaJson, proyectos);
  return { ok: true, accion, proyectos };
}

/**
 * Elimina un proyecto por CUI.
 */
async function eliminarProyecto(rutaJson, cui) {
  const proyectos = await cargarProyectos(rutaJson);
  const filtrados = proyectos.filter((p) => p.cui !== cui);
  await guardarProyectos(rutaJson, filtrados);
  return filtrados;
}

/**
 * Activa/desactiva un proyecto por CUI.
 */
async function toggleActivo(rutaJson, cui, activo) {
  const proyectos = await cargarProyectos(rutaJson);
  const idx = proyectos.findIndex((p) => p.cui === cui);
  if (idx < 0) {
    return { ok: false, error: `No existe proyecto con CUI ${cui}` };
  }
  proyectos[idx].activo = !!activo;
  await guardarProyectos(rutaJson, proyectos);
  return { ok: true, proyectos };
}

module.exports = {
  cargarProyectos,
  guardarProyectos,
  upsertProyecto,
  eliminarProyecto,
  toggleActivo,
  validarProyecto,
  normalizarProyecto,
};
