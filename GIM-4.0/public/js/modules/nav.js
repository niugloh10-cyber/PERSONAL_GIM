/**
 * SISTEMA GIM v4.0 — NAVEGACIÓN / ENRUTADOR SPA (PLATAFORMA CONFIGURABLE)
 * =======================================================================
 * El menú lateral se CONSTRUYE DINÁMICAMENTE desde el registro de módulos
 * (/api/modulos). El Super Administrador decide qué grupos/módulos se ven,
 * su orden, etiquetas, iconos y permisos, SIN tocar el código.
 *
 * Los cargadores de vista (funciones) permanecen aquí en VIEWS; el registro
 * solo gobierna visibilidad, orden, nombres y agrupación.
 */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  let personalListo = false;
  async function personalSub(sub) {
    if (!personalListo && typeof persInit === 'function') {
      personalListo = true;
      try { await persInit(); } catch (e) { console.error('persInit', e); }
    }
    if (typeof persActivarSubTab === 'function') persActivarSubTab(sub);
  }

  const noop = () => {};
  const safe = (fn) => () => { try { (fn || noop)(); } catch (e) { console.error(e); } };

  const VIEWS = {
    inicio:        { sec: 'tab-inicio',        show: safe(() => loadInicio()) },
    personal:      { sec: 'tab-personal',      show: () => personalSub('p-dashboard') },
    contratos:     { sec: 'tab-personal',      show: () => personalSub('p-contratos') },
    evaluaciones:  { sec: 'tab-personal',      show: () => personalSub('p-evaluaciones') },
    conclusiones:  { sec: 'tab-personal',      show: () => personalSub('p-carta') },
    legajo:        { sec: 'tab-legajo',        show: safe(() => loadLegajo()) },
    asistencia:    { sec: 'tab-asistencia',    show: safe(() => loadAsistencia()) },
    generar:       { sec: 'tab-generar',       show: noop },
    registros:     { sec: 'tab-registros',     show: safe(() => cargarRegistros()) },
    cargos:        { sec: 'tab-cargos',        show: safe(() => { cargarCargos(); cargarPlantillas(); }) },
    proyectos:     { sec: 'tab-proyectos',     show: safe(() => loadProyectosView()) },
    'personal-asignado': { sec: 'tab-personal-asignado', show: safe(() => loadPersonalAsignado()) },
    indicadores:   { sec: 'tab-indicadores',   show: safe(() => loadReportesIndicadores()) },
    estadisticas:  { sec: 'tab-estadisticas',  show: safe(() => loadEstadisticas()) },
    exportaciones: { sec: 'tab-exportaciones',  show: noop },
    usuarios:      { sec: 'tab-usuarios',      show: safe(() => loadUsuarios()) },
    roles:         { sec: 'tab-roles',         show: safe(() => loadRoles()) },
    modulos:       { sec: 'tab-modulos',       show: safe(() => loadModulos()) },
    auditoria:     { sec: 'tab-auditoria',     show: safe(() => loadLogs()) },
    backups:       { sec: 'tab-backups',       show: safe(() => loadBackups()) },
    config:        { sec: 'tab-config',        show: safe(() => { if (typeof cargarConfig === 'function') cargarConfig(); }) },
  };

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const permitido = (perm) => {
    if (!perm) return true;
    return (typeof Auth !== 'undefined' && Auth.tienePermiso) ? Auth.tienePermiso(perm) : true;
  };

  function construirSidebar(config) {
    const nav = $('#navMenu');
    if (!nav || !config || !Array.isArray(config.grupos)) return false;

    const grupos = [...config.grupos]
      .filter(g => g.habilitado !== false)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    let html = '';
    let algunItem = false;

    grupos.forEach(g => {
      const items = [...(g.items || [])]
        .filter(it => it.habilitado !== false)
        .filter(it => VIEWS[it.vista])
        .filter(it => permitido(it.permiso))
        .sort((a, b) => (a.orden || 0) - (b.orden || 0));

      if (!items.length) return;
      algunItem = true;

      const itemsHtml = items.map(it => `
        <div class="nav-item" data-view="${esc(it.vista)}"${it.permiso ? ` data-perm="${esc(it.permiso)}"` : ''}>
          <span class="ic">${esc(it.icono || '•')}</span> ${esc(it.nombre || it.vista)}
        </div>`).join('');

      if (g.sinTitulo) {
        html += `<div class="nav-group"><div class="nav-items">${itemsHtml}</div></div>`;
      } else {
        html += `
          <div class="nav-group" data-group="${esc(g.id)}">
            <div class="nav-group-title"><span>${esc(g.icono || '')} ${esc(g.nombre || '')}</span><span class="chev">▼</span></div>
            <div class="nav-items">${itemsHtml}</div>
          </div>`;
      }
    });

    if (!algunItem) return false;
    nav.innerHTML = html;
    return true;
  }

  function activarVista(view) {
    const cfg = VIEWS[view];
    if (!cfg) return;
    $$('.tab-content').forEach(c => c.classList.toggle('active', c.id === cfg.sec));
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
    const item = $(`.nav-item[data-view="${view}"]`);
    const grp = item ? item.closest('.nav-group') : null;
    if (grp) grp.classList.remove('collapsed');
    $('#sidebar')?.classList.remove('open');
    cfg.show();
    const main = $('.app-main'); if (main) main.scrollTop = 0;
  }
  window.irAVista = activarVista;

  function aplicarPermisos() {
    $$('.nav-item[data-perm]').forEach(it => {
      const ok = permitido(it.dataset.perm);
      it.style.display = ok ? '' : 'none';
    });
  }

  function llenarUsuario() {
    const u = (typeof Auth !== 'undefined' && Auth.getUsuario) ? Auth.getUsuario() : null;
    if (!u) return;
    const n = $('#userName'), r = $('#userRole');
    if (n) n.textContent = `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.email;
    if (r) r.textContent = (u.rol || '').replace('_', ' ');
  }

  function enlazar() {
    $$('.nav-group-title').forEach(t => t.addEventListener('click', () => t.closest('.nav-group').classList.toggle('collapsed')));
    $$('.nav-item').forEach(it => it.addEventListener('click', () => activarVista(it.dataset.view)));
    $('#btnMenuToggle')?.addEventListener('click', () => $('#sidebar')?.classList.toggle('open'));
    $('#btnGestionarProyectosView')?.addEventListener('click', () => {
      if (typeof renderTablaProyectos === 'function') renderTablaProyectos($('#buscadorProyectos')?.value || '');
      $('#modalProyectos')?.classList.remove('hidden');
    });
  }

  // Permite a la vista de administración reconstruir el menú tras guardar.
  window.reconstruirSidebar = async function () {
    try {
      const r = await Auth.fetch_('/modulos');
      if (r && r.ok) construirSidebar(r.modulos);
      enlazar();
      aplicarPermisos();
    } catch (_) {}
  };

  document.addEventListener('DOMContentLoaded', () => {
    let intentos = 0;
    const esperar = setInterval(async () => {
      intentos++;
      const listo = (typeof Auth !== 'undefined' && Auth.getToken && Auth.getToken());
      if (listo || intentos > 50) {
        clearInterval(esperar);
        // El rol "Usuario Básico" usa su vista exclusiva (basico.js).
        const rol = (typeof Auth !== 'undefined' && Auth.getRol) ? Auth.getRol() : '';
        if (rol === 'usuario') { return; }
        try {
          const r = await Auth.fetch_('/modulos');
          if (r && r.ok) construirSidebar(r.modulos);
        } catch (_) {}
        enlazar();
        aplicarPermisos();
        llenarUsuario();
        activarVista('inicio');
      }
    }, 100);
  });
})();
