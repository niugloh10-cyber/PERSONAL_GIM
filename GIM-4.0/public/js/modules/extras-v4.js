/**
 * SISTEMA GIM v4.0 — EXTRAS v4
 * =============================
 * 1) Administración de la PLATAFORMA CONFIGURABLE (vista "Módulos del Sistema"):
 *    habilitar/deshabilitar, reordenar (↑/↓) y renombrar grupos y módulos,
 *    guardar y restaurar de fábrica — sin tocar el código fuente.
 * 2) EXPEDIENTE ÚNICO: datos canónicos + trayectoria cronológica integral en
 *    el modal del Legajo Digital (se incorpora a "abrirExpediente").
 */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const esc = (s) => (typeof escapeHtml === 'function'
    ? escapeHtml(s)
    : String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])));
  const notify = (t, m) => { if (typeof Notif !== 'undefined' && Notif[t]) Notif[t](m); };
  const fmtFecha = (iso) => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString('es-PE'); };

  /* ═══════════════════ 1) ADMINISTRACIÓN DE MÓDULOS ═══════════════════ */

  let _modulos = null; // copia de trabajo (config editable en memoria)

  async function loadModulos() {
    const cont = $('#modulosContainer');
    const estado = $('#modulosEstado');
    if (!cont) return;
    cont.innerHTML = '<div class="section-block">Cargando…</div>';
    const r = await Auth.fetch_('/modulos');
    if (!r || !r.ok) { cont.innerHTML = `<div class="section-block">Error: ${esc(r && r.error)}</div>`; return; }
    _modulos = r.modulos;
    if (estado) estado.textContent = `Última actualización: ${fmtFecha(_modulos.actualizado)}`;
    renderModulos();
  }
  window.loadModulos = loadModulos;

  function renderModulos() {
    const cont = $('#modulosContainer');
    if (!cont || !_modulos) return;
    const grupos = [..._modulos.grupos].sort((a, b) => (a.orden || 0) - (b.orden || 0));

    cont.innerHTML = grupos.map((g, gi) => {
      const items = [...(g.items || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0));
      const itemsHtml = items.map((it, ii) => `
        <div class="mod-item" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-top:1px solid #eef2f7">
          <label class="mod-switch" title="Habilitar/Deshabilitar">
            <input type="checkbox" ${it.habilitado !== false ? 'checked' : ''} onchange="modToggleItem('${esc(g.id)}','${esc(it.id)}',this.checked)">
          </label>
          <span style="width:26px;text-align:center">${esc(it.icono || '•')}</span>
          <input type="text" value="${esc(it.nombre || '')}" onchange="modRenombrarItem('${esc(g.id)}','${esc(it.id)}',this.value)"
                 style="flex:1;min-width:120px;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px">
          <code style="font-size:11px;color:#94a3b8">${esc(it.vista)}</code>
          ${it.permiso ? `<span class="perm-chip">${esc(it.permiso)}</span>` : ''}
          <button class="btn btn-sm btn-secondary" title="Subir" onclick="modMoverItem('${esc(g.id)}','${esc(it.id)}',-1)">↑</button>
          <button class="btn btn-sm btn-secondary" title="Bajar" onclick="modMoverItem('${esc(g.id)}','${esc(it.id)}',1)">↓</button>
        </div>`).join('');

      return `
        <div class="section-block" style="padding:0;overflow:hidden;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:#f0f4f8">
            <label class="mod-switch" title="Habilitar/Deshabilitar grupo">
              <input type="checkbox" ${g.habilitado !== false ? 'checked' : ''} onchange="modToggleGrupo('${esc(g.id)}',this.checked)">
            </label>
            <span style="width:26px;text-align:center">${esc(g.icono || '📁')}</span>
            ${g.sinTitulo
              ? `<strong style="flex:1;color:#1a3c6e">${esc(g.nombre || '(sin título)')}</strong>`
              : `<input type="text" value="${esc(g.nombre || '')}" onchange="modRenombrarGrupo('${esc(g.id)}',this.value)"
                    style="flex:1;font-weight:600;color:#1a3c6e;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px">`}
            <code style="font-size:11px;color:#94a3b8">${esc(g.id)}</code>
            <button class="btn btn-sm btn-secondary" title="Subir grupo" onclick="modMoverGrupo('${esc(g.id)}',-1)">↑</button>
            <button class="btn btn-sm btn-secondary" title="Bajar grupo" onclick="modMoverGrupo('${esc(g.id)}',1)">↓</button>
          </div>
          ${itemsHtml || '<div class="td-empty" style="padding:10px">Sin módulos.</div>'}
        </div>`;
    }).join('');
  }

  const _grupo = (gid) => _modulos.grupos.find(g => g.id === gid);
  const _reordenar = (arr) => arr.forEach((x, i) => x.orden = i + 1);

  window.modToggleGrupo = (gid, val) => { const g = _grupo(gid); if (g) g.habilitado = val; };
  window.modToggleItem = (gid, iid, val) => { const it = _grupo(gid)?.items.find(i => i.id === iid); if (it) it.habilitado = val; };
  window.modRenombrarGrupo = (gid, val) => { const g = _grupo(gid); if (g) g.nombre = val; };
  window.modRenombrarItem = (gid, iid, val) => { const it = _grupo(gid)?.items.find(i => i.id === iid); if (it) it.nombre = val; };

  window.modMoverGrupo = (gid, dir) => {
    const arr = [..._modulos.grupos].sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const i = arr.findIndex(g => g.id === gid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    _reordenar(arr);
    _modulos.grupos = arr;
    renderModulos();
  };

  window.modMoverItem = (gid, iid, dir) => {
    const g = _grupo(gid); if (!g) return;
    const arr = [...g.items].sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const i = arr.findIndex(it => it.id === iid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    _reordenar(arr);
    g.items = arr;
    renderModulos();
  };

  window.guardarModulos = async () => {
    if (!_modulos) return;
    const r = await Auth.fetch_('/modulos', { method: 'PUT', body: JSON.stringify({ modulos: _modulos }) });
    if (!r || !r.ok) { notify('error', (r && r.error) || 'No se pudo guardar'); return; }
    _modulos = r.modulos;
    notify('success', 'Configuración de módulos guardada');
    const estado = $('#modulosEstado'); if (estado) estado.textContent = `Última actualización: ${fmtFecha(_modulos.actualizado)}`;
    if (typeof window.reconstruirSidebar === 'function') await window.reconstruirSidebar();
  };

  window.recargarModulos = () => loadModulos();

  window.resetModulos = async () => {
    if (!confirm('¿Restaurar la configuración de módulos de fábrica? Se perderán las personalizaciones.')) return;
    const r = await Auth.fetch_('/modulos/reset', { method: 'POST' });
    if (!r || !r.ok) { notify('error', (r && r.error) || 'Error'); return; }
    _modulos = r.modulos;
    renderModulos();
    notify('success', 'Configuración restaurada');
    if (typeof window.reconstruirSidebar === 'function') await window.reconstruirSidebar();
  };

  /* ═══════════════════ 2) EXPEDIENTE ÚNICO: TRAYECTORIA ═══════════════════ */

  const ICONO_EVENTO = {
    CONTRATO: '📋', MEMORANDO: '✍️', EVALUACION: '⭐', CONCLUSION: '📄',
    ASISTENCIA: '🕐', RESOLUCION: '⚖️', INFORME: '🗒️', CERTIFICADO: '🎓',
    DNI: '🪪', CV: '📑', TITULO: '🎓', CERTIFICADOS: '🎓', MEMORANDOS: '✍️',
    INFORMES: '🗒️', RESOLUCIONES: '⚖️', EVALUACIONES: '⭐', CARTA_CONCLUSION: '📄',
    CONTRATOS: '📋', OTROS: '📎', OTRO: '📎',
  };

  function renderDatosCanonicos(exp) {
    const box = $('#expDatosCanonicos');
    if (!box) return;
    const d = exp.datos || {};
    const nombre = (typeof window.nombreDisplayLegajo === 'function')
      ? window.nombreDisplayLegajo(exp)
      : (d.nombresApellidos || exp.apellidosNombres || '');
    const filas = [
      ['DNI', exp.dni], ['Nombres y Apellidos', nombre],
      ['Cargo', exp.cargo || d.cargo], ['CIP/CAP', d.cip],
      ['Correo', d.correo], ['Teléfono', d.telefono1],
      ['Dirección', [d.barrio, d.distrito, d.provincia].filter(Boolean).join(', ')],
      ['Estado civil', d.estadoCivil],
    ].filter(([, v]) => v);
    box.innerHTML = `
      <strong>🪪 Datos del trabajador (fuente única · comunicación por DNI)</strong>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px 18px;margin-top:8px">
        ${filas.map(([k, v]) => `<div><span style="color:#94a3b8">${esc(k)}:</span> ${esc(v)}</div>`).join('')}
      </div>`;
  }

  function renderTrayectoria(timeline) {
    const cont = $('#expTrayectoria');
    if (!cont) return;
    if (!timeline || !timeline.length) { cont.innerHTML = '<div class="td-empty" style="padding:10px">Sin actuaciones ni documentos registrados aún.</div>'; return; }
    cont.innerHTML = `<div style="border-left:2px solid #e2e8f0;margin-left:10px;padding-left:14px">${
      timeline.map(t => `
        <div style="position:relative;padding:8px 0">
          <span style="position:absolute;left:-22px;top:8px;font-size:14px">${ICONO_EVENTO[t.tipo] || '•'}</span>
          <div style="font-size:13px">
            <strong>${esc(t.titulo)}</strong>
            <span class="perm-chip" style="margin-left:6px">${esc((t.tipo || '').replace(/_/g, ' '))}</span>
            <span style="color:#94a3b8;font-size:11px;margin-left:6px">${t.clase === 'DOCUMENTO' ? '📎 documento' : 'actuación'}</span>
          </div>
          ${t.detalle ? `<div style="font-size:12px;color:#475569">${esc(t.detalle)}</div>` : ''}
          <div style="font-size:11px;color:#94a3b8">${fmtFecha(t.fecha)}${t.usuario ? ' · ' + esc(t.usuario) : ''}${t.origen ? ' · ' + esc(t.origen) : ''}</div>
        </div>`).join('')
    }</div>`;
  }

  async function cargarExtrasExpediente(codigo) {
    try {
      const r = await Auth.fetch_('/legajo/' + encodeURIComponent(codigo) + '/trayectoria');
      if (r && r.ok) { renderDatosCanonicos(r.expediente); renderTrayectoria(r.timeline); }
    } catch (_) {}
  }
  window.cargarExtrasExpediente = cargarExtrasExpediente;

  // Envolver abrirExpediente (definido en views.js) para añadir datos + trayectoria.
  function instalarPatchExpediente() {
    if (typeof window.abrirExpediente !== 'function') return false;
    if (window.abrirExpediente.__patchedV4) return true;
    const original = window.abrirExpediente;
    const envuelto = async function (codigo) {
      const box = $('#expDatosCanonicos'); if (box) box.innerHTML = '';
      const tray = $('#expTrayectoria'); if (tray) tray.innerHTML = '<div class="td-empty" style="padding:10px">Cargando trayectoria…</div>';
      await original.apply(this, arguments);
      cargarExtrasExpediente(codigo);
    };
    envuelto.__patchedV4 = true;
    window.abrirExpediente = envuelto;
    return true;
  }

  // Sincroniza/crea el legajo de TODO el personal existente.
  window.sincronizarLegajo = async function () {
    const msg = $('#legajoSyncMsg');
    if (msg) msg.textContent = 'Sincronizando todo el personal…';
    const r = await Auth.fetch_('/legajo/sincronizar', { method: 'POST' });
    if (!r || !r.ok) { if (msg) msg.textContent = ''; notify('error', (r && r.error) || 'Error al sincronizar'); return; }
    const s = r.resumen || {};
    const txt = `✓ ${s.totalExpedientes} expedientes (${s.nuevosExpedientes} nuevos, ${s.nuevasActuaciones} actuaciones incorporadas).`;
    if (msg) msg.textContent = txt;
    notify('success', 'Legajo sincronizado');
    if (typeof window.loadLegajo === 'function') window.loadLegajo();
  };

  // Abre el legajo de un trabajador a partir de su DNI (integración global).
  window.abrirLegajoPorDni = async function (dni) {
    dni = String(dni || '').replace(/\D/g, '');
    if (dni.length !== 8) { notify('error', 'DNI inválido'); return; }
    if (typeof window.irAVista === 'function') window.irAVista('legajo');
    const r = await Auth.fetch_('/legajo/dni/' + dni);
    if (r && r.ok && r.expediente) {
      if (typeof window.abrirExpediente === 'function') window.abrirExpediente(r.expediente.codigo);
      return;
    }
    // No existe aún: ofrecer crearlo (o sincronizar).
    if (confirm('Este trabajador aún no tiene Legajo. ¿Desea generarlo ahora sincronizando el personal?')) {
      await window.sincronizarLegajo();
      const r2 = await Auth.fetch_('/legajo/dni/' + dni);
      if (r2 && r2.ok && r2.expediente && typeof window.abrirExpediente === 'function') {
        window.abrirExpediente(r2.expediente.codigo);
      } else {
        notify('info', 'No se encontró el trabajador en las fuentes. Use "Abrir Expediente".');
      }
    }
  };

  /* ═══════════════════ CONSULTA RÁPIDA DE ASISTENCIA POR DNI ═══════════════════ */

  window.limpiarConsultaAsistencia = function () {
    const i = $('#asiConsultaDni'); if (i) i.value = '';
    const r = $('#asiConsultaResultado'); if (r) r.innerHTML = '';
  };

  window.consultarAsistenciaDni = async function () {
    const cont = $('#asiConsultaResultado');
    const dni = ($('#asiConsultaDni')?.value || '').replace(/\D/g, '');
    if (dni.length !== 8) { if (cont) cont.innerHTML = '<p class="muted">Ingrese un DNI válido de 8 dígitos.</p>'; return; }
    if (cont) cont.innerHTML = '<p class="muted">Consultando…</p>';

    // Datos del trabajador (legajo, por DNI) + asistencia
    const [legajo, asis] = await Promise.all([
      Auth.fetch_('/legajo/dni/' + dni).catch(() => null),
      Auth.fetch_('/asistencia?dni=' + dni).catch(() => null),
    ]);

    let nombre = '', cargo = '', codigo = '';
    if (legajo && legajo.ok && legajo.expediente) {
      const e = legajo.expediente;
      nombre = (typeof window.nombreDisplayLegajo === 'function') ? window.nombreDisplayLegajo(e) : (e.apellidosNombres || '');
      cargo = e.cargo || (e.datos && e.datos.cargo) || '';
      codigo = e.codigo;
    }

    const registros = (asis && asis.ok && asis.registros) ? asis.registros : [];
    // Conteo por estado
    const conteo = {};
    registros.forEach(r => { conteo[r.estado] = (conteo[r.estado] || 0) + 1; });
    const chips = Object.keys(conteo).map(k => `<span class="asi-chip">${esc(k)}: <strong>${conteo[k]}</strong></span>`).join('');

    // Prellenar el formulario de registro para agilizar
    const setV = (id, v) => { const el = $('#' + id); if (el) el.value = v; };
    setV('asiDni', dni); if (nombre) setV('asiNombre', nombre);

    const recientes = registros.slice(-8).reverse();
    const filas = recientes.length
      ? recientes.map(x => `<tr>
          <td>${esc(x.fecha)}</td><td>${esc(x.horaEntrada || '—')}</td><td>${esc(x.horaSalida || '—')}</td>
          <td><span class="badge-estado">${esc(x.estado)}</span></td><td>${esc(x.observacion || '')}</td></tr>`).join('')
      : '<tr><td colspan="5" class="td-empty">Sin registros de asistencia.</td></tr>';

    const hoy = new Date().toISOString().slice(0, 10);
    cont.innerHTML = `
      <div class="asi-card">
        <div class="asi-card-head">
          <div>
            <div class="asi-card-name">${esc(nombre || 'Trabajador no registrado en Legajo')}</div>
            <div class="asi-card-sub">DNI ${esc(dni)}${cargo ? ' · ' + esc(cargo) : ''}${codigo ? ' · ' + esc(codigo) : ''}</div>
          </div>
          <div class="asi-card-actions">
            ${codigo ? `<button class="btn btn-sm btn-secondary" onclick="abrirLegajoPorDni('${esc(dni)}')">🗂️ Ver Legajo</button>` : ''}
            <button class="btn btn-sm btn-primary" onclick="document.getElementById('asiFecha').value='${hoy}';document.getElementById('asiDni').scrollIntoView({behavior:'smooth'});">＋ Registrar asistencia</button>
          </div>
        </div>
        <div class="asi-chips">${chips || '<span class="muted">Sin asistencias registradas.</span>'} <span class="asi-chip total">Total: <strong>${registros.length}</strong></span></div>
        <div class="table-wrap" style="margin-top:10px">
          <table class="data-table">
            <thead><tr><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Estado</th><th>Obs.</th></tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </div>`;
  };

  document.addEventListener('DOMContentLoaded', () => {
    let n = 0;
    const t = setInterval(() => { n++; if (instalarPatchExpediente() || n > 50) clearInterval(t); }, 100);
  });
})();
