/**
 * SISTEMA GIM v4.0 - GESTOR DE MÓDULOS CONFIGURABLES
 * ===================================================
 * Convierte el sistema en una PLATAFORMA CONFIGURABLE: el Super
 * Administrador puede habilitar, deshabilitar, reorganizar y renombrar
 * grupos, módulos (vistas) y sus permisos SIN MODIFICAR EL CÓDIGO FUENTE.
 *
 * El registro vive en data/modulos.json. Cada elemento define:
 *   - grupos[]   : agrupaciones del menú lateral
 *       { id, nombre, icono, habilitado, orden, items[] }
 *   - items[]    : módulos/vistas dentro de un grupo
 *       { id, nombre, icono, vista, habilitado, orden, permiso, apiPrefijos[] }
 *
 * Las FUNCIONES (cargadores de vista) permanecen en el código, pero la
 * VISIBILIDAD, ORDEN, ETIQUETAS, AGRUPACIÓN y PERMISOS son 100% datos.
 */
'use strict';

const fs   = require('fs-extra');
const path = require('path');

/** Catálogo base — refleja el sidebar original de GIM v4.0. */
function configPorDefecto() {
  return {
    version: 1,
    actualizado: new Date().toISOString(),
    grupos: [
      {
        id: 'inicio', nombre: '', icono: '', habilitado: true, orden: 1, sinTitulo: true,
        items: [
          { id: 'inicio', nombre: 'Inicio', icono: '🏠', vista: 'inicio', habilitado: true, orden: 1, permiso: '', apiPrefijos: [] },
        ],
      },
      {
        id: 'rrhh', nombre: 'Recursos Humanos', icono: '👥', habilitado: true, orden: 2,
        items: [
          { id: 'personal',     nombre: 'Personal',       icono: '📊',  vista: 'personal',     habilitado: true, orden: 1, permiso: 'registros.ver', apiPrefijos: ['/api/personal'] },
          { id: 'contratos',    nombre: 'Contratos',      icono: '📋',  vista: 'contratos',    habilitado: true, orden: 2, permiso: 'registros.ver', apiPrefijos: [] },
          { id: 'legajo',       nombre: 'Legajo Digital', icono: '🗂️',  vista: 'legajo',       habilitado: true, orden: 3, permiso: 'legajo.ver', apiPrefijos: ['/api/legajo'] },
          { id: 'asistencia',   nombre: 'Asistencia',     icono: '🕐',  vista: 'asistencia',   habilitado: true, orden: 4, permiso: 'asistencia.ver', apiPrefijos: ['/api/asistencia'] },
          { id: 'evaluaciones', nombre: 'Evaluaciones',   icono: '⭐',  vista: 'evaluaciones', habilitado: true, orden: 5, permiso: 'registros.ver', apiPrefijos: ['/api/personal/evaluaciones'] },
          { id: 'conclusiones', nombre: 'Conclusiones',   icono: '📄',  vista: 'conclusiones', habilitado: true, orden: 6, permiso: 'registros.ver', apiPrefijos: ['/api/personal/carta-conclusion'] },
        ],
      },
      {
        id: 'docs', nombre: 'Gestión Documental', icono: '📄', habilitado: true, orden: 3,
        items: [
          { id: 'generar',   nombre: 'Memorandos',          icono: '✍️', vista: 'generar',   habilitado: true, orden: 1, permiso: 'generar.ver', apiPrefijos: ['/api/generar', '/api/preview'] },
          { id: 'registros', nombre: 'Registros',           icono: '🗃️', vista: 'registros', habilitado: true, orden: 2, permiso: 'registros.ver', apiPrefijos: ['/api/registros'] },
          { id: 'cargos',    nombre: 'Cargos y Plantillas', icono: '🏷️', vista: 'cargos',    habilitado: true, orden: 3, permiso: 'cargos.ver', apiPrefijos: ['/api/cargos', '/api/plantillas'] },
        ],
      },
      {
        id: 'proy', nombre: 'Proyectos', icono: '🏗️', habilitado: true, orden: 4,
        items: [
          { id: 'proyectos',         nombre: 'Proyectos',         icono: '🏗️', vista: 'proyectos',         habilitado: true, orden: 1, permiso: 'registros.ver', apiPrefijos: ['/api/proyectos'] },
          { id: 'personal-asignado', nombre: 'Personal Asignado', icono: '👷', vista: 'personal-asignado', habilitado: true, orden: 2, permiso: 'registros.ver', apiPrefijos: [] },
        ],
      },
      {
        id: 'rep', nombre: 'Reportes', icono: '📊', habilitado: true, orden: 5,
        items: [
          { id: 'indicadores',   nombre: 'Indicadores',   icono: '📈', vista: 'indicadores',   habilitado: true, orden: 1, permiso: 'registros.ver', apiPrefijos: ['/api/reportes'] },
          { id: 'estadisticas',  nombre: 'Estadísticas',  icono: '📊', vista: 'estadisticas',  habilitado: true, orden: 2, permiso: 'registros.ver', apiPrefijos: [] },
          { id: 'exportaciones', nombre: 'Exportaciones', icono: '⬇️', vista: 'exportaciones', habilitado: true, orden: 3, permiso: 'registros.exportar', apiPrefijos: [] },
        ],
      },
      {
        id: 'admin', nombre: 'Administración', icono: '⚙️', habilitado: true, orden: 6,
        items: [
          { id: 'usuarios',  nombre: 'Usuarios',           icono: '👤', vista: 'usuarios',  habilitado: true, orden: 1, permiso: 'usuarios.ver',     apiPrefijos: ['/api/usuarios'] },
          { id: 'roles',     nombre: 'Roles',              icono: '🔐', vista: 'roles',     habilitado: true, orden: 2, permiso: 'usuarios.ver',                apiPrefijos: [] },
          { id: 'modulos',   nombre: 'Módulos del Sistema',icono: '🧩', vista: 'modulos',   habilitado: true, orden: 3, permiso: 'modulos.configurar', apiPrefijos: [] },
          { id: 'auditoria', nombre: 'Auditoría',          icono: '📜', vista: 'auditoria', habilitado: true, orden: 4, permiso: 'logs.ver',        apiPrefijos: ['/api/logs'] },
          { id: 'backups',   nombre: 'Backups',            icono: '💿', vista: 'backups',   habilitado: true, orden: 5, permiso: 'sistema.respaldos', apiPrefijos: ['/api/backup'] },
          { id: 'config',    nombre: 'Configuración',      icono: '⚙️', vista: 'config',    habilitado: true, orden: 6, permiso: 'config.ver',                apiPrefijos: ['/api/config'] },
        ],
      },
    ],
  };
}

