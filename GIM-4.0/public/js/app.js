/**
 * SISTEMA GIM v3.4 - APLICACIÓN PRINCIPAL FRONTEND
 * ==================================================
 * MEJORAS v3.3:
 * - Integración con módulo Auth (tokens seguros)
 * - Sistema de notificaciones moderno (Notif)
 * - Paginación en tablas de registros y proyectos
 * - Sanitización de outputs (escapeHtml en todos los renders)
 * - fetchJson usa Auth.fetch_ (autenticado automáticamente)
 * - Sin uso de innerHTML con datos no sanitizados
 */

'use strict';

/* ── Estado global ─────────────────────────────────────────── */
const state = {
  cargos:     [],
  registros:  [],
  plantillas: [],
  proyectos:  [],
  config:     {},
  pags:       { registros: 1, proyectos: 1 },
};

/* ── Utilidades DOM ─────────────────────────────────────────── */
const $  = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ── fetchJson autenticado ─────────────────────────────────── */
async function fetchJson(url, opciones = {}) {
  const relPath = url.startsWith('/api') ? url.slice(4) : url;

  // Auto-serializar body si es un objeto plano (no FormData, no string)
  if (opciones.body !== undefined && typeof opciones.body === 'object' && !(opciones.body instanceof FormData)) {
    opciones = {
      ...opciones,
      body: JSON.stringify(opciones.body),
      headers: { 'Content-Type': 'application/json', ...(opciones.headers || {}) },
    };
  }

  try {
    // Auth.fetch_ no expone el status HTTP; usar fetch directamente con el token
    const token = Auth.getToken ? Auth.getToken() : null;
    const headers = { ...(opciones.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res  = await fetch('/api' + relPath, { ...opciones, headers });
    const status = res.status;
    let data;
    try { data = await res.json(); } catch (_) { data = { ok: false, error: 'Respuesta no JSON' }; }
    return { ok: res.ok, status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { ok: false, error: e.message } };
  }
}

/* ── Descargar DOCX desde base64 ────────────────────────────── */
function descargarBase64(nombre, base64) {
  const bin   = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── Formulario principal ──────────────────────────────────── */
const CAMPOS_FORM = [
  'numeroMemorandum','fechaMemorandum','cargoCodigo','regNumero',
  'fechaRegistro','numeroResolucion','dni','cip','apellidosNombres',
  'estadoCivil','telefono1','telefono2','telefonoFijo','correo',
  'barrio','distrito','provincia','departamento','proyecto','cui',
  'componente','resolucionProyecto','observaciones',
  // Campos de integración con Personal (sección 4)
  'fechaInicio','fechaTermino','montoContrato','funciones',
];

const CAMPOS_TRABAJADOR = [
  'dni','cip','apellidosNombres','estadoCivil',
  'telefono1','telefono2','telefonoFijo','correo',
  'barrio','distrito','provincia','departamento',
];

function obtenerDatosFormulario() {
  const datos = {};
  CAMPOS_FORM.forEach(id => {
    const el = $('#' + id);
    if (el) datos[id] = el.value.trim();
  });
  return datos;
}

function setFormulario(datos) {
  for (const [k, v] of Object.entries(datos)) {
    const el = $('#' + k);
    if (el) el.value = v ?? '';
  }
}

function limpiarFormulario() {
  const f = $('#formMemo');
  if (f) f.reset();
  if ($('#distrito'))    $('#distrito').value    = 'Puno';
  if ($('#provincia'))   $('#provincia').value   = 'Puno';
  if ($('#departamento'))$('#departamento').value = 'Puno';

  if (state.config.ultimoNumeroMemo) {
    const sig = parseInt(state.config.ultimoNumeroMemo, 10) + 1;
    if ($('#numeroMemorandum')) $('#numeroMemorandum').value = String(sig).padStart(3, '0');
  }
  const hoy = new Date().toISOString().substr(0, 10);
  if ($('#fechaMemorandum')) $('#fechaMemorandum').value = hoy;
  if ($('#fechaRegistro'))   $('#fechaRegistro').value   = hoy;
}

/* ── Modal de confirmación ──────────────────────────────────── */
function confirmar(titulo, mensaje) {
  return new Promise(resolve => {
    const tEl = $('#modalConfirmTitulo');
    const mEl = $('#modalConfirmMensaje');
    const mod = $('#modalConfirm');
    if (!tEl || !mod) { resolve(window.confirm(mensaje)); return; }
    tEl.textContent = titulo;
    mEl.textContent = mensaje;
    mod.classList.remove('hidden');
    const accept = () => { cleanup(); resolve(true); };
    const cancel = () => { cleanup(); resolve(false); };
    function cleanup() {
      mod.classList.add('hidden');
      $('#btnConfirmAccept').removeEventListener('click', accept);
      $('#btnConfirmCancel').removeEventListener('click', cancel);
    }
    $('#btnConfirmAccept').addEventListener('click', accept);
    $('#btnConfirmCancel').addEventListener('click', cancel);
  });
}

/* ── TABS ───────────────────────────────────────────────────── */
function inicializarTabs() {
  $$('.tab-btn').forEach(btn => btn.addEventListener('click', () => activarTab(btn.dataset.tab)));
}

function activarTab(nombre) {
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === nombre));
  $$('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${nombre}`));
  if (nombre === 'registros') cargarRegistros();
  if (nombre === 'cargos')    { cargarCargos(); cargarPlantillas(); }
  if (nombre === 'config')    cargarConfig();
}

/* ── CONFIGURACIÓN ──────────────────────────────────────────── */
async function cargarConfig() {
  const { data } = await fetchJson('/api/config');
  if (data.ok) {
    state.config = data.config;
    if ($('#cfgCarpetaSalida')) $('#cfgCarpetaSalida').value = data.config.carpetaSalida || '';
    if ($('#cfgRutaBaseDatos')) $('#cfgRutaBaseDatos').value = data.config.rutaBaseDatos  || '';
    if ($('#cfgAnio'))         $('#cfgAnio').value          = data.config.anio || new Date().getFullYear();
    if ($('#cfgUltimoMemo'))   $('#cfgUltimoMemo').value    = data.config.ultimoNumeroMemo || 0;
  }
}

async function guardarConfig(e) {
  if (e) e.preventDefault();
  const config = {
    carpetaSalida:    ($('#cfgCarpetaSalida')?.value || '').trim(),
    rutaBaseDatos:    ($('#cfgRutaBaseDatos')?.value || '').trim(),
    anio:             parseInt($('#cfgAnio')?.value, 10) || new Date().getFullYear(),
    ultimoNumeroMemo: parseInt($('#cfgUltimoMemo')?.value, 10) || 0,
  };
  const { data } = await fetchJson('/api/config', { method: 'POST', body: config });
  if (data.ok) {
    state.config = data.config;
    Notif.success('Configuración guardada correctamente');
  } else {
    Notif.error(data.error || 'No se pudo guardar');
  }
}

/* ── CARGOS ─────────────────────────────────────────────────── */
async function cargarCargos() {
  const { data } = await fetchJson('/api/cargos');
  if (!data.ok) return;
  state.cargos = data.cargos;
  poblarSelectorCargos();
  renderTablaCargos();
}

function poblarSelectorCargos() {
  const sel = $('#cargoCodigo');
  if (!sel) return;
  const actual = sel.value;
  sel.innerHTML = '<option value="">— Seleccione cargo —</option>';
  state.cargos.filter(c => c.activo !== false).forEach(c => {
    const opt = document.createElement('option');
    opt.value       = c.codigo;
    opt.textContent = `${c.codigo} · ${c.nombre}`;
    sel.appendChild(opt);
  });
  if (actual) sel.value = actual;
}

function renderTablaCargos() {
  const tbody = $('#tablaCargos tbody');
  if (!tbody) return;
  if (!state.cargos.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#888">No hay cargos registrados</td></tr>';
    return;
  }
  tbody.innerHTML = state.cargos.map(c => `
    <tr>
      <td><span class="badge codigo">${escapeHtml(c.codigo)}</span></td>
      <td><strong>${escapeHtml(c.nombre)}</strong>${c.requisitos ? `<br><small style="color:#6b7280">${escapeHtml(c.requisitos)}</small>` : ''}</td>
      <td>S/. ${(c.monto || 0).toFixed(2)}</td>
      <td><code>${escapeHtml(c.plantilla || '—')}</code></td>
      <td>${c.requiereCIP ? 'Sí' : 'No'}</td>
      <td><span class="badge ${c.activo !== false ? 'activo' : 'inactivo'}">${c.activo !== false ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn btn-sm btn-secondary" onclick="editarCargo('${escapeHtml(c.codigo)}')">✏</button>
          <button class="btn btn-sm btn-danger"    onclick="eliminarCargo('${escapeHtml(c.codigo)}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.editarCargo = codigo => {
  const c = state.cargos.find(c => c.codigo === codigo);
  if (c) abrirModalCargo(c);
};

window.eliminarCargo = async codigo => {
  const ok = await confirmar('Eliminar cargo', `¿Eliminar el cargo "${codigo}"?`);
  if (!ok) return;
  const { data } = await fetchJson(`/api/cargos/${encodeURIComponent(codigo)}`, { method: 'DELETE' });
  if (data.ok) { Notif.success('Cargo eliminado'); cargarCargos(); }
  else Notif.error(data.error || 'No se pudo eliminar');
};

function abrirModalCargo(cargo = null) {
  const esNuevo = !cargo;
  $('#modalCargoTitulo').textContent = esNuevo ? 'Nuevo Cargo' : 'Editar Cargo';
  $('#cargoModoEdicion').value       = esNuevo ? '0' : '1';
  $('#cargoCodigoEdit').value        = cargo?.codigo   || '';
  $('#cargoCodigoEdit').readOnly     = !esNuevo;
  $('#cargoNombreEdit').value        = cargo?.nombre   || '';
  $('#cargoMontoEdit').value         = cargo?.monto    || '';
  $('#cargoRequiereCIP').value       = String(cargo?.requiereCIP || false);
  $('#cargoRequisitosEdit').value    = cargo?.requisitos || '';
  const selPlant = $('#cargoPlantillaEdit');
  selPlant.innerHTML = '<option value="">— Seleccione —</option>';
  state.plantillas.forEach(p => {
    const o = document.createElement('option');
    o.value = p.nombre; o.textContent = p.nombre;
    selPlant.appendChild(o);
  });
  selPlant.value = cargo?.plantilla || '';
  $('#modalCargo').classList.remove('hidden');
}

async function submitCargo(e) {
  e.preventDefault();
  const cargo = {
    codigo:      $('#cargoCodigoEdit').value.trim().toUpperCase(),
    nombre:      $('#cargoNombreEdit').value.trim().toUpperCase(),
    monto:       parseFloat($('#cargoMontoEdit').value) || 0,
    plantilla:   $('#cargoPlantillaEdit').value,
    requiereCIP: $('#cargoRequiereCIP').value === 'true',
    requisitos:  $('#cargoRequisitosEdit').value.trim(),
    activo:      true,
  };
  const { data } = await fetchJson('/api/cargos', { method: 'POST', body: cargo });
  if (data.ok) {
    Notif.success('Cargo guardado');
    $('#modalCargo').classList.add('hidden');
    cargarCargos();
  } else {
    Notif.error(data.error || 'No se pudo guardar');
  }
}

async function importarTablaSalarial(e) {
  const file = e.target.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('archivo', file);
  const data = await Auth.fetchForm('/cargos/importar', fd);
  if (data.ok) {
    Notif.success(`Tabla salarial importada: ${data.agregados} nuevos · ${data.actualizados} actualizados`);
    cargarCargos();
  } else Notif.error(data.error || 'Error al importar');
  e.target.value = '';
}

/* ── PLANTILLAS ─────────────────────────────────────────────── */
async function cargarPlantillas() {
  const { data } = await fetchJson('/api/plantillas');
  if (!data.ok) return;
  state.plantillas = data.plantillas;
  renderPlantillas();
}

function renderPlantillas() {
  const cont = $('#listaPlantillas');
  if (!cont) return;
  if (!state.plantillas.length) {
    cont.innerHTML = '<p class="muted">No hay plantillas. Suba alguna desde el botón superior.</p>';
    return;
  }
  cont.innerHTML = state.plantillas.map(p => `
    <div class="plantilla-card">
      <div class="nombre">📄 ${escapeHtml(p.nombre)}</div>
      <div class="acciones">
        <button class="btn btn-sm btn-danger" onclick="eliminarPlantilla('${escapeHtml(p.nombre)}')">🗑 Eliminar</button>
      </div>
    </div>
  `).join('');
}

window.eliminarPlantilla = async nombre => {
  const ok = await confirmar('Eliminar plantilla', `¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`);
  if (!ok) return;
  const { data } = await fetchJson(`/api/plantillas/${encodeURIComponent(nombre)}`, { method: 'DELETE' });
  if (data.ok) { Notif.success('Plantilla eliminada'); cargarPlantillas(); }
  else Notif.error(data.error || 'Error al eliminar');
};

async function subirPlantilla(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.name.endsWith('.docx')) { Notif.error('Solo se permiten archivos .docx'); e.target.value = ''; return; }
  const fd = new FormData();
  fd.append('plantilla', file);
  fd.append('nombre', file.name);
  const data = await Auth.fetchForm('/plantillas', fd);
  if (data.ok) { Notif.success(`Plantilla "${file.name}" subida`); cargarPlantillas(); }
  else Notif.error(data.error || 'Error al subir');
  e.target.value = '';
}

/* ── REGISTROS con PAGINACIÓN ───────────────────────────────── */
async function cargarRegistros() {
  const { data } = await fetchJson('/api/registros');
  if (!data.ok) { Notif.error(data.error || 'Error cargando registros'); return; }
  state.registros = data.registros;
  state.pags.registros = 1;
  renderTablaRegistros();
}

function renderTablaRegistros(filtro = '') {
  const term   = filtro.toLowerCase().trim();
  const datos  = !term ? state.registros
    : state.registros.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(term)));

  Paginator.crear({
    datos,
    pagina:      state.pags.registros,
    porPagina:   20,
    contenedorId:'tablaRegistros',
    paginadorId: 'paginadorRegistros',
    columnas:    9,
    renderFila:  (r) => `
      <tr>
        <td>${escapeHtml(r.nro || '')}</td>
        <td><strong>${escapeHtml(r.numeroMemorandum || '')}</strong></td>
        <td>${escapeHtml(r.fechaMemorandum || '')}</td>
        <td>${escapeHtml(r.dni || '')}</td>
        <td>${escapeHtml(r.apellidosNombres || '')}</td>
        <td><span class="badge codigo">${escapeHtml(r.cargoCodigo || '')}</span> ${escapeHtml(r.cargoNombre || '')}</td>
        <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(r.proyecto || '')}">${escapeHtml((r.proyecto||'').substring(0,60))}${(r.proyecto||'').length>60?'…':''}</td>
        <td>${escapeHtml(r.cui || '')}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-sm btn-secondary" onclick="usarRegistro(${r._rowNumber})" title="Usar datos">📋</button>
            <button class="btn btn-sm btn-info" onclick="abrirLegajoPorDni('${escapeHtml(r.dni || '')}')" title="Ver Legajo Digital">🗂️</button>
            <button class="btn btn-sm btn-danger"    onclick="eliminarRegistro(${r._rowNumber})" title="Eliminar">🗑</button>
          </div>
        </td>
      </tr>
    `,
  });

  Paginator.registrar('paginadorRegistros', pag => {
    state.pags.registros = pag;
    renderTablaRegistros(filtro);
  });
}

window.usarRegistro = rowNumber => {
  const reg = state.registros.find(r => r._rowNumber === rowNumber);
  if (!reg) return;
  setFormulario(reg);
  activarTab('generar');
  Notif.info('Datos cargados. Modifique lo necesario y genere.');
};

window.eliminarRegistro = async rowNumber => {
  const ok = await confirmar('Eliminar registro', '¿Eliminar este registro de la base de datos?');
  if (!ok) return;
  const { data } = await fetchJson(`/api/registros/${rowNumber}`, { method: 'DELETE' });
  if (data.ok) { Notif.success('Registro eliminado'); cargarRegistros(); }
  else Notif.error(data.error || 'Error al eliminar');
};

async function importarHistorialDesdeExcel(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';
  Notif.info('Importando registros...', 2000);
  const fd = new FormData();
  fd.append('archivo', file);
  const data = await Auth.fetchForm('/registros/importar', fd);
  if (!data.ok) { Notif.error(data.error || 'Error al importar'); return; }
  state.registros = data.registros || [];
  renderTablaRegistros();
  let msg = `${data.importados} registros importados.`;
  if (data.duplicados) msg += ` ${data.duplicados} duplicados omitidos.`;
  Notif.success(msg);
}

/* ── BÚSQUEDA INTEGRADA POR DNI (v3.6) ────────────────────────
 * Fuente única: /api/integracion/resumen-trabajador/:dni
 * Devuelve: ficha + contrato activo de Personal + últimos memos
 * Si falla, cae a historial local en memoria.
 * ─────────────────────────────────────────────────────────────*/
async function buscarTrabajadorPorDni() {
  const dni = ($('#dni')?.value || '').trim();
  if (!/^\d{8}$/.test(dni)) { Notif.warning('DNI inválido. Ingrese exactamente 8 dígitos'); return; }

  const st = $('#workerStatus');
  if (st) { st.textContent = '🔍 Buscando...'; st.className = 'worker-status'; }

  try {
    const { data } = await fetchJson(`/api/integracion/resumen-trabajador/${dni}`);
    if (data.ok) {
      const fuente = data.trabajador || data.ultimosMemos?.[0];
      if (fuente) {
        _llenarCamposTrabajador(fuente);
        if (st) {
          st.textContent = `✅ ${fuente.apellidosNombres} (${data.trabajador ? 'Ficha' : 'Historial'})`;
          st.className = 'worker-status success';
          setTimeout(() => { if(st){st.textContent='';st.className='worker-status';} }, 6000);
        }
      } else {
        if (st) { st.textContent = `⚠ DNI ${dni} sin datos previos`; st.className = 'worker-status warning'; setTimeout(() => { if(st){st.textContent='';st.className='worker-status';} }, 4000); }
        Notif.warning('DNI sin datos previos. Complete los campos manualmente.');
        _ocultarPanelContrato(); return;
      }
      // Contrato activo → panel de carga rápida
      if (data.contratoActivo) {
        _mostrarPanelContratoActivo(data.contratoActivo);
      } else { _ocultarPanelContrato(); }
      // Últimos memos
      if (data.ultimosMemos?.length) { _mostrarUltimosMemos(data.ultimosMemos); }
      else { const pm=$('#panelUltimosMemos'); if(pm) pm.style.display='none'; }
      Notif.success(`Datos cargados: ${fuente.apellidosNombres}`);
      return;
    }
  } catch (_) { /* fallback */ }

  // Fallback local
  const encontrados = state.registros.filter(r => r.dni === dni);
  if (encontrados.length) {
    const reg = encontrados[encontrados.length - 1];
    _llenarCamposTrabajador(reg);
    if (st) { st.textContent = `✅ ${reg.apellidosNombres} (Historial local)`; st.className = 'worker-status success'; setTimeout(() => { if(st){st.textContent='';st.className='worker-status';} }, 6000); }
    Notif.success(`Trabajador cargado: ${reg.apellidosNombres}`);
    _ocultarPanelContrato(); return;
  }
  if (st) { st.textContent = `⚠ DNI ${dni} sin datos previos`; st.className = 'worker-status warning'; setTimeout(() => { if(st){st.textContent='';st.className='worker-status';} }, 4000); }
  Notif.warning('DNI sin datos previos. Complete los campos manualmente.');
  _ocultarPanelContrato();
}

function _mostrarPanelContratoActivo(c) {
  const panel = $('#panelContratoActivo');
  const info  = $('#panelContratoActivoInfo');
  if (!panel || !info) return;
  info.textContent = `${c.cargoNombre} · ${(c.proyecto||'').substring(0,55)}${(c.proyecto||'').length>55?'…':''} · Inicio: ${c.fechaInicio}${c.fechaTermino?' · Término: '+c.fechaTermino:''}`;
  panel.style.display = 'block';
  const btn = $('#btnUsarContratoActivo');
  if (btn) {
    btn.onclick = () => {
      if ($('#cargoCodigo') && c.cargoCodigo)      $('#cargoCodigo').value       = c.cargoCodigo;
      if ($('#proyecto')    && c.proyecto)          $('#proyecto').value          = c.proyecto;
      if ($('#cui')         && c.cui)               $('#cui').value               = c.cui;
      if ($('#componente')  && c.componente)        $('#componente').value        = c.componente;
      if ($('#fechaInicio') && c.fechaInicio)       $('#fechaInicio').value       = c.fechaInicio;
      if ($('#fechaTermino')&& c.fechaTermino)      $('#fechaTermino').value      = c.fechaTermino;
      if ($('#funciones')   && c.funciones)         $('#funciones').value         = c.funciones;
      if ($('#montoContrato')&& c.monto)            $('#montoContrato').value     = c.monto;
      if ($('#numeroResolucion')&& c.numeroResolucion) $('#numeroResolucion').value = c.numeroResolucion;
      if ($('#resolucionProyecto')&& c.numeroResolucion) $('#resolucionProyecto').value = c.numeroResolucion;
      Notif.success('Datos del contrato cargados');
      btn.textContent = '✅ Cargado'; btn.disabled = true;
      setTimeout(() => { btn.textContent = 'Cargar datos del contrato'; btn.disabled = false; }, 3000);
    };
  }
}

function _ocultarPanelContrato() {
  const p=$('#panelContratoActivo'); if(p) p.style.display='none';
  const pm=$('#panelUltimosMemos'); if(pm) pm.style.display='none';
}

function _mostrarUltimosMemos(memos) {
  const panel=$('#panelUltimosMemos'); const lista=$('#listaUltimosMemos');
  if (!panel||!lista) return;
  lista.innerHTML = memos.map(m =>
    `<div style="padding:4px 0;border-bottom:1px solid #e5e7eb;font-size:12px">
      <strong style="color:#1a3c6e">Memo N° ${escapeHtml(m.numeroMemorandum)}</strong>
      · ${escapeHtml(m.fechaMemorandum)}
      · <span style="color:#6b7280">${escapeHtml(m.cargoCodigo)} · ${escapeHtml((m.proyecto||'').substring(0,45))}</span>
    </div>`
  ).join('');
  panel.style.display = 'block';
}

/** Rellena los campos del trabajador en el formulario y opcionalmente guarda/actualiza la ficha */
function _llenarCamposTrabajador(datos) {
  CAMPOS_TRABAJADOR.forEach(id => {
    const el = $('#' + id);
    if (el && datos[id]) el.value = datos[id];
  });
}

/**
 * v3.2: Después de generar un documento, sincroniza automáticamente
 * los datos del trabajador con la tabla Trabajadores.
 * Si el DNI ya existe → actualiza. Si no → registra.
 */
async function sincronizarDatosTrabajador(datos) {
  const dni = (datos.dni || '').trim();
  if (!dni || !/^\d{8}$/.test(dni)) return;
  if (!datos.apellidosNombres) return;

  // El backend ya sincroniza ficha + contrato en /api/generar.
  // Esta función queda como seguro adicional (silent, no bloquea UI).
  try {
    // También sincronizar contrato si hay datos de fechas o funciones nuevos
    const hayDatosContrato = datos.fechaInicio || datos.fechaTermino || datos.funciones || datos.montoContrato;
    if (hayDatosContrato && datos.numeroMemorandum) {
      await fetchJson('/api/integracion/actualizar-contrato-memo', {
        method: 'PUT',
        body: {
          numeroMemorandum: datos.numeroMemorandum,
          proyecto:         datos.proyecto,
          cui:              datos.cui,
          cargoCodigo:      datos.cargoCodigo,
          fechaInicio:      datos.fechaInicio,
          fechaTermino:     datos.fechaTermino,
          funciones:        datos.funciones,
          observaciones:    datos.observaciones,
          numeroResolucion: datos.numeroResolucion || datos.resolucionProyecto,
        }
      });
    }
  } catch (_) { /* silencioso */ }
}

/**
 * v3.2: Autocompletado unificado — mezcla tabla Trabajadores + historial Registros.
 * La tabla Trabajadores tiene prioridad (datos más recientes y completos).
 */
function configurarAutocompletado() {
  const input = $('#apellidosNombres');
  const lista = $('#autocompleteList');
  if (!input || !lista) return;

  input.addEventListener('input', async () => {
    const term = input.value.toLowerCase().trim();
    if (term.length < 2) { lista.classList.remove('show'); return; }

    // Fuente 1: tabla Trabajadores (llamada API)
    const porDni = new Map();
    try {
      const { data } = await fetchJson(`/api/trabajadores/buscar?q=${encodeURIComponent(term)}`);
      if (data.ok && data.trabajadores) {
        data.trabajadores.forEach(t => porDni.set(t.dni, { ...t, _fuente: 'ficha' }));
      }
    } catch (_) {}

    // Fuente 2: historial de registros (solo si no está ya en la ficha)
    state.registros.forEach(r => {
      if ((r.apellidosNombres||'').toLowerCase().includes(term) || (r.dni||'').includes(term)) {
        if (!porDni.has(r.dni)) porDni.set(r.dni, { ...r, _fuente: 'historial' });
      }
    });

    const top6 = [...porDni.values()].slice(0, 6);
    if (!top6.length) { lista.classList.remove('show'); return; }

    lista.innerHTML = top6.map(r => `
      <div class="autocomplete-item" data-dni="${escapeHtml(r.dni)}">
        <strong>${escapeHtml(r.apellidosNombres || '')}</strong>
        <small>DNI: ${escapeHtml(r.dni)} · ${escapeHtml(r.cargoNombre || '')}
          ${r._fuente === 'ficha' ? '<span style="color:#1a6e1a;font-weight:600;"> 👤 ficha</span>' : '<span style="color:#666;"> 📋 historial</span>'}
        </small>
      </div>
    `).join('');

    lista.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', async () => {
        // Buscar primero en ficha, luego historial
        let datos = porDni.get(item.dataset.dni);
        if (!datos) datos = state.registros.filter(r => r.dni === item.dataset.dni).pop();
        if (datos) {
          _llenarCamposTrabajador(datos);
          lista.classList.remove('show');
          Notif.success(`Datos de ${datos.apellidosNombres} cargados`);
        }
      });
    });
    lista.classList.add('show');
  });
  document.addEventListener('click', e => { if (!input.contains(e.target) && !lista.contains(e.target)) lista.classList.remove('show'); });
}

/* ── PROYECTOS con PAGINACIÓN ───────────────────────────────── */
async function cargarProyectos() {
  const { data } = await fetchJson('/api/proyectos');
  if (!data.ok) { Notif.error('No se pudieron cargar los proyectos'); return; }
  state.proyectos = data.proyectos || [];
  poblarSelectorProyectos();
  renderTablaProyectos();
}

function poblarSelectorProyectos() { filtrarSelectorProyectos($('#filtradorProyectos')?.value || ''); }

function filtrarSelectorProyectos(filtro = '') {
  const sel = $('#proyectoSelector');
  if (!sel) return;
  const actual  = sel.value;
  sel.innerHTML = '<option value="">— Manual / Ingresar nuevo —</option>';
  const activos = state.proyectos.filter(p => p.activo !== false);
  const f       = filtro.toLowerCase().trim();
  const filtrados = f ? activos.filter(p => p.cui.toLowerCase().includes(f) || p.nombre.toLowerCase().includes(f) || (p.componente||'').toLowerCase().includes(f)) : activos;
  filtrados.forEach(p => {
    const o = document.createElement('option');
    o.value = p.cui;
    const nombre = p.nombre.length > 80 ? p.nombre.substring(0, 80) + '…' : p.nombre;
    o.textContent = `[${p.cui}] ${nombre}`;
    sel.appendChild(o);
  });
  const countEl = $('#filtradorCount');
  if (countEl) { if (f) { countEl.textContent = `${filtrados.length} de ${activos.length}`; countEl.classList.remove('hidden'); } else countEl.classList.add('hidden'); }
  if (actual && filtrados.find(p => p.cui === actual)) sel.value = actual;
  if (f && filtrados.length === 1) sel.value = filtrados[0].cui;
}

function aplicarProyectoSeleccionado() {
  const cui = $('#proyectoSelector')?.value;
  if (!cui) return;
  const p = state.proyectos.find(x => x.cui === cui);
  if (!p) return;
  if ($('#proyecto'))           $('#proyecto').value           = p.nombre     || '';
  if ($('#cui'))                $('#cui').value                = p.cui        || '';
  if ($('#componente'))         $('#componente').value         = p.componente || '';
  if ($('#resolucionProyecto')) $('#resolucionProyecto').value = p.resolucion || '';
  Notif.success(`Proyecto CUI ${p.cui} cargado`);
}

function renderTablaProyectos(filtro = '') {
  const tbody = $('#tablaProyectos tbody');
  if (!tbody) return;
  const f     = filtro.toLowerCase().trim();
  const lista = state.proyectos.filter(p => !f || p.cui.toLowerCase().includes(f) || p.nombre.toLowerCase().includes(f) || (p.componente||'').toLowerCase().includes(f));

  Paginator.crear({
    datos:       lista,
    pagina:      state.pags.proyectos,
    porPagina:   15,
    contenedorId:'tablaProyectos',
    paginadorId: 'paginadorProyectos',
    columnas:    6,
    renderFila:  (p) => `
      <tr style="${p.activo===false?'opacity:.6':''}">
        <td style="text-align:center">
          <label class="toggle-switch" title="${p.activo?'Desactivar':'Activar'}">
            <input type="checkbox" ${p.activo!==false?'checked':''} data-cui="${escapeHtml(p.cui)}">
            <span class="slider"></span>
          </label>
        </td>
        <td><strong>${escapeHtml(p.cui)}</strong></td>
        <td class="proyecto-nombre-cell">${escapeHtml(p.nombre)}</td>
        <td>${escapeHtml(p.componente||'—')}</td>
        <td>${escapeHtml(p.resolucion||'—')}</td>
        <td>
          <button class="btn-icon-action" data-edit="${escapeHtml(p.cui)}" title="Editar">✏️</button>
          <button class="btn-icon-action" data-delete="${escapeHtml(p.cui)}" title="Eliminar">🗑️</button>
        </td>
      </tr>
    `,
  });

  Paginator.registrar('paginadorProyectos', pag => { state.pags.proyectos = pag; renderTablaProyectos(filtro); });

  // Estadísticas
  const totales = state.proyectos.length;
  const activos = state.proyectos.filter(p => p.activo !== false).length;
  const st = $('#proyectosStats');
  if (st) st.textContent = `${activos} activos / ${totales} totales`;

  // Listeners en la tabla (usando event delegation)
  const tbl = $('#tablaProyectos');
  if (!tbl) return;
  tbl.onclick = async e => {
    const btnEdit   = e.target.closest('[data-edit]');
    const btnDelete = e.target.closest('[data-delete]');
    const chk       = e.target.closest('input[type="checkbox"][data-cui]');

    if (btnEdit) {
      const p = state.proyectos.find(x => x.cui === btnEdit.dataset.edit);
      if (p) abrirModalProyecto(p);
    }

    if (btnDelete) {
      const cui = btnDelete.dataset.delete;
      const p   = state.proyectos.find(x => x.cui === cui);
      if (!p) return;
      const ok = await confirmar('Eliminar proyecto', `¿Eliminar proyecto CUI ${cui}?\n${p.nombre}`);
      if (!ok) return;
      const { data } = await fetchJson(`/api/proyectos/${encodeURIComponent(cui)}`, { method: 'DELETE' });
      if (data.ok) { state.proyectos = data.proyectos; poblarSelectorProyectos(); renderTablaProyectos(filtro); Notif.success(`Proyecto ${cui} eliminado`); }
      else Notif.error(data.error || 'No se pudo eliminar');
    }

    if (chk) {
      const cui    = chk.dataset.cui;
      const activo = chk.checked;
      const { data } = await fetchJson(`/api/proyectos/${encodeURIComponent(cui)}/toggle`, { method: 'PUT', body: { activo } });
      if (data.ok) {
        state.proyectos = data.proyectos;
        poblarSelectorProyectos();
        renderTablaProyectos(filtro);
        Notif.info(`Proyecto ${cui} ${activo ? 'activado' : 'desactivado'}`);
      } else {
        chk.checked = !activo;
        Notif.error(data.error || 'No se pudo cambiar estado');
      }
    }
  };
}

function abrirModalProyecto(p = null) {
  const editando = !!p;
  $('#modalProyectoTitulo').textContent = editando ? 'Editar Proyecto' : 'Nuevo Proyecto';
  $('#proyectoModoEdicion').value       = editando ? '1' : '0';
  $('#proyectoCuiEdit').value           = p?.cui        || '';
  $('#proyectoCuiEdit').readOnly        = editando;
  $('#proyectoNombreEdit').value        = p?.nombre     || '';
  $('#proyectoComponenteEdit').value    = p?.componente || '';
  $('#proyectoResolucionEdit').value    = p?.resolucion || '';
  $('#proyectoActivoEdit').value        = p?.activo === false ? 'false' : 'true';
  $('#modalEditarProyecto').classList.remove('hidden');
  setTimeout(() => $('#proyectoCuiEdit').focus(), 100);
}

async function submitProyecto(e) {
  e.preventDefault();
  const datos = {
    cui:        $('#proyectoCuiEdit').value.trim(),
    nombre:     $('#proyectoNombreEdit').value.trim(),
    componente: $('#proyectoComponenteEdit').value.trim(),
    resolucion: $('#proyectoResolucionEdit').value.trim(),
    activo:     $('#proyectoActivoEdit').value === 'true',
  };
  const errs = [];
  if (!datos.cui) errs.push('CUI obligatorio');
  else if (!/^\d+$/.test(datos.cui)) errs.push('CUI solo dígitos');
  else if (datos.cui.length < 5 || datos.cui.length > 10) errs.push('CUI debe tener 5–10 dígitos');
  if (!datos.nombre) errs.push('Nombre obligatorio');
  else if (datos.nombre.length < 5) errs.push('Nombre demasiado corto');
  if (errs.length) { Notif.error(errs.join(' · ')); return; }

  const { data } = await fetchJson('/api/proyectos', { method: 'POST', body: datos });
  if (data.ok) {
    state.proyectos = data.proyectos;
    poblarSelectorProyectos();
    renderTablaProyectos($('#buscadorProyectos')?.value || '');
    $('#modalEditarProyecto').classList.add('hidden');
    Notif.success(data.accion === 'creado' ? `Proyecto ${datos.cui} creado` : `Proyecto ${datos.cui} actualizado`);
  } else {
    Notif.error((data.errores||[data.error||'Error']).join(' · '));
  }
}

async function importarProyectosExcel(e) {
  const file = e.target.files[0];
  if (!file) return;
  const ext = file.name.toLowerCase().split('.').pop();
  if (!['xlsx','xls'].includes(ext)) { Notif.error('Solo se aceptan .xlsx o .xls'); e.target.value=''; return; }
  const fd = new FormData();
  fd.append('archivo', file);
  Notif.info('Importando proyectos...');
  const data = await Auth.fetchForm('/proyectos/importar', fd);
  if (!data.ok) { Notif.error(data.error || 'Error en importación'); e.target.value=''; return; }
  state.proyectos = data.proyectos;
  poblarSelectorProyectos();
  renderTablaProyectos('');
  Notif.success(`${data.agregados} proyectos agregados, ${data.actualizados} actualizados`);
  e.target.value = '';
}

/* ── GENERAR DOCUMENTOS ─────────────────────────────────────── */
function validarFormulario(datos) {
  const errs = [];
  if (!datos.numeroMemorandum) errs.push('N° de memorándum requerido');
  if (!datos.fechaMemorandum)  errs.push('Fecha del memorándum requerida');
  if (!datos.cargoCodigo)      errs.push('Cargo requerido');
  if (!datos.dni)              errs.push('DNI requerido');
  else if (!/^\d{8}$/.test(datos.dni)) errs.push('DNI debe tener exactamente 8 dígitos');
  if (!datos.apellidosNombres) errs.push('Nombres y apellidos requeridos');
  if (!datos.proyecto)         errs.push('Nombre del proyecto requerido');
  if (!datos.cui)              errs.push('CUI requerido');
  else if (!/^\d{5,10}$/.test(datos.cui)) errs.push('CUI debe tener 5–10 dígitos');
  if (!datos.telefono1)        errs.push('Teléfono requerido');
  if (!datos.correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)) errs.push('Correo inválido');
  const cargo = state.cargos.find(c => c.codigo === datos.cargoCodigo);
  if (cargo?.requiereCIP && !datos.cip) errs.push('CIP/CAP requerido para este cargo');
  return errs;
}

async function generarDocumentos(e) {
  if (e) e.preventDefault();
  const datos  = obtenerDatosFormulario();
  const errores = validarFormulario(datos);
  if (errores.length) { Notif.error(errores.join(' · ')); return; }

  const btn = $('#btnGenerar');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando...'; }

  try {
    let { data, status } = await fetchJson('/api/generar', { method: 'POST', body: datos });

    if (status === 409 && data.requiereConfirmacion) {
      const ok = await confirmar('Memorándum duplicado', data.error + '\n\n¿Desea continuar de todos modos?');
      if (!ok) return;
      ({ data } = await fetchJson('/api/generar', { method: 'POST', body: { ...datos, permitirDuplicado: true } }));
    }

    if (!data.ok) { Notif.error((data.errores || [data.error]).join(' · ')); return; }

    descargarBase64(data.memo.nombre, data.memo.contenido);
    if (data.dj) setTimeout(() => descargarBase64(data.dj.nombre, data.dj.contenido), 600);

    // v3.2: Sincronizar datos del trabajador con la tabla Trabajadores (silencioso)
    sincronizarDatosTrabajador(datos);

    let msg = `Memo: ${data.memo.nombre}`;
    if (data.memo.rutaGuardada && !data.memo.rutaGuardada.startsWith('[ERROR]'))
      msg += ` · Guardado en: ${data.memo.rutaGuardada}`;
    Notif.success(msg, 8000);

    // Actualizar contador de memorándums
    const num = parseInt(datos.numeroMemorandum, 10);
    if (!isNaN(num) && num > (state.config.ultimoNumeroMemo || 0)) {
      await fetchJson('/api/config', { method: 'POST', body: { ultimoNumeroMemo: num } });
      state.config.ultimoNumeroMemo = num;
    }
  } catch (err) {
    Notif.error('Error inesperado: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📄 Generar Documentos'; }
  }
}

async function previsualizar() {
  const datos  = obtenerDatosFormulario();
  const errores = validarFormulario(datos);
  if (errores.length) { Notif.warning(errores.join(' · ')); return; }
  try {
    const token = Auth.getToken();
    const r = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify(datos),
    });
    if (!r.ok) { const err = await r.json(); Notif.error(err.error); return; }
    const blob = await r.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `PREVIEW-${datos.numeroMemorandum}-${datos.cargoCodigo}.docx`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    Notif.info('Vista previa descargada (no guardada en BD)');
  } catch (err) { Notif.error(err.message); }
}

/* ── MODALES ─────────────────────────────────────────────────── */
function inicializarModales() {
  $$('[data-close-modal]').forEach(btn => btn.addEventListener('click', () => $('#' + btn.dataset.closeModal).classList.add('hidden')));
  $$('.modal').forEach(modal => modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); }));
}

/* ── INICIALIZACIÓN ─────────────────────────────────────────── */
async function init() {
  // Autenticación primero
  const autenticado = await Auth.init();
  if (!autenticado) return;

  inicializarTabs();
  inicializarModales();

  // Mostrar info usuario en header
  const user = Auth.getUsuario();
  if (user) {
    const userEl = $('#userInfo');
    if (userEl) userEl.textContent = `${user.nombre} ${user.apellido} (${user.rol})`;
  }

  // Eventos
  $('#btnLimpiar')?.addEventListener('click', limpiarFormulario);
  $('#btnPreview')?.addEventListener('click', previsualizar);
  $('#formMemo')?.addEventListener('submit', generarDocumentos);
  $('#formConfig')?.addEventListener('submit', guardarConfig);
  $('#btnConfig')?.addEventListener('click', () => activarTab('config'));
  $('#btnAyuda')?.addEventListener('click', () => $('#modalAyuda')?.classList.remove('hidden'));

  // Cargos / plantillas
  $('#btnNuevoCargo')?.addEventListener('click', () => abrirModalCargo());
  $('#formCargo')?.addEventListener('submit', submitCargo);
  $('#inputTablaSalarial')?.addEventListener('change', importarTablaSalarial);
  $('#inputPlantilla')?.addEventListener('change', subirPlantilla);

  // Proyectos
  $('#btnGestionarProyectos')?.addEventListener('click', () => { renderTablaProyectos($('#buscadorProyectos')?.value || ''); $('#modalProyectos')?.classList.remove('hidden'); });
  $('#proyectoSelector')?.addEventListener('change', aplicarProyectoSeleccionado);
  $('#filtradorProyectos')?.addEventListener('input', e => filtrarSelectorProyectos(e.target.value));
  $('#filtradorProyectos')?.addEventListener('keydown', e => { if (e.key === 'Enter') aplicarProyectoSeleccionado(); if (e.key === 'Escape') { $('#filtradorProyectos').value = ''; filtrarSelectorProyectos(''); } });
  $('#btnNuevoProyecto')?.addEventListener('click', () => abrirModalProyecto());
  $('#formProyecto')?.addEventListener('submit', submitProyecto);
  $('#inputProyectosExcel')?.addEventListener('change', importarProyectosExcel);
  $('#buscadorProyectos')?.addEventListener('input', e => { state.pags.proyectos = 1; renderTablaProyectos(e.target.value); });

  // Registros
  $('#buscadorRegistros')?.addEventListener('input', e => { state.pags.registros = 1; renderTablaRegistros(e.target.value); });
  $('#btnRecargarRegistros')?.addEventListener('click', cargarRegistros);
  $('#btnAbrirExcel')?.addEventListener('click', () => { const a = document.createElement('a'); a.href = '/api/registros/exportar'; const t = Auth.getToken(); if (t) { fetch('/api/registros/exportar', { headers: { 'Authorization': `Bearer ${t}` } }).then(r => r.blob()).then(b => { const url = URL.createObjectURL(b); a.href = url; a.download = 'base_de_datos.xlsx'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }); } });
  $('#inputHistorialExcel')?.addEventListener('change', importarHistorialDesdeExcel);

  // Inputs validados
  $('#dni')?.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').substring(0, 8); });
  $('#dni')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); buscarTrabajadorPorDni(); } });
  $('#btnBuscarDni')?.addEventListener('click', buscarTrabajadorPorDni);
  $('#cui')?.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').substring(0, 10); });
  $('#proyectoCuiEdit')?.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').substring(0, 10); });

  // Logout
  $('#btnLogout')?.addEventListener('click', () => Auth.logout());

  // Autocompletado
  configurarAutocompletado();

  // Carga inicial paralela
  await Promise.all([cargarCargos(), cargarPlantillas(), cargarConfig(), cargarRegistros(), cargarProyectos()]);
  limpiarFormulario();
  Notif.success('Sistema GIM v4.0 listo', 3000);
}

document.addEventListener('DOMContentLoaded', init);
