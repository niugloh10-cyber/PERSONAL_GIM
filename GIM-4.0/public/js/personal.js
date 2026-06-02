/**
 * SISTEMA GIM v3.6 - MÓDULO PERSONAL INTEGRADO
 * =============================================
 * Contratos, Alertas, Historial, Evaluaciones, Dashboard, Carta Conclusión
 * Integrado en index.html — todos los IDs con prefijo "p"
 */
'use strict';

/* ── Estado del módulo Personal ── */
const persState = {
  contratos:    [],
  evaluaciones: [],
  proyectos:    [],
  cargos:       [],
  contratoSeleccionadoCarta: null,
  inicializado: false,
};

/* ── DOM helpers locales ── */
const pQ  = s => document.querySelector(s);
function escP(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ── fetchJson autenticado (reutiliza Auth de app.js) ── */
async function persFetch(url, opts = {}) {
  if (opts.body !== undefined && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    opts = { ...opts, body: JSON.stringify(opts.body), headers: { 'Content-Type':'application/json', ...(opts.headers||{}) } };
  }
  try {
    const token = (typeof Auth !== 'undefined' && Auth.getToken) ? Auth.getToken() : null;
    const headers = { ...(opts.headers||{}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res  = await fetch(url, { ...opts, headers });
    let data;
    try { data = await res.json(); } catch(_){ data = { ok:false, error:'Respuesta no JSON' }; }
    return { ok: res.ok, status: res.status, data };
  } catch(e) {
    return { ok:false, status:0, data:{ ok:false, error:e.message } };
  }
}

/* ── Descarga DOCX desde base64 ── */
function persDescargar(nombre, base64) {
  const bin   = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  const blob = new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

/* ── Confirmación usando el modal existente de app.js ── */
function persConfirmar(titulo, mensaje) {
  return new Promise(resolve => {
    const tEl = document.getElementById('modalConfirmTitulo');
    const mEl = document.getElementById('modalConfirmMensaje');
    const modal = document.getElementById('modalConfirm');
    if (!tEl || !mEl || !modal) { resolve(confirm(mensaje)); return; }
    tEl.textContent = titulo;
    mEl.textContent = mensaje;
    modal.classList.remove('hidden');
    const accept = () => { cleanup(); resolve(true); };
    const cancel = () => { cleanup(); resolve(false); };
    function cleanup() {
      modal.classList.add('hidden');
      document.getElementById('btnConfirmAccept').removeEventListener('click', accept);
      document.getElementById('btnConfirmCancel').removeEventListener('click', cancel);
    }
    document.getElementById('btnConfirmAccept').addEventListener('click', accept);
    document.getElementById('btnConfirmCancel').addEventListener('click', cancel);
  });
}

/* ── Sub-tabs de Personal ── */
function persActivarSubTab(nombre) {
  document.querySelectorAll('.pers-tab-btn').forEach(b => {
    const activo = b.dataset.ptab === nombre;
    b.style.color = activo ? '#1a3c6e' : '#6b7280';
    b.style.borderBottomColor = activo ? '#1a3c6e' : 'transparent';
    b.style.fontWeight = activo ? '600' : '500';
  });
  document.querySelectorAll('.pers-tab-content').forEach(c => {
    c.style.display = c.id === nombre ? 'block' : 'none';
  });
  if (nombre === 'p-dashboard')    persCargarDashboard();
  if (nombre === 'p-contratos')    persRenderContratos();
  if (nombre === 'p-alertas')      persCargarAlertas();
  if (nombre === 'p-evaluaciones') persRenderEvaluaciones();
}

/* ── Abrir/cerrar modales de Personal ── */
function persAbrirModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('hidden'); m.style.display='flex'; }
}
function persCerrarModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('hidden'); m.style.display=''; }
}

/* ── Badges de estado ── */
function persBadgeEstado(e) {
  const styles = {
    ACTIVO:         'background:#dcfce7;color:#15803d',
    POR_VENCER:     'background:#fef9c3;color:#854d0e',
    PROXIMO_VENCER: 'background:#ffedd5;color:#c2410c',
    VENCIDO:        'background:#fee2e2;color:#b91c1c',
    CONCLUIDO:      'background:#e0e7ff;color:#3730a3',
    RESCINDIDO:     'background:#f3f4f6;color:#6b7280',
  };
  const texto = { ACTIVO:'Activo', POR_VENCER:'Por Vencer', PROXIMO_VENCER:'Próx. Vencer',
    VENCIDO:'Vencido', CONCLUIDO:'Concluido', RESCINDIDO:'Rescindido' };
  const st = styles[e] || styles.RESCINDIDO;
  return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;${st}">${texto[e]||e}</span>`;
}

