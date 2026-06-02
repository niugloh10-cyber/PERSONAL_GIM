/**
 * SISTEMA GIM v4.0 — VISTAS / CARGADORES DE MÓDULOS
 * ==================================================
 * Lógica de las vistas nuevas: Inicio, Legajo Digital, Asistencia,
 * Proyectos, Reportes, Usuarios, Roles, Auditoría y Backups.
 * Reutiliza Auth.fetch_ / Auth.fetchForm y Notif del sistema base.
 */
(function () {
  'use strict';

  const esc = (s) => (typeof escapeHtml === 'function'
    ? escapeHtml(s)
    : String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])));
  const notify = (t, m) => { if (typeof Notif !== 'undefined' && Notif[t]) Notif[t](m); };
  const fmtFecha = (iso) => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString('es-PE'); };
  const $ = (s) => document.querySelector(s);

  /* ════════════ INICIO ════════════ */
  async function loadInicio() {
    const cont = $('#inicioKpis');
    if (!cont) return;
    cont.innerHTML = '<div class="kpi-card accent"><div class="kpi-label">Cargando…</div></div>';
    const r = await Auth.fetch_('/reportes/indicadores');
    if (!r.ok) { cont.innerHTML = '<div class="kpi-card red"><div class="kpi-label">Error al cargar indicadores</div></div>'; return; }
    const i = r.indicadores;
    cont.innerHTML = `
      ${kpi('accent', 'Memorandos', i.documentos.totalMemorandos, 'Documentos generados')}
      ${kpi('green',  'Contratos activos', i.personal.contratosActivos, `de ${i.personal.totalContratos} totales`)}
      ${kpi('amber',  'Por vencer (30d)', i.personal.alertas30d ?? 0, 'Alertas de vencimiento')}
      ${kpi('accent', 'Proyectos activos', i.proyectos.activos, `de ${i.proyectos.total} en cartera`)}
      ${kpi('green',  'Expedientes', i.expedientes.totalExpedientes ?? 0, `${i.expedientes.totalDocumentos ?? 0} documentos`)}
      ${kpi('amber',  'Asistencias', i.asistencia.totalRegistros ?? 0, `${i.asistencia.trabajadores ?? 0} trabajadores`)}`;
  }
  const kpi = (cls, label, val, sub) =>
    `<div class="kpi-card ${cls}"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${val ?? 0}</div><div class="kpi-sub">${esc(sub)}</div></div>`;

  /* ════════════ LEGAJO DIGITAL ════════════ */
  // Orden de visualización: "Nombres y Apellidos".
  function nombreDisplay(e) {
    const d = (e && e.datos) || {};
    if (d.nombresApellidos) return d.nombresApellidos;
    if (d.nombres && d.apellidos) return `${d.nombres} ${d.apellidos}`;
    return e ? (e.apellidosNombres || '') : '';
  }
  window.nombreDisplayLegajo = nombreDisplay;

  async function loadLegajo() {
    const tb = $('#legajoTbody'); if (!tb) return;
    // El botón "Sincronizar" requiere permiso de edición de legajo.
    const btnSync = document.querySelector('[onclick="sincronizarLegajo()"]');
    if (btnSync) {
      const puede = (typeof Auth !== 'undefined' && Auth.tienePermiso) ? Auth.tienePermiso('legajo.editar') : true;
      btnSync.style.display = puede ? '' : 'none';
    }
    const q = $('#legajoBuscar')?.value || '';
    const r = await Auth.fetch_('/legajo' + (q ? `?q=${encodeURIComponent(q)}` : ''));
    if (!r.ok) { tb.innerHTML = `<tr><td colspan="7" class="td-empty">Error: ${esc(r.error)}</td></tr>`; return; }
    if (!r.expedientes.length) { tb.innerHTML = '<tr><td colspan="7" class="td-empty">Sin expedientes.</td></tr>'; return; }
    tb.innerHTML = r.expedientes.map(e => `
      <tr>
        <td><code>${esc(e.codigo)}</code></td>
        <td>${esc(e.dni)}</td>
        <td>${esc(nombreDisplay(e))}</td>
        <td>${esc(e.cargo || '—')}</td>
        <td style="text-align:center">${e.documentos?.length || 0}</td>
        <td><span class="badge-estado">${esc(e.estado)}</span></td>
        <td><button class="btn btn-sm btn-secondary" onclick="abrirExpediente('${esc(e.codigo)}')">Abrir</button></td>
      </tr>`).join('');
  }

  function abrirModalNuevoExpediente() {
    const set = (id, v) => { const el = $('#' + id); if (el) el.value = v; };
    set('expDni', ''); set('expNombres', ''); set('expApellidos', ''); set('expCargo', '');
    const m = $('#expMsg'); if (m) m.textContent = '';
    $('#modalExpediente').classList.remove('hidden');
  }

  async function crearExpediente() {
    const dni = ($('#expDni').value || '').replace(/\D/g, '');
    const nombres = ($('#expNombres').value || '').trim();
    const apellidos = ($('#expApellidos').value || '').trim();
    if (dni.length !== 8) { $('#expMsg').textContent = 'DNI inválido (8 dígitos).'; return; }
    if (nombres.length < 2 || apellidos.length < 2) { $('#expMsg').textContent = 'Ingrese nombres y apellidos.'; return; }
    const apellidosNombres = `${apellidos} ${nombres}`.trim(); // formato oficial para documentos
    const r = await Auth.fetch_('/legajo', { method: 'POST', body: JSON.stringify({ dni, nombres, apellidos, apellidosNombres, cargo: $('#expCargo').value.trim() }) });
    if (!r.ok) { $('#expMsg').textContent = r.error || 'Error'; return; }
    $('#modalExpediente').classList.add('hidden');
    notify('success', `Expediente ${r.expediente.codigo} listo`);
    await loadLegajo();
    abrirExpediente(r.expediente.codigo);
  }

  let _expCategorias = null;
  async function abrirExpediente(codigo) {
    const r = await Auth.fetch_('/legajo/' + encodeURIComponent(codigo));
    if (!r.ok) { notify('error', r.error || 'No se pudo abrir'); return; }
    const e = r.expediente;
    $('#expDetTitulo').textContent = `${e.codigo} · ${nombreDisplay(e)}`;
    $('#expDetDni').value = e.dni; $('#expDetCodigo').value = e.codigo;
    if (!_expCategorias) {
      const c = await Auth.fetch_('/legajo/categorias');
      _expCategorias = c.ok ? c.categorias : ['OTROS'];
    }
    $('#expDocCategoria').innerHTML = _expCategorias.map(c => `<option value="${c}">${c.replace(/_/g, ' ')}</option>`).join('');
    renderDocsExpediente(e);
    $('#expDocMsg').textContent = '';
    $('#modalExpDetalle').classList.remove('hidden');
  }

  function renderDocsExpediente(e) {
    const tb = $('#expDocsTbody');
    if (!e.documentos || !e.documentos.length) { tb.innerHTML = '<tr><td colspan="4" class="td-empty">Sin documentos.</td></tr>'; return; }
    const puedeEditar = (typeof Auth !== 'undefined' && Auth.tienePermiso) ? Auth.tienePermiso('legajo.editar') : true;
    tb.innerHTML = e.documentos.map(d => `
      <tr>
        <td><span class="perm-chip">${esc((d.categoria || '').replace(/_/g, ' '))}</span></td>
        <td>${esc(d.nombreOriginal)}${d.descripcion ? `<br><small style="color:#94a3b8">${esc(d.descripcion)}</small>` : ''}</td>
        <td>${fmtFecha(d.fecha)}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="descargarDocLegajo('${esc(e.codigo)}','${esc(d.id)}')">⬇️</button>
          ${puedeEditar ? `<button class="btn btn-sm btn-danger" onclick="eliminarDocLegajo('${esc(e.codigo)}','${esc(d.id)}')">🗑️</button>` : ''}
        </td>
      </tr>`).join('');
  }

  async function subirDocLegajo() {
    const dni = $('#expDetDni').value;
    const file = $('#expDocArchivo').files[0];
    if (!file) { $('#expDocMsg').textContent = 'Seleccione un archivo.'; return; }
    const fd = new FormData();
    fd.append('archivo', file);
    fd.append('categoria', $('#expDocCategoria').value);
    fd.append('descripcion', $('#expDocDesc').value || '');
    $('#expDocMsg').textContent = 'Subiendo…';
    const r = await Auth.fetchForm(`/legajo/${dni}/documento`, fd);
    if (!r.ok) { $('#expDocMsg').textContent = r.error || 'Error'; return; }
    $('#expDocArchivo').value = ''; $('#expDocDesc').value = '';
    $('#expDocMsg').textContent = '✓ Documento agregado';
    renderDocsExpediente(r.expediente);
    loadLegajo();
  }

  async function descargarDocLegajo(codigo, docId) {
    const t = Auth.getToken();
    const resp = await fetch(`/api/legajo/${codigo}/documento/${docId}`, { headers: { Authorization: `Bearer ${t}` } });
    if (!resp.ok) { notify('error', 'No se pudo descargar'); return; }
    const blob = await resp.blob();
    const cd = resp.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="?([^"]+)"?/);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = m ? m[1] : 'documento'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function eliminarDocLegajo(codigo, docId) {
    if (!confirm('¿Eliminar este documento del expediente?')) return;
    const r = await Auth.fetch_(`/legajo/${codigo}/documento/${docId}`, { method: 'DELETE' });
    if (!r.ok) { notify('error', r.error || 'Error'); return; }
    notify('success', 'Documento eliminado');
    abrirExpediente(codigo); loadLegajo();
  }

  /* ════════════ ASISTENCIA ════════════ */
  let _asiEstados = null;
  async function ensureEstados() {
    if (_asiEstados) return _asiEstados;
    const r = await Auth.fetch_('/asistencia/estados');
    _asiEstados = r.ok ? r.estados : ['PRESENTE', 'FALTA'];
    return _asiEstados;
  }
  async function loadAsistencia() {
    const estados = await ensureEstados();
    const sel = $('#asiEstado');
    if (sel && !sel.options.length) sel.innerHTML = estados.map(e => `<option>${e}</option>`).join('');
    if ($('#asiFecha') && !$('#asiFecha').value) $('#asiFecha').value = new Date().toISOString().slice(0, 10);
    const tb = $('#asiTbody'); if (!tb) return;
    const qs = [];
    const f = $('#asiFiltroFecha')?.value, d = $('#asiFiltroDni')?.value;
    if (f) qs.push('fecha=' + f);
    if (d && d.length === 8) qs.push('dni=' + d);
    const r = await Auth.fetch_('/asistencia' + (qs.length ? '?' + qs.join('&') : ''));
    if (!r.ok) { tb.innerHTML = `<tr><td colspan="8" class="td-empty">Error: ${esc(r.error)}</td></tr>`; return; }
    if (!r.registros.length) { tb.innerHTML = '<tr><td colspan="8" class="td-empty">Sin registros.</td></tr>'; return; }
    tb.innerHTML = r.registros.map(x => `
      <tr>
        <td>${esc(x.fecha)}</td><td>${esc(x.dni)}</td><td>${esc(x.apellidosNombres || '—')}</td>
        <td>${esc(x.horaEntrada || '—')}</td><td>${esc(x.horaSalida || '—')}</td>
        <td><span class="badge-estado">${esc(x.estado)}</span></td>
        <td>${esc(x.observacion || '')}</td>
        <td><button class="btn btn-sm btn-danger" onclick="eliminarAsistencia('${esc(x.id)}')">🗑️</button></td>
      </tr>`).join('');
  }
  async function registrarAsistencia() {
    const dni = ($('#asiDni').value || '').replace(/\D/g, '');
    if (dni.length !== 8) { notify('error', 'DNI inválido (8 dígitos)'); return; }
    const body = {
      dni, apellidosNombres: $('#asiNombre').value.trim(), fecha: $('#asiFecha').value,
      horaEntrada: $('#asiEntrada').value, horaSalida: $('#asiSalida').value,
      estado: $('#asiEstado').value, observacion: $('#asiObs').value.trim(),
    };
    if (!body.fecha) { notify('error', 'Seleccione una fecha'); return; }
    const r = await Auth.fetch_('/asistencia', { method: 'POST', body: JSON.stringify(body) });
    if (!r.ok) { notify('error', r.error || 'Error'); return; }
    notify('success', 'Asistencia registrada');
    $('#asiObs').value = '';
    loadAsistencia();
  }
  async function eliminarAsistencia(id) {
    if (!confirm('¿Eliminar este registro de asistencia?')) return;
    const r = await Auth.fetch_('/asistencia/' + id, { method: 'DELETE' });
    if (r.ok) { notify('success', 'Eliminado'); loadAsistencia(); }
  }

  /* ════════════ PROYECTOS (vista) ════════════ */
  async function loadProyectosView() {
    const r = await Auth.fetch_('/proyectos');
    const tb = $('#proyViewTbody'); const k = $('#proyKpis');
    if (!r.ok) { if (tb) tb.innerHTML = `<tr><td colspan="4" class="td-empty">Error: ${esc(r.error)}</td></tr>`; return; }
    const ps = r.proyectos || [];
    const activos = ps.filter(p => p.activo !== false).length;
    if (k) k.innerHTML = `${kpi('accent', 'Total proyectos', ps.length, 'En cartera')}${kpi('green', 'Activos', activos, 'En ejecución')}${kpi('amber', 'Cerrados', ps.length - activos, 'Concluidos/inactivos')}`;
    if (!ps.length) { tb.innerHTML = '<tr><td colspan="4" class="td-empty">Sin proyectos.</td></tr>'; return; }
    tb.innerHTML = ps.map(p => `
      <tr>
        <td>${esc(p.cui || '—')}</td>
        <td style="max-width:520px">${esc(p.nombre || p.descripcion || '—')}</td>
        <td>${esc(p.resolucion || p.numeroResolucion || '—')}</td>
        <td><span class="badge-estado">${p.activo === false ? 'INACTIVO' : 'ACTIVO'}</span></td>
      </tr>`).join('');
  }

  /* ════════════ PERSONAL ASIGNADO ════════════ */
  async function loadPersonalAsignado() {
    const sel = $('#paSelectProyecto');
    if (sel && sel.options.length <= 1) {
      const rp = await Auth.fetch_('/proyectos');
      if (rp.ok) sel.innerHTML = '<option value="">— Todos —</option>' + rp.proyectos.map(p => `<option value="${esc(p.cui)}">${esc((p.nombre || p.cui || '').substring(0, 60))}</option>`).join('');
    }
    const cui = sel?.value || '';
    const r = await Auth.fetch_('/personal/contratos' + (cui ? `?cui=${encodeURIComponent(cui)}` : ''));
    const tb = $('#paTbody'); if (!tb) return;
    if (!r.ok) { tb.innerHTML = `<tr><td colspan="6" class="td-empty">Error: ${esc(r.error)}</td></tr>`; return; }
    const cs = (r.contratos || []).filter(c => ['ACTIVO', 'POR_VENCER', 'PROXIMO_VENCER'].includes(c.estadoCalc || c.estado));
    if (!cs.length) { tb.innerHTML = '<tr><td colspan="6" class="td-empty">Sin personal asignado.</td></tr>'; return; }
    tb.innerHTML = cs.map(c => `
      <tr>
        <td>${esc(c.dni)}</td><td>${esc(c.apellidosNombres)}</td>
        <td>${esc(c.cargoNombre || c.cargoCodigo || '—')}</td>
        <td style="max-width:360px">${esc((c.proyecto || '—').substring(0, 70))}</td>
        <td>${esc(c.fechaInicio || '—')}</td>
        <td><span class="badge-estado">${esc(c.estadoCalc || c.estado)}</span></td>
      </tr>`).join('');
  }

  /* ════════════ REPORTES ════════════ */
  async function loadReportesIndicadores() {
    const cont = $('#repIndicadores'); if (!cont) return;
    cont.innerHTML = '<div class="kpi-card accent"><div class="kpi-label">Cargando…</div></div>';
    const r = await Auth.fetch_('/reportes/indicadores');
    if (!r.ok) { cont.innerHTML = '<div class="kpi-card red"><div class="kpi-label">Error</div></div>'; return; }
    const i = r.indicadores;
    cont.innerHTML = `
      ${kpi('accent', 'Memorandos', i.documentos.totalMemorandos, 'Total histórico')}
      ${kpi('green',  'Contratos', i.personal.totalContratos, `${i.personal.contratosActivos} activos`)}
      ${kpi('amber',  'Por vencer 7d', i.personal.alertas7d ?? 0, 'Próximos 7 días')}
      ${kpi('amber',  'Por vencer 30d', i.personal.alertas30d ?? 0, 'Próximos 30 días')}
      ${kpi('accent', 'Proyectos', i.proyectos.total, `${i.proyectos.activos} activos`)}
      ${kpi('green',  'Expedientes', i.expedientes.totalExpedientes ?? 0, `${i.expedientes.totalDocumentos ?? 0} documentos`)}
      ${kpi('accent', 'Asistencias', i.asistencia.totalRegistros ?? 0, 'Registros totales')}
      ${kpi('green',  'Func. concluidas', i.personal.concluidos ?? 0, 'Contratos concluidos')}`;
  }
  async function loadEstadisticas() {
    const r = await Auth.fetch_('/reportes/estadisticas');
    if (!r.ok) return;
    const e = r.estadisticas;
    renderBars('#estPorEstado', e.porEstado);
    renderBars('#estPorCargo', e.porCargo.slice(0, 10));
    renderBars('#estPorProyecto', e.porProyecto.slice(0, 10));
  }
  function renderBars(sel, data) {
    const cont = $(sel); if (!cont) return;
    if (!data || !data.length) { cont.innerHTML = '<p style="color:#94a3b8">Sin datos.</p>'; return; }
    const max = Math.max(...data.map(d => d.valor), 1);
    cont.innerHTML = data.map(d => `
      <div class="bar-row">
        <div class="bar-label" title="${esc(d.etiqueta)}">${esc((d.etiqueta || '').substring(0, 48))}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${(d.valor / max * 100).toFixed(1)}%"></div></div>
        <div class="bar-val">${d.valor}</div>
      </div>`).join('');
  }
  async function exportar(endpoint) {
    const t = Auth.getToken();
    const resp = await fetch('/api' + endpoint, { headers: { Authorization: `Bearer ${t}` } });
    if (!resp.ok) { notify('error', 'No se pudo exportar'); return; }
    const blob = await resp.blob();
    const cd = resp.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="?([^"]+)"?/);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = m ? m[1] : 'export'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('success', 'Descarga iniciada');
  }

  /* ════════════ USUARIOS ════════════ */
  async function loadUsuarios() {
    const tb = $('#usuariosTbody'); if (!tb) return;
    const r = await Auth.fetch_('/usuarios');
    if (!r.ok) { tb.innerHTML = `<tr><td colspan="6" class="td-empty">${esc(r.error || 'Sin permiso')}</td></tr>`; return; }
    if (!r.usuarios.length) { tb.innerHTML = '<tr><td colspan="6" class="td-empty">Sin usuarios.</td></tr>'; return; }
    tb.innerHTML = r.usuarios.map(u => `
      <tr>
        <td>${esc(u.email)}</td>
        <td>${esc((u.nombre || '') + ' ' + (u.apellido || ''))}</td>
        <td><span class="role-badge">${esc(u.rol)}</span></td>
        <td><span class="badge-estado">${u.bloqueado ? 'BLOQUEADO' : (u.activo === false ? 'INACTIVO' : 'ACTIVO')}</span></td>
        <td>${u.ultimoAcceso ? fmtFecha(u.ultimoAcceso) : '—'}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick='editarUsuario(${JSON.stringify(u).replace(/'/g, "&#39;")})'>✏️</button>
          ${u.bloqueado
            ? `<button class="btn btn-sm btn-secondary" onclick="toggleBloqueoUsuario('${esc(u.id)}',false)">🔓</button>`
            : `<button class="btn btn-sm btn-secondary" onclick="toggleBloqueoUsuario('${esc(u.id)}',true)">🔒</button>`}
          <button class="btn btn-sm btn-danger" onclick="eliminarUsuario('${esc(u.id)}')">🗑️</button>
        </td>
      </tr>`).join('');
  }
  function abrirModalUsuario() {
    $('#modalUsuarioTitulo').textContent = 'Nuevo Usuario';
    $('#uId').value = ''; $('#uEmail').value = ''; $('#uNombre').value = ''; $('#uApellido').value = '';
    $('#uRol').value = 'usuario'; $('#uPass').value = ''; $('#uMsg').textContent = '';
    $('#uPassWrap').style.display = 'block';
    $('#modalUsuario').classList.remove('hidden');
  }
  function editarUsuario(u) {
    $('#modalUsuarioTitulo').textContent = 'Editar Usuario';
    $('#uId').value = u.id; $('#uEmail').value = u.email; $('#uNombre').value = u.nombre || '';
    $('#uApellido').value = u.apellido || ''; $('#uRol').value = u.rol; $('#uPass').value = ''; $('#uMsg').textContent = '';
    $('#uPassWrap').style.display = 'none';
    $('#modalUsuario').classList.remove('hidden');
  }
  async function guardarUsuario() {
    const id = $('#uId').value;
    const body = {
      email: $('#uEmail').value.trim().toLowerCase(),
      nombre: $('#uNombre').value.trim(), apellido: $('#uApellido').value.trim(),
      rol: $('#uRol').value,
    };
    if (!body.email || !body.nombre) { $('#uMsg').textContent = 'Email y nombre son obligatorios.'; return; }
    let r;
    if (id) {
      r = await Auth.fetch_('/usuarios/' + id, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      body.contrasena = $('#uPass').value;
      if (body.contrasena.length < 8) { $('#uMsg').textContent = 'La contraseña debe tener al menos 8 caracteres.'; return; }
      r = await Auth.fetch_('/usuarios', { method: 'POST', body: JSON.stringify(body) });
    }
    if (!r.ok) { $('#uMsg').textContent = r.error || 'Error'; return; }
    $('#modalUsuario').classList.add('hidden');
    notify('success', id ? 'Usuario actualizado' : 'Usuario creado');
    loadUsuarios();
  }
  async function eliminarUsuario(id) {
    if (!confirm('¿Eliminar este usuario?')) return;
    const r = await Auth.fetch_('/usuarios/' + id, { method: 'DELETE' });
    if (!r.ok) { notify('error', r.error || 'Error'); return; }
    notify('success', 'Usuario eliminado'); loadUsuarios();
  }
  async function toggleBloqueoUsuario(id, bloquear) {
    const r = await Auth.fetch_(`/usuarios/${id}/${bloquear ? 'bloquear' : 'desbloquear'}`, { method: 'PUT', body: JSON.stringify({ razon: 'Cambio manual' }) });
    if (!r.ok) { notify('error', r.error || 'Error'); return; }
    notify('success', bloquear ? 'Usuario bloqueado' : 'Usuario desbloqueado'); loadUsuarios();
  }

  /* ════════════ ROLES ════════════ */
  async function loadRoles() {
    const cont = $('#rolesContainer'); if (!cont) return;
    const r = await Auth.fetch_('/auth/roles');
    if (!r.ok) { cont.innerHTML = `<div class="section-block">Error: ${esc(r.error)}</div>`; return; }
    const raw = r.roles || {};
    const roles = Array.isArray(raw) ? raw : Object.entries(raw).map(([id, v]) => ({ id, ...v }));
    cont.innerHTML = roles.map(rol => {
      const permisos = Array.isArray(rol.permisos) ? rol.permisos : [];
      const chips = permisos.includes('*')
        ? '<span class="perm-chip">ACCESO TOTAL (*)</span>'
        : permisos.map(p => `<span class="perm-chip">${esc(p)}</span>`).join('');
      return `<div class="role-card">
        <div class="role-head"><span class="role-badge">${esc(rol.id || rol.nombre)}</span><strong>${esc(rol.nombre || rol.id)}</strong></div>
        <div>${esc(rol.descripcion || '')}</div>
        <div style="margin-top:8px">${chips || '<span style="color:#94a3b8">Sin permisos definidos</span>'}</div>
      </div>`;
    }).join('');
  }

  /* ════════════ AUDITORÍA ════════════ */
  async function loadLogs() {
    const tb = $('#logsTbody'); if (!tb) return;
    const nivel = $('#logNivel')?.value || '';
    const limite = $('#logLimite')?.value || '100';
    const qs = [`limite=${limite}`]; if (nivel) qs.push('nivel=' + nivel);
    const r = await Auth.fetch_('/logs?' + qs.join('&'));
    if (!r.ok) { tb.innerHTML = `<tr><td colspan="5" class="td-empty">${esc(r.error || 'Sin permiso')}</td></tr>`; return; }
    if (!r.logs.length) { tb.innerHTML = '<tr><td colspan="5" class="td-empty">Sin eventos.</td></tr>'; return; }
    const nivelClase = (n) => n === 'ERROR' ? 'red' : (n === 'ADVERTENCIA' ? 'amber' : 'green');
    tb.innerHTML = r.logs.map(l => `
      <tr>
        <td>${fmtFecha(l.timestamp || l.fecha)}</td>
        <td>${esc(l.tipo || l.evento || '—')}</td>
        <td><span class="perm-chip" style="border-color:transparent;background:${nivelClase(l.nivel) === 'red' ? '#fee2e2' : nivelClase(l.nivel) === 'amber' ? '#fef3c7' : '#dcfce7'}">${esc(l.nivel || 'INFO')}</span></td>
        <td>${esc(l.usuarioEmail || l.usuarioId || '—')}</td>
        <td style="max-width:380px;font-size:12px">${esc(JSON.stringify(l.detalles || l.detalle || {}).substring(0, 160))}</td>
      </tr>`).join('');
  }

  /* ════════════ BACKUPS ════════════ */
  async function loadBackups() {
    const tb = $('#backupsTbody'); if (!tb) return;
    const r = await Auth.fetch_('/backup');
    if (!r.ok) { tb.innerHTML = `<tr><td colspan="4" class="td-empty">${esc(r.error || 'Sin permiso')}</td></tr>`; return; }
    if (!r.backups || !r.backups.length) { tb.innerHTML = '<tr><td colspan="4" class="td-empty">Sin respaldos.</td></tr>'; return; }
    tb.innerHTML = r.backups.map(b => `
      <tr>
        <td>${esc(b.nombre || b.archivo || '—')}</td>
        <td><span class="perm-chip">${esc(b.tipo || 'auto')}</span></td>
        <td>${b.tamano ? (b.tamano / 1024).toFixed(1) + ' KB' : '—'}</td>
        <td>${fmtFecha(b.fecha || b.creado)}</td>
      </tr>`).join('');
  }
  async function crearBackupManual() {
    notify('info', 'Generando respaldo…');
    const r = await Auth.fetch_('/backup', { method: 'POST' });
    if (!r.ok) { notify('error', r.error || 'Error'); return; }
    notify('success', 'Respaldo creado');
    loadBackups();
  }

  // Exponer al ámbito global (usadas por onclick y nav.js)
  Object.assign(window, {
    loadInicio, loadLegajo, abrirModalNuevoExpediente, crearExpediente, abrirExpediente,
    subirDocLegajo, descargarDocLegajo, eliminarDocLegajo,
    loadAsistencia, registrarAsistencia, eliminarAsistencia,
    loadProyectosView, loadPersonalAsignado,
    loadReportesIndicadores, loadEstadisticas, exportar,
    loadUsuarios, abrirModalUsuario, editarUsuario, guardarUsuario, eliminarUsuario, toggleBloqueoUsuario,
    loadRoles, loadLogs, loadBackups, crearBackupManual,
  });
})();
