/**
 * SISTEMA GIM v4.2 — VISTAS DE NUEVOS MÓDULOS
 * =============================================
 * Vacaciones, Sanciones, Capacitaciones, Activos, Organigrama, Notificaciones
 */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const notify = (t, m) => { if (typeof Notif !== 'undefined' && Notif[t]) Notif[t](m); };
  const fmtFecha = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const spin = '<tr><td colspan="10" style="text-align:center;padding:40px"><div class="spinner" style="margin:0 auto"></div></td></tr>';
  const badgeMap = {
    aprobado:'badge-green', aprobada:'badge-green', activo:'badge-green', asignado:'badge-blue',
    pendiente:'badge-amber', en_revision:'badge-amber',
    rechazado:'badge-red', rechazada:'badge-red', inactivo:'badge-red', disponible:'badge-gray',
    anulado:'badge-gray', ejecutado:'badge-purple', cumplido:'badge-green', en_mantenimiento:'badge-amber',
  };
  const badge = (v) => `<span class="badge ${badgeMap[(v||'').toLowerCase()] || 'badge-gray'}">${esc(v||'—')}</span>`;

  /* ══════════════════════════════════════════════
     VACACIONES
  ══════════════════════════════════════════════ */
  async function loadVacaciones() {
    const tbody = $('#vacTbody');
    const kpi   = $('#vacKpi');
    if (!tbody) return;
    tbody.innerHTML = spin;
    try {
      const r = await Auth.fetch_('/vacaciones?limit=100');
      if (!r || !r.ok) { tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px">⚠ ${esc(r?.error||'Error al cargar')}</td></tr>`; return; }
      const items = r.solicitudes || [];
      const stats = r.estadisticas || {};
      if (kpi) kpi.innerHTML = `
        <div class="kpi-card"><div class="kpi-icon amber">📋</div><div class="kpi-value">${stats.pendientes||0}</div><div class="kpi-label">Pendientes</div></div>
        <div class="kpi-card"><div class="kpi-icon green">✅</div><div class="kpi-value">${stats.aprobados||0}</div><div class="kpi-label">Aprobados</div></div>
        <div class="kpi-card"><div class="kpi-icon red">❌</div><div class="kpi-value">${stats.rechazados||0}</div><div class="kpi-label">Rechazados</div></div>
        <div class="kpi-card"><div class="kpi-icon blue">📊</div><div class="kpi-value">${r.total||items.length}</div><div class="kpi-label">Total</div></div>`;
      if (!items.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#94a3b8">📭 Sin solicitudes registradas</td></tr>'; return; }
      tbody.innerHTML = items.map(v => `
        <tr>
          <td>${esc((v.nombres||'')+' '+(v.apellidos||'')).trim()||'—'}</td>
          <td>${esc(v.dni)}</td>
          <td>${esc(v.tipo)}</td>
          <td>${fmtFecha(v.fecha_inicio)}</td>
          <td>${fmtFecha(v.fecha_fin)}</td>
          <td>${v.dias_habiles||'—'}</td>
          <td>${badge(v.estado)}</td>
          <td>
            ${v.estado==='pendiente'?`
              <button class="btn btn-success btn-sm" onclick="accionVacacion('${esc(v.id)}','aprobar')">✓</button>
              <button class="btn btn-danger btn-sm" onclick="accionVacacion('${esc(v.id)}','rechazar')">✗</button>`:''}
          </td>
        </tr>`).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px">⚠ Error de conexión</td></tr>'; }
  }
  window.loadVacaciones = loadVacaciones;

  window.abrirModalVacacion = () => {
    // Reuse existing modal if exists, else show a simple prompt flow
    const m = $('#modalVacacionNueva');
    if (m) { m.classList.remove('hidden'); return; }
    // Insert modal if not present
    const div = document.createElement('div');
    div.id = 'modalVacacionNueva';
    div.className = 'modal-overlay';
    div.innerHTML = `
      <div class="modal-box">
        <div class="modal-header"><h3>Nueva Solicitud de Vacaciones</h3><button class="btn-close" onclick="document.getElementById('modalVacacionNueva').classList.add('hidden')">✕</button></div>
        <div class="modal-body">
          <div class="form-group"><label>DNI</label><input id="vnDni" class="form-control" placeholder="12345678" maxlength="8"></div>
          <div class="form-group"><label>Tipo</label>
            <select id="vnTipo" class="form-control">
              <option value="vacaciones_anuales">Vacaciones Anuales</option>
              <option value="adelanto_vacaciones">Adelanto de Vacaciones</option>
              <option value="vacaciones_truncas">Vacaciones Truncas</option>
              <option value="licencia_con_goce">Licencia con Goce</option>
              <option value="licencia_sin_goce">Licencia sin Goce</option>
            </select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label>Fecha Inicio</label><input type="date" id="vnInicio" class="form-control"></div>
            <div class="form-group"><label>Fecha Fin</label><input type="date" id="vnFin" class="form-control"></div>
          </div>
          <div class="form-group"><label>Motivo</label><textarea id="vnMotivo" class="form-control" rows="3"></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('modalVacacionNueva').classList.add('hidden')">Cancelar</button>
          <button class="btn btn-primary" onclick="_guardarVacacion()">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(div);
  };

  window._guardarVacacion = async () => {
    const body = {
      dni: ($('#vnDni')?.value||'').trim(), tipo: $('#vnTipo')?.value,
      fecha_inicio: $('#vnInicio')?.value, fecha_fin: $('#vnFin')?.value,
      motivo: ($('#vnMotivo')?.value||'').trim(),
    };
    if (!body.dni||!body.fecha_inicio||!body.fecha_fin) { notify('warn','Complete los campos requeridos'); return; }
    const r = await Auth.fetch_('/vacaciones',{method:'POST',body:JSON.stringify(body)});
    if (r&&r.ok) { notify('ok','Solicitud registrada'); $('#modalVacacionNueva')?.classList.add('hidden'); loadVacaciones(); }
    else notify('error', r?.error||'Error al guardar');
  };

  window.accionVacacion = async (id, accion) => {
    const motivo = accion==='rechazar' ? (prompt('Motivo de rechazo:') || '') : '';
    const r = await Auth.fetch_(`/vacaciones/${id}/${accion}`,{method:'PUT',body:JSON.stringify({motivo})});
    if (r&&r.ok) { notify('ok', accion==='aprobar'?'Aprobado':'Rechazado'); loadVacaciones(); }
    else notify('error', r?.error||'Error');
  };

  /* ══════════════════════════════════════════════
     SANCIONES
  ══════════════════════════════════════════════ */
  async function loadSanciones() {
    const tbody = $('#sanTbody');
    if (!tbody) return;
    tbody.innerHTML = spin;
    try {
      const r = await Auth.fetch_('/sanciones?limit=100');
      if (!r||!r.ok) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px">⚠ ${esc(r?.error||'Error')}</td></tr>`; return; }
      const items = r.sanciones || [];
      if (!items.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#94a3b8">📭 Sin sanciones registradas</td></tr>'; return; }
      tbody.innerHTML = items.map(s => `
        <tr>
          <td>${esc((s.nombres||'')+' '+(s.apellidos||'')).trim()||'—'}</td>
          <td>${esc(s.dni)}</td>
          <td>${esc(s.tipo)}</td>
          <td>${fmtFecha(s.fecha_inicio)}</td>
          <td>${esc(s.motivo||'—')}</td>
          <td>${badge(s.estado)}</td>
          <td>${s.estado==='activo'?`<button class="btn btn-ghost btn-sm" onclick="cambiarEstadoSancion('${esc(s.id)}','cumplido')">✓ Cumplido</button>`:''}
          </td>
        </tr>`).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px">⚠ Error</td></tr>'; }
  }
  window.loadSanciones = loadSanciones;

  window.abrirModalSancion = () => {
    const m = $('#modalSancionNueva');
    if (m) { m.classList.remove('hidden'); return; }
    const div = document.createElement('div');
    div.id = 'modalSancionNueva';
    div.className = 'modal-overlay';
    div.innerHTML = `
      <div class="modal-box">
        <div class="modal-header"><h3>Registrar Sanción</h3><button class="btn-close" onclick="document.getElementById('modalSancionNueva').classList.add('hidden')">✕</button></div>
        <div class="modal-body">
          <div class="form-group"><label>DNI</label><input id="snDni" class="form-control" maxlength="8" placeholder="12345678"></div>
          <div class="form-group"><label>Tipo</label>
            <select id="snTipo" class="form-control">
              <option value="amonestacion_verbal">Amonestación Verbal</option>
              <option value="amonestacion_escrita">Amonestación Escrita</option>
              <option value="suspension">Suspensión</option>
              <option value="multa">Multa</option>
              <option value="despido">Despido</option>
            </select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label>Fecha Inicio</label><input type="date" id="snFechaInicio" class="form-control"></div>
            <div class="form-group"><label>Fecha Fin</label><input type="date" id="snFechaFin" class="form-control"></div>
          </div>
          <div class="form-group"><label>N° Resolución</label><input id="snResolucion" class="form-control" placeholder="RES-2024-001"></div>
          <div class="form-group"><label>Motivo</label><textarea id="snMotivo" class="form-control" rows="3"></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('modalSancionNueva').classList.add('hidden')">Cancelar</button>
          <button class="btn btn-primary" onclick="_guardarSancion()">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(div);
  };

  window._guardarSancion = async () => {
    const body = {
      dni: ($('#snDni')?.value||'').trim(), tipo: $('#snTipo')?.value,
      fecha_inicio: $('#snFechaInicio')?.value, fecha_fin: $('#snFechaFin')?.value,
      numero_resolucion: ($('#snResolucion')?.value||'').trim(),
      motivo: ($('#snMotivo')?.value||'').trim(),
    };
    if (!body.dni||!body.tipo||!body.fecha_inicio) { notify('warn','Complete los campos requeridos'); return; }
    const r = await Auth.fetch_('/sanciones',{method:'POST',body:JSON.stringify(body)});
    if (r&&r.ok) { notify('ok','Sanción registrada'); $('#modalSancionNueva')?.classList.add('hidden'); loadSanciones(); }
    else notify('error', r?.error||'Error al guardar');
  };

  window.cambiarEstadoSancion = async (id, estado) => {
    const r = await Auth.fetch_(`/sanciones/${id}/estado`,{method:'PUT',body:JSON.stringify({estado})});
    if (r&&r.ok) { notify('ok','Estado actualizado'); loadSanciones(); }
    else notify('error', r?.error||'Error');
  };

  /* ══════════════════════════════════════════════
     CAPACITACIONES
  ══════════════════════════════════════════════ */
  async function loadCapacitaciones() {
    const tbody = $('#capTbody');
    if (!tbody) return;
    tbody.innerHTML = spin;
    try {
      const r = await Auth.fetch_('/capacitaciones?limit=100');
      if (!r||!r.ok) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px">⚠ ${esc(r?.error||'Error')}</td></tr>`; return; }
      const items = r.capacitaciones || [];
      if (!items.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#94a3b8">📭 Sin capacitaciones registradas</td></tr>'; return; }
      tbody.innerHTML = items.map(c => `
        <tr>
          <td>${esc(c.nombre)}</td>
          <td>${esc(c.tipo)}</td>
          <td>${esc(c.institucion||'—')}</td>
          <td>${fmtFecha(c.fecha_inicio)}</td>
          <td>${c.horas||'—'}</td>
          <td><span class="badge badge-blue">${(c.participantes||[]).length}</span></td>
          <td>${badge(c.estado)}</td>
        </tr>`).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px">⚠ Error</td></tr>'; }
  }
  window.loadCapacitaciones = loadCapacitaciones;

  window.abrirModalCapacitacion = () => {
    const m = $('#modalCapacitacionNueva');
    if (m) { m.classList.remove('hidden'); return; }
    const div = document.createElement('div');
    div.id = 'modalCapacitacionNueva';
    div.className = 'modal-overlay';
    div.innerHTML = `
      <div class="modal-box">
        <div class="modal-header"><h3>Nueva Capacitación</h3><button class="btn-close" onclick="document.getElementById('modalCapacitacionNueva').classList.add('hidden')">✕</button></div>
        <div class="modal-body">
          <div class="form-group"><label>Nombre / Título</label><input id="cnNombre" class="form-control" placeholder="Ej: Taller de Excel Avanzado"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label>Tipo</label>
              <select id="cnTipo" class="form-control">
                <option value="taller">Taller</option><option value="seminario">Seminario</option>
                <option value="curso">Curso</option><option value="diplomado">Diplomado</option>
                <option value="charla">Charla</option><option value="otro">Otro</option>
              </select>
            </div>
            <div class="form-group"><label>Modalidad</label>
              <select id="cnModalidad" class="form-control">
                <option value="presencial">Presencial</option><option value="virtual">Virtual</option>
                <option value="hibrido">Híbrido</option>
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
            <div class="form-group"><label>Fecha Inicio</label><input type="date" id="cnFechaInicio" class="form-control"></div>
            <div class="form-group"><label>Fecha Fin</label><input type="date" id="cnFechaFin" class="form-control"></div>
            <div class="form-group"><label>Horas</label><input type="number" id="cnHoras" class="form-control" placeholder="8" min="1"></div>
          </div>
          <div class="form-group"><label>Institución</label><input id="cnInstitucion" class="form-control" placeholder="SERVIR, Universidad…"></div>
          <div class="form-group"><label>Descripción</label><textarea id="cnDesc" class="form-control" rows="2"></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('modalCapacitacionNueva').classList.add('hidden')">Cancelar</button>
          <button class="btn btn-primary" onclick="_guardarCapacitacion()">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(div);
  };

  window._guardarCapacitacion = async () => {
    const body = {
      nombre: ($('#cnNombre')?.value||'').trim(), tipo: $('#cnTipo')?.value,
      modalidad: $('#cnModalidad')?.value, fecha_inicio: $('#cnFechaInicio')?.value,
      fecha_fin: $('#cnFechaFin')?.value, horas: parseInt($('#cnHoras')?.value)||0,
      institucion: ($('#cnInstitucion')?.value||'').trim(),
      descripcion: ($('#cnDesc')?.value||'').trim(),
    };
    if (!body.nombre||!body.fecha_inicio) { notify('warn','Complete los campos requeridos'); return; }
    const r = await Auth.fetch_('/capacitaciones',{method:'POST',body:JSON.stringify(body)});
    if (r&&r.ok) { notify('ok','Capacitación registrada'); $('#modalCapacitacionNueva')?.classList.add('hidden'); loadCapacitaciones(); }
    else notify('error', r?.error||'Error al guardar');
  };

  /* ══════════════════════════════════════════════
     ACTIVOS
  ══════════════════════════════════════════════ */
  async function loadActivos() {
    const tbody = $('#activosTbody');
    const kpi   = $('#activosKpi');
    if (!tbody) return;
    tbody.innerHTML = spin;
    try {
      const q    = ($('#actFiltroQ')?.value||'').trim();
      const cat  = $('#actFiltroCategoria')?.value||'';
      const url  = `/activos?limit=100${q?'&q='+encodeURIComponent(q):''}${cat?'&categoria='+encodeURIComponent(cat):''}`;
      const r = await Auth.fetch_(url);
      if (!r||!r.ok) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px">⚠ ${esc(r?.error||'Error')}</td></tr>`; return; }
      const items = r.activos || [];
      const stats = r.estadisticas || {};
      if (kpi) kpi.innerHTML = `
        <div class="kpi-card"><div class="kpi-icon blue">📦</div><div class="kpi-value">${stats.total||items.length}</div><div class="kpi-label">Total</div></div>
        <div class="kpi-card"><div class="kpi-icon green">✅</div><div class="kpi-value">${stats.disponibles||0}</div><div class="kpi-label">Disponibles</div></div>
        <div class="kpi-card"><div class="kpi-icon amber">👤</div><div class="kpi-value">${stats.asignados||0}</div><div class="kpi-label">Asignados</div></div>
        <div class="kpi-card"><div class="kpi-icon red">🔧</div><div class="kpi-value">${stats.en_mantenimiento||0}</div><div class="kpi-label">Mantenimiento</div></div>`;
      if (!items.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#94a3b8">📭 Sin activos registrados</td></tr>'; return; }
      tbody.innerHTML = items.map(a => `
        <tr>
          <td><code>${esc(a.codigo)}</code></td>
          <td>${esc(a.nombre)}</td>
          <td>${esc(a.categoria)}</td>
          <td>${badge(a.estado)}</td>
          <td>${esc(a.asignado_a_nombre||'—')}</td>
          <td>
            ${a.estado==='disponible'?`<button class="btn btn-ghost btn-sm" onclick="_abrirAsignarActivo('${esc(a.id)}')">Asignar</button>`:''}
            ${a.estado==='asignado'?`<button class="btn btn-ghost btn-sm" onclick="_desasignarActivo('${esc(a.id)}')">Liberar</button>`:''}
          </td>
        </tr>`).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px">⚠ Error</td></tr>'; }
  }
  window.loadActivos = loadActivos;

  window.abrirModalActivo = () => {
    const m = $('#modalActivoNuevo');
    if (m) { m.classList.remove('hidden'); return; }
    const div = document.createElement('div');
    div.id = 'modalActivoNuevo';
    div.className = 'modal-overlay';
    div.innerHTML = `
      <div class="modal-box">
        <div class="modal-header"><h3>Registrar Activo</h3><button class="btn-close" onclick="document.getElementById('modalActivoNuevo').classList.add('hidden')">✕</button></div>
        <div class="modal-body">
          <div class="form-group"><label>Nombre del Activo</label><input id="anNombre" class="form-control" placeholder="Ej: Laptop Dell Latitude"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label>Categoría</label>
              <select id="anCategoria" class="form-control">
                <option value="equipo_computo">Equipo de Cómputo</option><option value="mobiliario">Mobiliario</option>
                <option value="vehiculo">Vehículo</option><option value="herramienta">Herramienta</option>
                <option value="equipo_medicion">Equipo de Medición</option><option value="otro">Otro</option>
              </select>
            </div>
            <div class="form-group"><label>Valor (S/)</label><input type="number" id="anValor" class="form-control" placeholder="0.00" step="0.01" min="0"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label>N° Serie</label><input id="anSerie" class="form-control"></div>
            <div class="form-group"><label>Fecha Adquisición</label><input type="date" id="anFecha" class="form-control"></div>
          </div>
          <div class="form-group"><label>Observaciones</label><textarea id="anObs" class="form-control" rows="2"></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('modalActivoNuevo').classList.add('hidden')">Cancelar</button>
          <button class="btn btn-primary" onclick="_guardarActivo()">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(div);
  };

  window._guardarActivo = async () => {
    const body = {
      nombre: ($('#anNombre')?.value||'').trim(), categoria: $('#anCategoria')?.value,
      valor_adquisicion: parseFloat($('#anValor')?.value)||0,
      numero_serie: ($('#anSerie')?.value||'').trim(),
      fecha_adquisicion: $('#anFecha')?.value,
      observaciones: ($('#anObs')?.value||'').trim(),
    };
    if (!body.nombre) { notify('warn','Ingrese el nombre del activo'); return; }
    const r = await Auth.fetch_('/activos',{method:'POST',body:JSON.stringify(body)});
    if (r&&r.ok) { notify('ok',`Activo registrado: ${r.activo?.codigo}`); $('#modalActivoNuevo')?.classList.add('hidden'); loadActivos(); }
    else notify('error', r?.error||'Error al guardar');
  };

  window._abrirAsignarActivo = (id) => {
    let m = $('#modalAsignarActivoNuevo');
    if (!m) {
      const div = document.createElement('div');
      div.id = 'modalAsignarActivoNuevo';
      div.className = 'modal-overlay';
      div.innerHTML = `
        <div class="modal-box" style="max-width:380px">
          <div class="modal-header"><h3>Asignar Activo</h3><button class="btn-close" onclick="document.getElementById('modalAsignarActivoNuevo').classList.add('hidden')">✕</button></div>
          <div class="modal-body">
            <input type="hidden" id="aaId">
            <div class="form-group"><label>DNI del Responsable</label><input id="aaDni" class="form-control" maxlength="8" placeholder="12345678"></div>
            <div class="form-group"><label>Observación</label><input id="aaObs" class="form-control"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('modalAsignarActivoNuevo').classList.add('hidden')">Cancelar</button>
            <button class="btn btn-primary" onclick="_confirmarAsignarActivo()">Asignar</button>
          </div>
        </div>`;
      document.body.appendChild(div);
      m = div;
    }
    $('#aaId').value = id;
    m.classList.remove('hidden');
  };

  window._confirmarAsignarActivo = async () => {
    const id = $('#aaId')?.value;
    const body = { dni:($('#aaDni')?.value||'').trim(), observacion:($('#aaObs')?.value||'').trim() };
    if (!body.dni) { notify('warn','Ingrese el DNI'); return; }
    const r = await Auth.fetch_(`/activos/${id}/asignar`,{method:'PUT',body:JSON.stringify(body)});
    if (r&&r.ok) { notify('ok','Activo asignado'); $('#modalAsignarActivoNuevo')?.classList.add('hidden'); loadActivos(); }
    else notify('error', r?.error||'Error');
  };

  window._desasignarActivo = async (id) => {
    if (!confirm('¿Liberar este activo?')) return;
    const r = await Auth.fetch_(`/activos/${id}/desasignar`,{method:'PUT',body:'{}'});
    if (r&&r.ok) { notify('ok','Activo liberado'); loadActivos(); }
    else notify('error', r?.error||'Error');
  };

  /* ══════════════════════════════════════════════
     ORGANIGRAMA
  ══════════════════════════════════════════════ */
  async function loadOrganigrama() {
    const cont = $('#orgContainer');
    if (!cont) return;
    cont.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Cargando…</p></div>';
    try {
      const r = await Auth.fetch_('/organigrama');
      if (!r||!r.ok) { cont.innerHTML = `<div class="empty-state">⚠ ${esc(r?.error||'Error')}</div>`; return; }
      _renderOrganigrama(r.nodos||[], cont);
    } catch (e) { cont.innerHTML = '<div class="empty-state">⚠ Error de conexión</div>'; }
  }
  window.loadOrganigrama = loadOrganigrama;

  function _buildTree(nodos) {
    const map = {};
    nodos.forEach(n => { map[n.id] = {...n, hijos:[]}; });
    const roots = [];
    nodos.forEach(n => {
      if (n.parentId && map[n.parentId]) map[n.parentId].hijos.push(map[n.id]);
      else roots.push(map[n.id]);
    });
    return roots;
  }

  function _renderNodo(n, nivel) {
    const colors = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626'];
    const c = colors[nivel % colors.length];
    const hijos = (n.hijos||[]).sort((a,b)=>(a.orden||0)-(b.orden||0));
    return `<div style="display:inline-flex;flex-direction:column;align-items:center;margin:0 8px">
      <div style="background:#fff;border:2px solid ${c};border-radius:10px;padding:10px 16px;min-width:140px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <div style="font-size:20px">${esc(n.icono||'🏛️')}</div>
        <div style="font-weight:700;font-size:13px;color:#1e293b">${esc(n.nombre)}</div>
        ${n.cargo?`<div style="font-size:11px;color:#64748b">${esc(n.cargo)}</div>`:''}
        ${n.titular?`<div style="font-size:11px;color:#475569;margin-top:2px">${esc(n.titular)}</div>`:''}
      </div>
      ${hijos.length?`
        <div style="width:2px;height:20px;background:#e2e8f0"></div>
        <div style="display:flex;align-items:flex-start;position:relative">
          ${hijos.length>1?'<div style="position:absolute;top:0;left:0;right:0;height:2px;background:#e2e8f0"></div>':''}
          ${hijos.map(h=>`<div style="display:flex;flex-direction:column;align-items:center">
            <div style="width:2px;height:20px;background:#e2e8f0"></div>
            ${_renderNodo(h, nivel+1)}
          </div>`).join('')}
        </div>`:''}
    </div>`;
  }

  function _renderOrganigrama(nodos, cont) {
    const roots = _buildTree(nodos);
    if (!nodos.length) {
      cont.innerHTML = `<div class="empty-state"><span>🌳</span><h4>Sin estructura definida</h4><p>Agregue el nodo raíz para construir el organigrama</p><button class="btn btn-primary" onclick="abrirModalNodoOrg()">Agregar primer nodo</button></div>`;
      return;
    }
    cont.innerHTML = `<div style="overflow-x:auto;padding:20px 0"><div style="display:flex;justify-content:center">${roots.map(r=>_renderNodo(r,0)).join('')}</div></div>`;
  }

  window.abrirModalNodoOrg = () => {
    const m = $('#modalNodoOrgNuevo');
    if (m) { m.classList.remove('hidden'); return; }
    const div = document.createElement('div');
    div.id = 'modalNodoOrgNuevo';
    div.className = 'modal-overlay';
    div.innerHTML = `
      <div class="modal-box" style="max-width:420px">
        <div class="modal-header"><h3>Agregar Nodo</h3><button class="btn-close" onclick="document.getElementById('modalNodoOrgNuevo').classList.add('hidden')">✕</button></div>
        <div class="modal-body">
          <div class="form-group"><label>Nombre</label><input id="noNombre" class="form-control" placeholder="Ej: Gerencia de Ingeniería"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label>Cargo</label><input id="noCargo" class="form-control" placeholder="Gerente"></div>
            <div class="form-group"><label>Icono</label><input id="noIcono" class="form-control" value="🏛️"></div>
          </div>
          <div class="form-group"><label>Titular</label><input id="noTitular" class="form-control" placeholder="Nombre del titular"></div>
          <div class="form-group"><label>ID del Padre (vacío = raíz)</label><input id="noParent" class="form-control"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('modalNodoOrgNuevo').classList.add('hidden')">Cancelar</button>
          <button class="btn btn-primary" onclick="_guardarNodoOrg()">Agregar</button>
        </div>
      </div>`;
    document.body.appendChild(div);
  };

  window._guardarNodoOrg = async () => {
    const body = {
      nombre: ($('#noNombre')?.value||'').trim(),
      cargo: ($('#noCargo')?.value||'').trim(),
      icono: ($('#noIcono')?.value||'🏛️').trim(),
      titular: ($('#noTitular')?.value||'').trim(),
      parentId: ($('#noParent')?.value||'').trim()||null,
    };
    if (!body.nombre) { notify('warn','Ingrese el nombre del nodo'); return; }
    const r = await Auth.fetch_('/organigrama/nodo',{method:'POST',body:JSON.stringify(body)});
    if (r&&r.ok) { notify('ok','Nodo agregado'); $('#modalNodoOrgNuevo')?.classList.add('hidden'); loadOrganigrama(); }
    else notify('error', r?.error||'Error al guardar');
  };

  /* ══════════════════════════════════════════════
     NOTIFICACIONES
  ══════════════════════════════════════════════ */
  async function loadNotificaciones() {
    const cont = $('#notifList');
    if (!cont) return;
    cont.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Cargando…</p></div>';
    try {
      const r = await Auth.fetch_('/notificaciones?limit=50');
      if (!r||!r.ok) { cont.innerHTML = `<div class="empty-state">⚠ ${esc(r?.error||'Error')}</div>`; return; }
      const items = r.notificaciones || [];
      const noLeidas = items.filter(n=>!n.leida).length;
      cont.innerHTML = items.length===0
        ? '<div class="empty-state" style="padding:40px">📭 Sin notificaciones</div>'
        : `<div class="card-header" style="padding:12px 20px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center">
            <span>${noLeidas>0?`<span class="badge badge-red">${noLeidas} sin leer</span>`:'<span class="badge badge-green">Todo leído</span>'}</span>
            ${noLeidas>0?`<button class="btn btn-ghost btn-sm" onclick="marcarTodasLeidasNotif()">✓ Marcar todas</button>`:''}
          </div>
          ${items.map(n=>`
            <div style="padding:14px 20px;border-bottom:1px solid #f1f5f9;display:flex;gap:12px;align-items:flex-start;background:${n.leida?'#fff':'#eff6ff'}">
              <span style="font-size:22px;flex-shrink:0">${n.icono||'🔔'}</span>
              <div style="flex:1;min-width:0">
                <div style="font-weight:${n.leida?'400':'600'};font-size:14px;color:#1e293b">${esc(n.titulo)}</div>
                <div style="font-size:13px;color:#64748b;margin-top:2px">${esc(n.mensaje||'')}</div>
                <div style="font-size:11px;color:#94a3b8;margin-top:4px">${fmtFecha(n.creado_en)}</div>
              </div>
              ${!n.leida?`<button class="btn btn-ghost btn-sm" onclick="marcarNotifLeida('${esc(n.id)}')">✓</button>`:''}
            </div>`).join('')}`;
    } catch (e) { cont.innerHTML = '<div class="empty-state">⚠ Error de conexión</div>'; }
  }
  window.loadNotificaciones = loadNotificaciones;

  window.marcarTodasLeidasNotif = async () => {
    const r = await Auth.fetch_('/notificaciones/leer-todas',{method:'PUT',body:'{}'});
    if (r&&r.ok) { notify('ok','Todas marcadas como leídas'); loadNotificaciones(); }
    else notify('error', r?.error||'Error');
  };

  window.marcarNotifLeida = async (id) => {
    const r = await Auth.fetch_(`/notificaciones/${id}/leer`,{method:'PUT',body:'{}'});
    if (r&&r.ok) loadNotificaciones();
  };

})();