/* ── Calificación ── */
function persClasePuntaje(p) {
  const n = parseFloat(p)||0;
  if (n>=90) return {bg:'#2E7D32',txt:'EXCELENTE'};
  if (n>=75) return {bg:'#0891b2',txt:'BUENO'};
  if (n>=60) return {bg:'#e67e22',txt:'REGULAR'};
  return {bg:'#c0392b',txt:'DEFICIENTE'};
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
async function persCargarDashboard() {
  const grid = document.getElementById('pMetricsGrid');
  if (!grid) return;
  grid.innerHTML = '<div style="display:flex;align-items:center;padding:20px;color:#6b7280;grid-column:1/-1"><span style="width:22px;height:22px;border:3px solid #e5e7eb;border-top-color:#1a3c6e;border-radius:50%;animation:spin .7s linear infinite;display:inline-block;margin-right:10px"></span> Cargando...</div>';

  const { data } = await persFetch('/api/personal/dashboard');
  if (!data.ok) { grid.innerHTML = `<p style="color:red;padding:16px">${escP(data.error)}</p>`; return; }

  const mc = (color, valor, etiqueta, sub) => `
    <div style="background:#fff;border-radius:8px;padding:16px 18px;box-shadow:0 2px 8px rgba(0,0,0,.1);border-left:4px solid ${color}">
      <div style="font-size:30px;font-weight:700;color:${color};line-height:1">${valor}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:4px">${etiqueta}</div>
      <div style="font-size:11px;color:#9ca3af;margin-top:2px">${sub}</div>
    </div>`;

  grid.innerHTML =
    mc('#2E7D32', data.personalActivo,       'Personal Activo',           'contratos vigentes') +
    mc('#1a3c6e', data.totalContratos,        'Total Contratos',           'histórico registrado') +
    mc('#e67e22', data.porVencer,             'Próximos a Vencer',         'en los próximos 30 días') +
    mc('#c0392b', data.alertas7d,             'Críticos',                  'vencen en < 7 días') +
    mc('#f39c12', data.vencidos,              'Contratos Vencidos',        'sin concluir') +
    mc('#6b7280', data.concluidos,            'Concluidos',                'total histórico') +
    mc('#2E7D32', data.funcionesPendientes,   'Con Funciones Definidas',   'contratos activos') +
    mc('#1a3c6e', data.totalEvaluaciones,     'Evaluaciones',              'total registradas');

  // Badge en tab
  const badge = document.getElementById('pBadgeAlertas');
  if (badge) {
    if (data.alertas7d > 0) { badge.textContent = data.alertas7d; badge.style.display = 'inline'; }
    else badge.style.display = 'none';
  }
  // Badge en tab principal
  const badgeTab = document.getElementById('badgePersonalAlertas');
  if (badgeTab) {
    if (data.alertas7d > 0) { badgeTab.textContent = data.alertas7d; badgeTab.style.display = 'inline'; }
    else badgeTab.style.display = 'none';
  }

  // Personal por obra
  const poEl = document.getElementById('pPersonalPorObra');
  if (poEl) {
    if (!data.porObra?.length) {
      poEl.innerHTML = '<div style="text-align:center;padding:20px;color:#6b7280">🏗️<p>Sin datos de obras activas</p></div>';
    } else {
      const max = Math.max(...data.porObra.map(o => o.cantidad));
      poEl.innerHTML = data.porObra.slice(0,10).map(o => `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div style="flex:1;font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escP(o.proyecto)}">${escP(o.proyecto.length>40?o.proyecto.substring(0,40)+'…':o.proyecto)}</div>
          <div style="width:100px;height:10px;border-radius:5px;background:#dbeafe;overflow:hidden">
            <div style="height:100%;background:#1a3c6e;border-radius:5px;width:${Math.round(o.cantidad/max*100)}%"></div>
          </div>
          <div style="font-size:13px;font-weight:700;color:#1a3c6e;min-width:24px;text-align:right">${o.cantidad}</div>
        </div>`).join('');
    }
  }

  // Alertas en dashboard
  const daEl = document.getElementById('pDashAlertas');
  if (daEl) {
    if (!data.proximosVencer?.length) {
      daEl.innerHTML = '<div style="text-align:center;padding:20px;color:#6b7280">✅<p>Sin contratos próximos a vencer</p></div>';
    } else {
      daEl.innerHTML = data.proximosVencer.map(c => {
        const dias = c.diasRestantes ?? '?';
        const color = dias <= 0 ? '#c0392b' : dias <= 7 ? '#e67e22' : '#f39c12';
        return `<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 12px;border-radius:8px;margin-bottom:8px;border-left:4px solid ${color};background:${dias<=0?'#fff5f5':dias<=7?'#fff8f0':'#fffde7'}">
          <div style="font-size:18px">${dias<=0?'🚨':dias<=7?'🔴':'⚠️'}</div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600">${escP(c.apellidosNombres)}</div>
            <div style="font-size:12px;color:#6b7280">${escP(c.cargoNombre)} · Término: ${escP(c.fechaTermino)}</div>
          </div>
          <div style="font-size:18px;font-weight:700;color:${color}">${dias<=0?'VENCIDO':dias+'d'}</div>
        </div>`;
      }).join('');
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   CONTRATOS
   ═══════════════════════════════════════════════════════════════ */
async function persCargarContratos() {
  const { data } = await persFetch('/api/personal/contratos');
  if (data.ok) { persState.contratos = data.contratos || []; persRenderContratos(); }
  else if (typeof Notif !== 'undefined') Notif.error(data.error || 'Error cargando contratos');
}

function persRenderContratos() {
  const tbody = document.getElementById('pTbodyContratos');
  if (!tbody) return;

  const filtro = (document.getElementById('pBuscadorContratos')?.value || '').toLowerCase();
  const estado = document.getElementById('pFiltroEstado')?.value || '';

  let lista = persState.contratos;
  if (filtro) lista = lista.filter(c =>
    (c.apellidosNombres||'').toLowerCase().includes(filtro) ||
    (c.dni||'').includes(filtro) ||
    (c.proyecto||'').toLowerCase().includes(filtro)
  );
  if (estado) lista = lista.filter(c => c.estadoCalc === estado || c.estado === estado);

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:30px;color:#6b7280">Sin contratos registrados</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(c => {
    const dias = c.diasRestantes;
    const diasStr = dias === null ? '—'
      : dias <= 0 ? `<span style="color:#c0392b;font-weight:700">VENCIDO</span>`
      : `<span style="color:${dias<=7?'#c0392b':dias<=30?'#e67e22':'#2E7D32'}">${dias}d</span>`;
    return `<tr style="border-bottom:1px solid #f0f4f8" onmouseover="this.style.background='#fafbff'" onmouseout="this.style.background=''">
      <td style="padding:9px 12px">${persBadgeEstado(c.estadoCalc || c.estado)}</td>
      <td style="padding:9px 12px"><strong>${escP(c.apellidosNombres)}</strong></td>
      <td style="padding:9px 12px">${escP(c.dni)}</td>
      <td style="padding:9px 12px"><span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:10px;font-size:11px;font-family:monospace">${escP(c.cargoCodigo)}</span><br><small style="color:#6b7280">${escP(c.cargoNombre)}</small></td>
      <td style="padding:9px 12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escP(c.proyecto)}">${escP(c.proyecto.length>35?c.proyecto.substring(0,35)+'…':c.proyecto)}<br><small style="color:#6b7280">${escP(c.cui)}</small></td>
      <td style="padding:9px 12px">${escP(c.fechaInicio)}</td>
      <td style="padding:9px 12px">${escP(c.fechaTermino||'—')}</td>
      <td style="padding:9px 12px;text-align:center">${diasStr}</td>
      <td style="padding:9px 12px">${escP(c.numeroMemo||'—')}</td>
      <td style="padding:9px 12px">
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm btn-secondary" onclick="persEditarContrato('${escP(c.id)}')" title="Editar">✏️</button>
          <button class="btn btn-sm btn-info" onclick="persVerHistorial('${escP(c.dni)}')" title="Historial">📂</button>
          <button class="btn btn-sm btn-secondary" onclick="abrirLegajoPorDni('${escP(c.dni)}')" title="Ver Legajo Digital">🗂️</button>
          <button class="btn btn-sm btn-success" onclick="persIrACarta('${escP(c.id)}')" title="Carta">📄</button>
          ${c.estado !== 'CONCLUIDO' ? `<button class="btn btn-sm btn-warning" onclick="persCambiarEstado('${escP(c.id)}','CONCLUIDO')" title="Concluir">✔</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

window.persEditarContrato = id => {
  const c = persState.contratos.find(x => x.id === id);
  if (!c) return;
  document.getElementById('pModalContratoTitulo').textContent = 'Editar Contrato';
  document.getElementById('pContratoId').value    = c.id;
  document.getElementById('pCDni').value          = c.dni;
  document.getElementById('pCNombre').value       = c.apellidosNombres;
  document.getElementById('pCCip').value          = c.cip || '';
  document.getElementById('pCCargoCodigo').value  = c.cargoCodigo;
  document.getElementById('pCNumeroMemo').value   = c.numeroMemo || '';
  document.getElementById('pCNumeroResolucion').value = c.numeroResolucion || '';
  document.getElementById('pCMonto').value        = c.monto || '';
  document.getElementById('pCProyecto').value     = c.proyecto;
  document.getElementById('pCCui').value          = c.cui;
  document.getElementById('pCComponente').value   = c.componente || '';
  document.getElementById('pCFechaInicio').value  = c.fechaInicio;
  document.getElementById('pCFechaTermino').value = c.fechaTermino || '';
  document.getElementById('pCEstado').value       = c.estado || 'ACTIVO';
  document.getElementById('pCFunciones').value    = c.funciones || '';
  document.getElementById('pCObservaciones').value = c.observaciones || '';
  persAbrirModal('pModalContrato');
};

window.persCambiarEstado = async (id, estado) => {
  const c = persState.contratos.find(x => x.id === id);
  const nombre = c ? c.apellidosNombres : id;
  const ok = await persConfirmar(`Cambiar estado a ${estado}`, `¿Cambiar el contrato de ${nombre} a ${estado}?`);
  if (!ok) return;
  const { data } = await persFetch(`/api/personal/contratos/${encodeURIComponent(id)}/estado`, {
    method: 'PUT', body: { estado, observacion: `Cambio manual a ${estado}` }
  });
  if (data.ok) { if (typeof Notif!=='undefined') Notif.success(`Estado cambiado a ${estado}`); await persCargarContratos(); }
  else if (typeof Notif!=='undefined') Notif.error(data.error || 'Error al cambiar estado');
};

window.persVerHistorial = dni => {
  persActivarSubTab('p-historial');
  const el = document.getElementById('pDniHistorial');
  if (el) { el.value = dni; persBuscarHistorial(); }
};

window.persIrACarta = id => {
  const c = persState.contratos.find(x => x.id === id);
  if (c) {
    persActivarSubTab('p-carta');
    const el = document.getElementById('pDniCarta');
    if (el) { el.value = c.dni; persBuscarContratosParaCarta(); }
  }
};

async function persSubmitContrato(e) {
  e.preventDefault();
  const id = document.getElementById('pContratoId').value;
  const datos = {
    dni:              document.getElementById('pCDni').value.trim(),
    apellidosNombres: document.getElementById('pCNombre').value.trim(),
    cip:              document.getElementById('pCCip').value.trim(),
    cargoCodigo:      document.getElementById('pCCargoCodigo').value,
    cargoNombre:      document.getElementById('pCCargoCodigo').selectedOptions[0]?.textContent?.replace(/.*·\s*/,'').trim() || '',
    numeroMemo:       document.getElementById('pCNumeroMemo').value.trim(),
    numeroResolucion: document.getElementById('pCNumeroResolucion').value.trim(),
    monto:            document.getElementById('pCMonto').value,
    proyecto:         document.getElementById('pCProyecto').value.trim() || document.getElementById('pCProyectoSelector').selectedOptions[0]?.dataset?.nombre || '',
    cui:              document.getElementById('pCCui').value.trim(),
    componente:       document.getElementById('pCComponente').value.trim(),
    fechaInicio:      document.getElementById('pCFechaInicio').value,
    fechaTermino:     document.getElementById('pCFechaTermino').value,
    estado:           document.getElementById('pCEstado').value,
    funciones:        document.getElementById('pCFunciones').value.trim(),
    observaciones:    document.getElementById('pCObservaciones').value.trim(),
  };
  const cargo = persState.cargos.find(c => c.codigo === datos.cargoCodigo);
  if (cargo) datos.cargoNombre = cargo.nombre;

  let res;
  if (id) {
    res = await persFetch(`/api/personal/contratos/${encodeURIComponent(id)}`, { method:'PUT', body: datos });
  } else {
    res = await persFetch('/api/personal/contratos', { method:'POST', body: datos });
  }
  if (res.data.ok) {
    if (typeof Notif!=='undefined') Notif.success(id ? 'Contrato actualizado' : 'Contrato registrado correctamente');
    persCerrarModal('pModalContrato');
    await persCargarContratos();
  } else {
    if (typeof Notif!=='undefined') Notif.error(res.data.error || 'Error guardando contrato');
  }
}

/* ── Buscar DNI en formulario de contrato ── */
async function persBuscarDniContrato() {
  const dni = document.getElementById('pCDni')?.value.trim();
  if (!/^\d{8}$/.test(dni)) return;
  const { data } = await persFetch(`/api/trabajadores/${dni}`);
  if (data.ok && data.trabajador) {
    document.getElementById('pCNombre').value = data.trabajador.apellidosNombres || '';
    document.getElementById('pCCip').value    = data.trabajador.cip || '';
    if (typeof Notif!=='undefined') Notif.info(`Datos cargados: ${data.trabajador.apellidosNombres}`);
  }
}

/* ── Poblar selectores ── */
function persPoblarCargos() {
  const sel = document.getElementById('pCCargoCodigo');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Seleccione cargo —</option>';
  persState.cargos.filter(c => c.activo !== false).forEach(c => {
    const o = document.createElement('option');
    o.value = c.codigo; o.textContent = `${c.codigo} · ${c.nombre}`;
    sel.appendChild(o);
  });
  if (prev) sel.value = prev;
}

function persPoblarProyectos() {
  const sel = document.getElementById('pCProyectoSelector');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Seleccionar proyecto —</option>';
  persState.proyectos.filter(p => p.activo !== false).forEach(p => {
    const o = document.createElement('option');
    o.value = p.cui;
    o.textContent = `[${p.cui}] ${p.nombre.substring(0,60)}`;
    o.dataset.nombre = p.nombre;
    sel.appendChild(o);
  });
}

/* ═══════════════════════════════════════════════════════════════
   ALERTAS
   ═══════════════════════════════════════════════════════════════ */
async function persCargarAlertas() {
  const { data } = await persFetch('/api/personal/alertas?dias=60');
  if (!data.ok) { if (typeof Notif!=='undefined') Notif.error(data.error); return; }

  const criticas = (data.alertas||[]).filter(a => (a.diasRestantes??999) <= 7);
  const proximas = (data.alertas||[]).filter(a => (a.diasRestantes??999) > 7 && (a.diasRestantes??999) <= 30);

  function renderAlerta(contenedorId, lista, borderColor, bg) {
    const el = document.getElementById(contenedorId);
    if (!el) return;
    if (!lista.length) {
      el.innerHTML = '<div style="text-align:center;padding:16px;color:#6b7280">✅ Sin alertas en esta categoría</div>';
      return;
    }
    el.innerHTML = lista.map(c => {
      const dias = c.diasRestantes ?? 0;
      const color = dias<=0 ? '#c0392b' : dias<=7 ? '#e67e22' : '#f39c12';
      return `<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border-radius:8px;margin-bottom:10px;border-left:4px solid ${borderColor};background:${bg}">
        <div style="font-size:20px">${dias<=0?'🚨':dias<=7?'🔴':'⚠️'}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600">${escP(c.apellidosNombres)}</div>
          <div style="font-size:12px;color:#6b7280"><strong>${escP(c.cargoNombre)}</strong> · DNI: ${escP(c.dni)}</div>
          <div style="font-size:12px;color:#6b7280">${escP(c.proyecto.substring(0,60))}${c.proyecto.length>60?'…':''}</div>
          <div style="font-size:12px">Término: <strong>${escP(c.fechaTermino)}</strong></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          <div style="font-size:20px;font-weight:700;color:${color}">${dias<=0?'VENCIDO':dias+'d'}</div>
          <button class="btn btn-sm btn-success" onclick="persIrACarta('${escP(c.id)}')">📄 Carta</button>
        </div>
      </div>`;
    }).join('');
  }

  renderAlerta('pAlertasCriticas', criticas, '#c0392b', '#fff5f5');
  renderAlerta('pAlertasProximas', proximas, '#e67e22', '#fff8f0');

  // Funciones pendientes
  const fpEl = document.getElementById('pFuncionesPendientes');
  if (fpEl) {
    const conFunciones = persState.contratos.filter(c =>
      (c.estadoCalc === 'ACTIVO' || c.estadoCalc === 'POR_VENCER') && c.funciones
    );
    if (!conFunciones.length) {
      fpEl.innerHTML = '<div style="text-align:center;padding:16px;color:#6b7280">📋 Sin funciones registradas en contratos activos</div>';
    } else {
      fpEl.innerHTML = conFunciones.map(c => `
        <div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:8px">
          <div style="font-weight:600;font-size:13px">${escP(c.apellidosNombres)}</div>
          <div style="font-size:12px;color:#6b7280;margin-bottom:6px">${escP(c.cargoNombre)} · ${escP(c.proyecto.substring(0,50))}</div>
          <div style="font-size:12px;background:#f8fafc;padding:8px;border-radius:6px;line-height:1.5">${escP(c.funciones)}</div>
        </div>`).join('');
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   HISTORIAL
   ═══════════════════════════════════════════════════════════════ */
async function persBuscarHistorial() {
  const dni = (document.getElementById('pDniHistorial')?.value || '').trim();
  if (!/^\d{8}$/.test(dni)) { if (typeof Notif!=='undefined') Notif.warning('DNI inválido. Ingrese exactamente 8 dígitos'); return; }

  const panel = document.getElementById('pPanelHistorial');
  panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:30px;color:#6b7280"><span style="width:24px;height:24px;border:3px solid #e5e7eb;border-top-color:#1a3c6e;border-radius:50%;animation:spin .7s linear infinite;display:inline-block;margin-right:10px"></span> Cargando historial...</div>';

  const { data } = await persFetch(`/api/personal/historial/${dni}`);
  if (!data.ok) { panel.innerHTML = `<div style="text-align:center;padding:30px;color:#6b7280"><div style="font-size:36px">❌</div><p>${escP(data.error)}</p></div>`; return; }

  const { trabajador, historial } = data;
  const contratos = historial.contratos || [];

  panel.innerHTML = `
    <div style="background:#fff;border-radius:8px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,.1);margin-bottom:16px">
      <h3 style="font-size:14px;color:#1a3c6e;margin-bottom:12px">👤 Ficha del Trabajador</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;font-size:13px">
        <div><span style="color:#6b7280">DNI:</span> <strong>${escP(trabajador.dni)}</strong></div>
        <div><span style="color:#6b7280">Nombres:</span> ${escP(trabajador.apellidosNombres || 'No registrado')}</div>
        <div><span style="color:#6b7280">CIP/CAP:</span> ${escP(trabajador.cip || '—')}</div>
        <div><span style="color:#6b7280">Teléfono:</span> ${escP(trabajador.telefono1 || '—')}</div>
        <div><span style="color:#6b7280">Correo:</span> ${escP(trabajador.correo || '—')}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px">
      ${[
        ['#2E7D32', contratos.filter(c=>c.estado==='ACTIVO').length, 'Contratos Activos'],
        ['#1a3c6e', contratos.length,                                'Total Contratos'],
        ['#6b7280', historial.mesesTotales,                          'Meses Trabajados'],
        ['#2E7D32', historial.promedioEvaluacion || '—',             'Prom. Evaluación'],
      ].map(([color,val,etq]) => `<div style="background:#fff;border-radius:8px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,.1);border-left:4px solid ${color}"><div style="font-size:26px;font-weight:700;color:${color}">${val}</div><div style="font-size:12px;color:#6b7280">${etq}</div></div>`).join('')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div style="background:#fff;border-radius:8px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.1)">
        <h3 style="font-size:13px;color:#1a3c6e;margin-bottom:10px">🏗️ Obras (${historial.obras.length})</h3>
        ${historial.obras.length ? historial.obras.map(o=>`<div style="padding:5px 0;border-bottom:1px solid #f0f4f8;font-size:13px">• ${escP(o)}</div>`).join('') : '<p style="color:#6b7280;font-size:13px">Sin obras registradas</p>'}
      </div>
      <div style="background:#fff;border-radius:8px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.1)">
        <h3 style="font-size:13px;color:#1a3c6e;margin-bottom:10px">💼 Cargos (${historial.cargos.length})</h3>
        ${historial.cargos.length ? historial.cargos.map(c=>`<div style="padding:5px 0;border-bottom:1px solid #f0f4f8;font-size:13px"><span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:10px;font-size:11px;font-family:monospace">${escP(c)}</span></div>`).join('') : '<p style="color:#6b7280;font-size:13px">Sin cargos registrados</p>'}
      </div>
    </div>

    <div style="background:#fff;border-radius:8px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.1)">
      <h3 style="font-size:13px;color:#1a3c6e;margin-bottom:12px">📅 Línea de Tiempo de Contratos</h3>
      <div style="position:relative;padding-left:28px">
        <div style="position:absolute;left:10px;top:0;bottom:0;width:2px;background:#e5e7eb"></div>
        ${contratos.length ? contratos.slice().reverse().map(c => `
          <div style="position:relative;margin-bottom:16px">
            <div style="position:absolute;left:-22px;top:6px;width:12px;height:12px;border-radius:50%;background:${c.estado==='ACTIVO'?'#1a3c6e':c.estado==='CONCLUIDO'?'#2E7D32':'#c0392b'};border:2px solid #fff;box-shadow:0 0 0 2px ${c.estado==='ACTIVO'?'#1a3c6e':c.estado==='CONCLUIDO'?'#2E7D32':'#c0392b'}"></div>
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
              <div style="font-size:13px;font-weight:600;color:#1a3c6e;margin-bottom:6px">${escP(c.cargoNombre)} ${persBadgeEstado(c.estadoCalc||c.estado)}</div>
              <div style="font-size:12px;color:#6b7280">🏗️ ${escP(c.proyecto.substring(0,60))}${c.proyecto.length>60?'…':''}</div>
              <div style="font-size:12px;color:#6b7280">📅 ${escP(c.fechaInicio)} → ${escP(c.fechaTermino||'Activo')}</div>
              <div style="font-size:12px;color:#6b7280">📋 Memo: ${escP(c.numeroMemo||'—')} · Res: ${escP(c.numeroResolucion||'—')}</div>
              <div style="margin-top:8px"><button class="btn btn-sm btn-success" onclick="persIrACarta('${escP(c.id)}')">📄 Carta Conclusión</button></div>
            </div>
          </div>`).join('') : '<p style="color:#6b7280;font-size:13px">Sin contratos registrados</p>'}
      </div>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════
   EVALUACIONES
   ═══════════════════════════════════════════════════════════════ */
async function persCargarEvaluaciones() {
  const { data } = await persFetch('/api/personal/evaluaciones');
  if (data.ok) { persState.evaluaciones = data.evaluaciones || []; persRenderEvaluaciones(); }
}

function persRenderEvaluaciones() {
  const tbody = document.getElementById('pTbodyEvaluaciones');
  if (!tbody) return;

  const filtro = (document.getElementById('pBuscadorEvaluaciones')?.value || '').toLowerCase();
  let lista = persState.evaluaciones;
  if (filtro) lista = lista.filter(e =>
    (e.apellidosNombres||'').toLowerCase().includes(filtro) ||
    (e.dni||'').includes(filtro)
  );

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#6b7280">Sin evaluaciones registradas</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(ev => {
    const cp = persClasePuntaje(ev.puntaje);
    return `<tr style="border-bottom:1px solid #f0f4f8">
      <td style="padding:9px 12px"><strong>${escP(ev.apellidosNombres)}</strong></td>
      <td style="padding:9px 12px">${escP(ev.dni)}</td>
      <td style="padding:9px 12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escP(ev.proyecto||'—')}</td>
      <td style="padding:9px 12px">${escP(ev.periodo)}</td>
      <td style="padding:9px 12px;text-align:center"><div style="width:36px;height:36px;border-radius:50%;background:${cp.bg};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;margin:0 auto">${escP(ev.puntaje)}</div></td>
      <td style="padding:9px 12px"><span style="background:${cp.bg}22;color:${cp.bg};padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600">${cp.txt}</span></td>
      <td style="padding:9px 12px">${escP(ev.evaluador)}</td>
      <td style="padding:9px 12px;font-size:11px">${escP(ev.fecha)}</td>
    </tr>`;
  }).join('');
}

async function persSubmitEvaluacion(e) {
  e.preventDefault();
  const datos = {
    dni:              document.getElementById('pEDni').value.trim(),
    apellidosNombres: document.getElementById('pENombre').value.trim(),
    idContrato:       document.getElementById('pEIdContrato').value,
    proyecto:         document.getElementById('pEIdContrato').selectedOptions[0]?.dataset?.proyecto || '',
    periodo:          document.getElementById('pEPeriodo').value,
    puntaje:          document.getElementById('pEPuntaje').value,
    comentarios:      document.getElementById('pEComentarios').value.trim(),
  };
  const { data } = await persFetch('/api/personal/evaluaciones', { method:'POST', body: datos });
  if (data.ok) {
    if (typeof Notif!=='undefined') Notif.success('Evaluación registrada correctamente');
    persCerrarModal('pModalEvaluacion');
    await persCargarEvaluaciones();
  } else {
    if (typeof Notif!=='undefined') Notif.error(data.error || 'Error guardando evaluación');
  }
}

async function persBuscarDniEvaluacion() {
  const dni = document.getElementById('pEDni').value.trim();
  if (!/^\d{8}$/.test(dni)) return;
  const { data } = await persFetch(`/api/trabajadores/${dni}`);
  if (data.ok && data.trabajador) {
    document.getElementById('pENombre').value = data.trabajador.apellidosNombres || '';
    const { data: dc } = await persFetch(`/api/personal/contratos?dni=${dni}`);
    const sel = document.getElementById('pEIdContrato');
    sel.innerHTML = '<option value="">— Seleccione contrato —</option>';
    (dc.contratos || []).forEach(c => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = `${c.cargoNombre} · ${c.proyecto.substring(0,40)}`;
      o.dataset.proyecto = c.proyecto;
      sel.appendChild(o);
    });
  } else {
    if (typeof Notif!=='undefined') Notif.warning('DNI no encontrado en la base de datos');
  }
}

/* ═══════════════════════════════════════════════════════════════
   CARTA DE CONCLUSIÓN
   ═══════════════════════════════════════════════════════════════ */
async function persBuscarContratosParaCarta() {
  const dni = (document.getElementById('pDniCarta')?.value || '').trim();
  if (!/^\d{8}$/.test(dni)) { if (typeof Notif!=='undefined') Notif.warning('DNI inválido'); return; }

  const { data } = await persFetch(`/api/personal/contratos?dni=${dni}`);
  const contenedor = document.getElementById('pContratosParaCarta');
  if (!contenedor) return;

  if (!data.ok || !data.contratos?.length) {
    contenedor.innerHTML = '<p style="color:#6b7280;font-size:13px;margin-top:8px">No se encontraron contratos para este DNI.</p>';
    return;
  }

  contenedor.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:4px;margin-top:8px">
      <label style="font-size:12px;font-weight:600;color:#374151">Seleccione contrato <span style="color:#c0392b">*</span></label>
      <select id="pSelectContratosCarta" style="padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:13px">
        <option value="">— Seleccione —</option>
        ${data.contratos.map(c => `<option value="${escP(c.id)}">${escP(c.cargoNombre)} · ${escP(c.proyecto.substring(0,40))} (${escP(c.fechaInicio)} → ${escP(c.fechaTermino||'Activo')})</option>`).join('')}
      </select>
    </div>`;

  document.getElementById('pSelectContratosCarta').addEventListener('change', e => {
    const id = e.target.value;
    const c  = data.contratos.find(x => x.id === id);
    persState.contratoSeleccionadoCarta = c || null;
    persMostrarVistaContrato(c);
    document.getElementById('pBtnGenerarCarta').disabled = !c;
  });
}

function persMostrarVistaContrato(c) {
  const el = document.getElementById('pVistaContratoSeleccionado');
  if (!el) return;
  if (!c) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#6b7280"><div style="font-size:32px">📋</div><p>Seleccione un contrato</p></div>';
    return;
  }
  el.innerHTML = `<table style="width:100%;font-size:13px">
    ${[
      ['Trabajador', `<strong>${escP(c.apellidosNombres)}</strong>`],
      ['DNI',        escP(c.dni)],
      ['Cargo',      escP(c.cargoNombre)],
      ['Proyecto',   escP(c.proyecto)],
      ['CUI',        escP(c.cui)],
      ['Inicio',     escP(c.fechaInicio)],
      ['Término',    escP(c.fechaTermino||'—')],
      ['N° Memo',    escP(c.numeroMemo||'—')],
      ['Funciones',  escP((c.funciones||'').substring(0,120))+(c.funciones?.length>120?'…':'')],
    ].map(([k,v])=>`<tr><td style="width:100px;color:#6b7280;padding:5px 0">${k}</td><td>${v}</td></tr>`).join('')}
  </table>`;
}

async function persGenerarCarta() {
  const c = persState.contratoSeleccionadoCarta;
  if (!c) { if (typeof Notif!=='undefined') Notif.warning('Seleccione un contrato primero'); return; }

  const btn = document.getElementById('pBtnGenerarCarta');
  btn.disabled = true; btn.textContent = '⏳ Generando...';

  try {
    const { data } = await persFetch(`/api/personal/carta-conclusion/${encodeURIComponent(c.id)}`, {
      method: 'POST',
      body: {
        numeroCarta:    document.getElementById('pNumeroCarta')?.value.trim() || '',
        funciones:      document.getElementById('pFuncionesAdicionales')?.value.trim() || undefined,
        observaciones:  document.getElementById('pObsAdicionales')?.value.trim() || undefined,
        marcarConcluido:document.getElementById('pChkMarcarConcluido')?.checked || false,
      }
    });
    if (!data.ok) { if (typeof Notif!=='undefined') Notif.error(data.error || 'Error generando carta'); return; }
    persDescargar(data.nombre, data.contenido);
    if (typeof Notif!=='undefined') Notif.success(`Carta generada: ${data.nombre} · Código QR: ${data.codigoQR}`, 8000);
    if (document.getElementById('pChkMarcarConcluido')?.checked) await persCargarContratos();
  } catch(err) {
    if (typeof Notif!=='undefined') Notif.error('Error inesperado: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = '📄 Generar Carta de Conclusión';
  }
}

/* ═══════════════════════════════════════════════════════════════
   INIT DEL MÓDULO PERSONAL
   Se invoca cuando el usuario activa la tab "personal"
   ═══════════════════════════════════════════════════════════════ */
async function persInit() {
  if (persState.inicializado) return;
  persState.inicializado = true;

  // Sub-tabs
  document.querySelectorAll('.pers-tab-btn').forEach(btn =>
    btn.addEventListener('click', () => persActivarSubTab(btn.dataset.ptab))
  );

  // Cerrar modales
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => persCerrarModal(btn.dataset.closeModal));
  });
  ['pModalContrato','pModalEvaluacion'].forEach(id => {
    const m = document.getElementById(id);
    if (m) m.addEventListener('click', e => { if(e.target===m) persCerrarModal(id); });
  });

  // Botón nuevo contrato
  document.getElementById('pBtnNuevoContrato')?.addEventListener('click', () => {
    document.getElementById('pModalContratoTitulo').textContent = 'Nuevo Contrato';
    document.getElementById('pFormContrato').reset();
    document.getElementById('pContratoId').value = '';
    persAbrirModal('pModalContrato');
  });

  // Exportar
  document.getElementById('pBtnExportarPersonal')?.addEventListener('click', () => {
    const token = (typeof Auth!=='undefined' && Auth.getToken) ? Auth.getToken() : null;
    if (!token) return;
    fetch('/api/personal/exportar', { headers: { Authorization:`Bearer ${token}` } })
      .then(r => r.blob()).then(b => {
        const url = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href=url; a.download='gestion_personal_gim.xlsx'; a.click();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
      });
  });

  // Buscadores
  document.getElementById('pBuscadorContratos')?.addEventListener('input', persRenderContratos);
  document.getElementById('pFiltroEstado')?.addEventListener('change', persRenderContratos);
  document.getElementById('pBuscadorEvaluaciones')?.addEventListener('input', persRenderEvaluaciones);

  // Formulario contrato
  document.getElementById('pFormContrato')?.addEventListener('submit', persSubmitContrato);
  document.getElementById('pBtnBuscarCDni')?.addEventListener('click', persBuscarDniContrato);
  document.getElementById('pCDni')?.addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();persBuscarDniContrato();} });

  // Selector proyecto en modal contrato
  document.getElementById('pCProyectoSelector')?.addEventListener('change', () => {
    const sel = document.getElementById('pCProyectoSelector');
    const cui = sel.value;
    const p = persState.proyectos.find(x => x.cui === cui);
    if (p) {
      document.getElementById('pCProyecto').value   = p.nombre;
      document.getElementById('pCCui').value        = p.cui;
      document.getElementById('pCComponente').value = p.componente || '';
    }
  });

  // Historial
  document.getElementById('pBtnBuscarHistorial')?.addEventListener('click', persBuscarHistorial);
  document.getElementById('pDniHistorial')?.addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();persBuscarHistorial();} });

  // Evaluaciones
  document.getElementById('pBtnNuevaEvaluacion')?.addEventListener('click', () => {
    document.getElementById('pFormEvaluacion').reset();
    document.getElementById('pEPeriodo').value = new Date().toISOString().substring(0,7);
    persAbrirModal('pModalEvaluacion');
  });
  document.getElementById('pFormEvaluacion')?.addEventListener('submit', persSubmitEvaluacion);
  document.getElementById('pBtnBuscarEDni')?.addEventListener('click', persBuscarDniEvaluacion);
  document.getElementById('pEDni')?.addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();persBuscarDniEvaluacion();} });

  // Carta
  document.getElementById('pBtnBuscarCarta')?.addEventListener('click', persBuscarContratosParaCarta);
  document.getElementById('pDniCarta')?.addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();persBuscarContratosParaCarta();} });
  document.getElementById('pBtnGenerarCarta')?.addEventListener('click', persGenerarCarta);

  // Carga inicial de datos
  const [dc, de, dp, dcar] = await Promise.all([
    persFetch('/api/personal/contratos'),
    persFetch('/api/personal/evaluaciones'),
    persFetch('/api/proyectos'),
    persFetch('/api/cargos'),
  ]);

  if (dc.data.ok)   persState.contratos    = dc.data.contratos    || [];
  if (de.data.ok)   persState.evaluaciones = de.data.evaluaciones || [];
  if (dp.data.ok)   persState.proyectos    = dp.data.proyectos    || [];
  if (dcar.data.ok) persState.cargos       = dcar.data.cargos     || [];

  persPoblarCargos();
  persPoblarProyectos();
  await persCargarDashboard();

  if (typeof Notif!=='undefined') Notif.success('Gestión de Personal cargada', 2500);
}

/* ═══════════════════════════════════════════════════════════════
   HOOK EN EL SISTEMA DE TABS DE app.js
   Cuando se activa la tab "personal", iniciar el módulo
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Interceptar clicks en la tab principal "personal"
  document.querySelectorAll('.tab-btn[data-tab="personal"]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Dar un tick para que app.js active el panel primero
      setTimeout(() => persInit(), 50);
    });
  });
});