/** Prefijos de API que NUNCA deben bloquearse (núcleo del sistema). */
const PREFIJOS_PROTEGIDOS = ['/api/auth', '/api/info', '/api/modulos', '/api/config'];

let _cache = null;
let _rutaCache = null;

async function cargar(ruta) {
  if (_cache && _rutaCache === ruta) return _cache;
  try {
    if (await fs.pathExists(ruta)) {
      const data = JSON.parse(await fs.readFile(ruta, 'utf-8'));
      _cache = _fusionarConDefecto(data);
      _rutaCache = ruta;
      return _cache;
    }
  } catch (_) { /* fallback abajo */ }
  const def = configPorDefecto();
  await guardar(ruta, def);
  return def;
}

/**
 * Fusiona el archivo guardado con el catálogo por defecto para garantizar
 * que módulos NUEVOS introducidos por actualizaciones aparezcan aunque el
 * usuario tenga un modulos.json antiguo (sin perder sus personalizaciones).
 */
function _fusionarConDefecto(guardado) {
  const def = configPorDefecto();
  if (!guardado || !Array.isArray(guardado.grupos)) return def;

  const gruposGuardados = new Map(guardado.grupos.map(g => [g.id, g]));
  const idsGuardados = new Set(guardado.grupos.map(g => g.id));

  // 1) Conservar grupos del usuario (con su orden/estado), enriqueciendo items nuevos.
  const fusion = guardado.grupos.map(g => {
    const base = def.grupos.find(d => d.id === g.id);
    if (!base) return g; // grupo creado por el usuario
    const itemsBase = new Map(base.items.map(i => [i.id, i]));
    const itemsGuardados = new Map((g.items || []).map(i => [i.id, i]));
    // Mantener items del usuario
    const items = (g.items || []).map(i => ({ ...itemsBase.get(i.id), ...i }));
    // Añadir items nuevos del catálogo que el usuario aún no tiene
    base.items.forEach(ib => { if (!itemsGuardados.has(ib.id)) items.push({ ...ib }); });
    return { ...base, ...g, items };
  });

  // 2) Añadir grupos nuevos del catálogo ausentes en el guardado.
  def.grupos.forEach(d => { if (!idsGuardados.has(d.id)) fusion.push({ ...d }); });

  return { ...def, ...guardado, grupos: fusion };
}

async function guardar(ruta, config) {
  config.actualizado = new Date().toISOString();
  await fs.ensureDir(path.dirname(ruta));
  await fs.writeFile(ruta, JSON.stringify(config, null, 2), 'utf-8');
  _cache = config;
  _rutaCache = ruta;
  return config;
}

async function resetear(ruta) {
  const def = configPorDefecto();
  return guardar(ruta, def);
}

/** Aplana todos los items (módulos) en una sola lista, con su grupo. */
function itemsPlanos(config) {
  const out = [];
  (config.grupos || []).forEach(g => {
    (g.items || []).forEach(it => out.push({ ...it, grupoId: g.id, grupoHabilitado: g.habilitado !== false }));
  });
  return out;
}

/**
 * Determina si una ruta de API está habilitada según el registro.
 * Usa coincidencia por prefijo MÁS ESPECÍFICO (el más largo gana) para no
 * bloquear sub-rutas por error. Rutas protegidas siempre pasan.
 */
function rutaApiHabilitada(config, rutaApi) {
  if (PREFIJOS_PROTEGIDOS.some(p => rutaApi.startsWith(p))) return true;

  let mejor = null; // { len, habilitado }
  itemsPlanos(config).forEach(it => {
    (it.apiPrefijos || []).forEach(pref => {
      if (rutaApi === pref || rutaApi.startsWith(pref + '/') || rutaApi.startsWith(pref)) {
        const habilitado = it.habilitado !== false && it.grupoHabilitado;
        if (!mejor || pref.length > mejor.len) mejor = { len: pref.length, habilitado };
      }
    });
  });

  // Si ningún módulo reclama la ruta, se permite (rutas de servicio interno).
  return mejor ? mejor.habilitado : true;
}

module.exports = {
  cargar, guardar, resetear, configPorDefecto,
  itemsPlanos, rutaApiHabilitada, PREFIJOS_PROTEGIDOS,
  invalidarCache: () => { _cache = null; _rutaCache = null; },
};
