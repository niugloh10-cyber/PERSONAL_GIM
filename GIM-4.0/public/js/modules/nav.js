/**
 * SISTEMA GIM v4.2 — NAVEGACIÓN / ENRUTADOR SPA
 * ================================================
 * Sidebar dinámico desde /api/modulos + nuevas vistas v4.2
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

  // Mapa de vistas: vista → { sec: id-del-tab, show: función, nombre: etiqueta }
  const VIEWS = {
    inicio:             { sec: 'tab-inicio',            nombre: 'Inicio',               show: safe(() => loadInicio()) },
    // Recursos Humanos
    personal:           { sec: 'tab-personal',          nombre: 'Personal',             show: () => personalSub('p-dashboard') },
    contratos:          { sec: 'tab-personal',          nombre: 'Contratos',            show: () => personalSub('p-contratos') },
    evaluaciones:       { sec: 'tab-personal',          nombre: 'Evaluaciones',         show: () => personalSub('p-evaluaciones') },
    conclusiones:       { sec: 'tab-personal',          nombre: 'Conclusiones',         show: () => personalSub('p-carta') },
    legajo:             { sec: 'tab-legajo',            nombre: 'Legajo Digital',       show: safe(() => loadLegajo()) },
    asistencia:         { sec: 'tab-asistencia',        nombre: 'Asistencia',           show: safe(() => loadAsistencia()) },
    vacaciones:         { sec: 'tab-vacaciones',        nombre: 'Vacaciones',           show: safe(() => loadVacaciones && loadVacaciones()) },
    sanciones:          { sec: 'tab-sanciones',         nombre: 'Sanciones',            show: safe(() => loadSanciones && loadSanciones()) },
    capacitaciones:     { sec: 'tab-capacitaciones',    nombre: 'Capacitaciones',       show: safe(() => loadCapacitaciones && loadCapacitaciones()) },
    // Gestión Documental
    generar:            { sec: 'tab-generar',           nombre: 'Memorandos',           show: noop },
    registros:          { sec: 'tab-registros',         nombre: 'Registros',            show: safe(() => cargarRegistros()) },
    cargos:             { sec: 'tab-cargos',            nombre: 'Cargos',               show: safe(() => { cargarCargos(); cargarPlantillas(); }) },
    // Activos
    activos:            { sec: 'tab-activos',           nombre: 'Activos',              show: safe(() => loadActivos && loadActivos()) },
    // Proyectos
    proyectos:          { sec: 'tab-proyectos',         nombre: 'Proyectos',            show: safe(() => loadProyectosView()) },
    'personal-asignado':{ sec: 'tab-personal-asignado', nombre: 'Personal Asignado',   show: safe(() => loadPersonalAsignado()) },
    organigrama:        { sec: 'tab-organigrama',       nombre: 'Organigrama',          show: safe(() => loadOrganigrama && loadOrganigrama()) },
    // Reportes
    indicadores:        { sec: 'tab-indicadores',       nombre: 'Indicadores',          show: safe(() => loadReportesIndicadores()) },
    estadisticas:       { sec: 'tab-estadisticas',      nombre: 'Estadísticas',         show: safe(() => loadEstadisticas()) },
    exportaciones:      { sec: 'tab-exportaciones',     nombre: 'Exportaciones',        show: noop },
    // Administración
    usuarios:           { sec: 'tab-usuarios',          nombre: 'Usuarios',             show: safe(() => loadUsuarios()) },
    roles:              { sec: 'tab-roles',             nombre: 'Roles',                show: safe(() => loadRoles()) },
    notificaciones:     { sec: 'tab-notificaciones',   nombre: 'Notificaciones',        show: safe(() => loadNotificaciones && loadNotificaciones()) },
    modulos:            { sec: 'tab-modulos',           nombre: 'Módulos',              show: safe(() => loadModulos()) },
    auditoria:          { sec: 'tab-auditoria',         nombre: 'Auditoría',            show: safe(() => loadLogs()) },
    backups:            { sec: 'tab-backups',           nombre: 'Backups',              show: safe(() => loadBackups()) },
    config:             { sec: 'tab-config',            nombre: 'Configuración',        show: safe(() => { if (typeof cargarConfig === 'function') cargarConfig(); }) },
  };

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const permitido = (perm) => {
    if (!perm) return true;
    return (typeof Auth !== 'undefined' && Auth.tienePermiso) ? Auth.tienePermiso(perm) : true;
  };

  // ── Sidebar estático de respaldo (si /api/modulos falla) ──────
  function construirSidebarFallback() {
    const nav = $('#navMenu');
    if (!nav) return;
    nav.innerHTML = `
      <div class="nav-group">
        <div class="nav-items">
          <div class="nav-item active" data-view="inicio"><span class="ic">🏠</span> Inicio</div>
        </div>
      </div>
      <div class="nav-group">
        <div class="nav-group-title"><span>👥 Recursos Humanos</span><span class="chev">▼</span></div>
        <div class="nav-items">
          <div class="nav-item" data-view="personal"><span class="ic">📊</span> Personal</div>
          <div class="nav-item" data-view="contratos"><span class="ic">📋</span> Contratos</div>
          <div class="nav-item" data-view="legajo"><span class="ic">🗂️</span> Legajo Digital</div>
          <div class="nav-item" data-view="asistencia"><span class="ic">🕐</span> Asistencia</div>
          <div class="nav-item" data-view="vacaciones"><span class="ic">🌴</span> Vacaciones</div>
          <div class="nav-item" data-view="evaluaciones"><span class="ic">⭐</span> Evaluaciones</div>
          <div class="nav-item" data-view="conclusiones"><span class="ic">📄</span> Conclusiones</div>
          <div class="nav-item" data-view="sanciones"><span class="ic">⚠️</span> Sanciones</div>
          <div class="nav-item" data-view="capacitaciones"><span class="ic">🎓</span> Capacitaciones</div>
        </div>
      </div>
      <div class="nav-group">
        <div class="nav-group-title"><span>📄 Gestión Documental</span><span class="chev">▼</span></div>
        <div class="nav-items">
          <div class="nav-item" data-view="generar"><span class="ic">✍️</span> Generar Memorando</div>
          <div class="nav-item" data-view="registros"><span class="ic">🗃️</span> Registros</div>
          <div class="nav-item" data-view="cargos"><span class="ic">🏷️</span> Cargos y Plantillas</div>
        </div>
      </div>
      <div class="nav-group">
        <div class="nav-group-title"><span>📦 Activos</span><span class="chev">▼</span></div>
        <div class="nav-items">
          <div class="nav-item" data-view="activos"><span class="ic">📦</span> Control de Activos</div>
        </div>
      </div>
      <div class="nav-group">
        <div class="nav-group-title"><span>🏗️ Proyectos</span><span class="chev">▼</span></div>
        <div class="nav-items">
          <div class="nav-item" data-view="proyectos"><span class="ic">🏗️</span> Proyectos</div>
          <div class="nav-item" data-view="personal-asignado"><span class="ic">👷</span> Personal Asignado</div>
          <div class="nav-item" data-view="organigrama"><span class="ic">🌳</span> Organigrama</div>
        </div>
      </div>
      <div class="nav-group">
        <div class="nav-group-title"><span>📊 Reportes</span><span class="chev">▼</span></div>
        <div class="nav-items">
          <div class="nav-item" data-view="indicadores"><span class="ic">📈</span> Indicadores</div>
          <div class="nav-item" data-view="estadisticas"><span class="ic">📊</span> Estadísticas</div>
          <div class="nav-item" data-view="exportaciones"><span class="ic">⬇️</span> Exportaciones</div>
        </div>
      </div>
      <div class="nav-group">
        <div class="nav-group-title"><span>⚙️ Administración</span><span class="chev">▼</span></div>
        <div class="nav-items">
          <div class="nav-item" data-view="usuarios" data-perm="usuarios.ver"><span class="ic">👤</span> Usuarios</div>
          <div class="nav-item" data-view="roles"><span class="ic">🔐</span> Roles</div>
          <div class="nav-item" data-view="notificaciones"><span class="ic">🔔</span> Notificaciones</div>
          <div class="nav-item" data-view="auditoria" data-perm="logs.ver"><span class="ic">📜</span> Auditoría</div>
          <div class="nav-item" data-view="backups" data-perm="sistema.respaldos"><span class="ic">💿</span> Backups</div>
          <div class="nav-item" data-view="modulos"><span class="ic">🧩</span> Módulos</div>
          <div class="nav-item" data-view="config"><span class="ic">⚙️</span> Configuración</div>
        </div>
      </div>`;
  }

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

    if (!algunItem) { construirSidebarFallback(); return true; }
    nav.innerHTML = html;
    return true;
  }

  let _vistaActual = 'inicio';

  function activarVista(view) {
    const cfg = VIEWS[view];
    if (!cfg) return;
    _vistaActual = view;
    $$('.tab-content').forEach(c => c.classList.toggle('active', c.id === cfg.sec));
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
    const item = $(`.nav-item[data-view="${view}"]`);
    const grp = item ? item.closest('.nav-group') : null;
    if (grp) grp.classList.remove('collapsed');
    $('#sidebar')?.classList.remove('open');
    // Actualizar breadcrumb
    const bc = $('#breadcrumbView');
    if (bc) bc.textContent = cfg.nombre || view;
    cfg.show();
    const main = $('#appMain'); if (main) main.scrollTop = 0;
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
    const n = $('#userName'), r = $('#userRole'), av = $('#userAvatar');
    const nombre = `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.email;
    if (n) n.textContent = nombre;
    if (r) r.textContent = (u.rol || '').replace(/_/g, ' ');
    if (av) av.textContent = (u.nombre || u.email || 'U')[0].toUpperCase();
  }

  async function cargarNotifCount() {
    try {
      const r = await Auth.fetch_('/notificaciones/contar');
      if (r && r.ok) {
        const cnt = r.noLeidas || 0;
        const el = $('#notifCount');
        if (el) {
          el.textContent = cnt;
          el.classList.toggle('visible', cnt > 0);
        }
      }
    } catch (_) {}
  }

  function enlazar() {
    $$('.nav-group-title').forEach(t => t.addEventListener('click', () => t.closest('.nav-group').classList.toggle('collapsed')));
    $$('.nav-item').forEach(it => it.addEventListener('click', () => activarVista(it.dataset.view)));
    $('#btnMenuToggle')?.addEventListener('click', () => $('#sidebar')?.classList.toggle('open'));
    $('#btnLogout')?.addEventListener('click', () => { if (typeof Auth !== 'undefined') Auth.logout(); });
    $('#btnNotif')?.addEventListener('click', () => activarVista('notificaciones'));
    $('#btnGestionarProyectosView')?.addEventListener('click', () => {
      if (typeof renderTablaProyectos === 'function') renderTablaProyectos($('#buscadorProyectos')?.value || '');
      $('#modalProyectos')?.classList.remove('hidden');
    });
    // Cerrar sidebar al hacer click fuera (móvil)
    document.addEventListener('click', (e) => {
      const sb = $('#sidebar');
      if (sb && sb.classList.contains('open') && !sb.contains(e.target) && e.target !== $('#btnMenuToggle')) {
        sb.classList.remove('open');
      }
    });
  }

  window.reconstruirSidebar = async function () {
    try {
      const r = await Auth.fetch_('/modulos');
      if (r && r.ok) construirSidebar(r.modulos);
      else construirSidebarFallback();
    } catch (_) { construirSidebarFallback(); }
    enlazar();
    aplicarPermisos();
  };

  document.addEventListener('DOMContentLoaded', () => {
    let intentos = 0;
    const esperar = setInterval(async () => {
      intentos++;
      const listo = (typeof Auth !== 'undefined' && Auth.getToken && Auth.getToken());
      if (listo || intentos > 50) {
        clearInterval(esperar);
        const rol = (typeof Auth !== 'undefined' && Auth.getRol) ? Auth.getRol() : '';
        if (rol === 'usuario') return;

        try {
          const r = await Auth.fetch_('/modulos');
          if (r && r.ok) construirSidebar(r.modulos);
          else construirSidebarFallback();
        } catch (_) { construirSidebarFallback(); }

        enlazar();
        aplicarPermisos();
        llenarUsuario();
        activarVista('inicio');
        // Actualizar contador de notificaciones cada 2 minutos
        cargarNotifCount();
        setInterval(cargarNotifCount, 2 * 60 * 1000);
      }
    }, 100);
  });
})();
