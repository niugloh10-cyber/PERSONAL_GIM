/**
 * SISTEMA GIM v4.0 — VISTA EXCLUSIVA "USUARIO BÁSICO"
 * ===================================================
 * Rol de SOLO ESCRITURA. Flujo:
 *   1) "2. Datos del Trabajador": carga inicial (POST /api/trabajadores).
 *   2) Tras guardar, se habilita "Legajos" para subir documentos por DNI.
 * No se recupera ni muestra información de sesiones anteriores (sesión limpia)
 * y no se permite modificar ni eliminar datos ya ingresados.
 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const notify = (t, m) => { if (typeof Notif !== 'undefined' && Notif[t]) Notif[t](m); };
  let dniActivo = '';
  let subidos = 0;

  function esBasico() {
    try { return Auth.getRol && Auth.getRol() === 'usuario'; } catch (_) { return false; }
  }

  // Activa el modo básico: oculta el menú normal y muestra solo la captura.
  async function montar() {
    document.body.classList.add('modo-basico');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-basico'));
    const nav = $('#navMenu'); if (nav) nav.innerHTML = '';
    const sb = $('#sidebar'); if (sb) sb.style.display = 'none';
    // Nombre del usuario en la cabecera
    const u = Auth.getUsuario && Auth.getUsuario();
    if (u) { const n = $('#userName'); if (n) n.textContent = `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.email; const r = $('#userRole'); if (r) r.textContent = 'Usuario Básico'; }
    // Cargar categorías del legajo (catálogo estático permitido)
    try {
      const c = await Auth.fetch_('/legajo/categorias');
      const sel = $('#bCategoria');
      if (c && c.ok && sel) sel.innerHTML = c.categorias.map(x => `<option value="${x}">${x.replace(/_/g, ' ')}</option>`).join('');
    } catch (_) {}
    limpiarSesion();
  }

  function limpiarSesion() {
    ['bDni','bNombres','bApellidos','bCip','bCargo','bTelefono1','bCorreo','bBarrio','bDistrito','bProvincia','bDescripcion'].forEach(id => { const el = $('#' + id); if (el) el.value = ''; });
    const dep = $('#bDepartamento'); if (dep) dep.value = 'PUNO';
    const ec = $('#bEstadoCivil'); if (ec) ec.value = '';
    dniActivo = ''; subidos = 0;
    $('#bMsg1') && ($('#bMsg1').textContent = '');
    $('#bMsg2') && ($('#bMsg2').textContent = '');
    $('#bContador') && ($('#bContador').textContent = '');
    bloquearPaso2(true);
    const p1 = $('#basicoPaso1'); if (p1) { p1.style.opacity = ''; p1.style.pointerEvents = ''; }
  }

  function bloquearPaso2(bloquear) {
    const p2 = $('#basicoPaso2');
    if (!p2) return;
    p2.style.opacity = bloquear ? '.5' : '';
    p2.style.pointerEvents = bloquear ? 'none' : '';
  }

  window.basicoGuardarTrabajador = async function () {
    const dni = ($('#bDni').value || '').replace(/\D/g, '');
    const nombres = ($('#bNombres').value || '').trim();
    const apellidos = ($('#bApellidos').value || '').trim();
    const msg = $('#bMsg1');
    if (dni.length !== 8) { msg.style.color = '#dc2626'; msg.textContent = 'DNI inválido (8 dígitos).'; return; }
    if (nombres.length < 2 || apellidos.length < 2) { msg.style.color = '#dc2626'; msg.textContent = 'Ingrese nombres y apellidos.'; return; }

    const payload = {
      dni, nombres, apellidos,
      apellidosNombres: `${apellidos} ${nombres}`.trim(), // formato oficial
      cip: $('#bCip').value.trim(), estadoCivil: $('#bEstadoCivil').value,
      cargo: $('#bCargo').value.trim(), telefono1: $('#bTelefono1').value.trim(),
      correo: $('#bCorreo').value.trim(), barrio: $('#bBarrio').value.trim(),
      distrito: $('#bDistrito').value.trim(), provincia: $('#bProvincia').value.trim(),
      departamento: $('#bDepartamento').value.trim(),
    };
    $('#bBtnGuardar').disabled = true;
    const r = await Auth.fetch_('/trabajadores', { method: 'POST', body: JSON.stringify(payload) });
    $('#bBtnGuardar').disabled = false;

    // 409 = ya existe en el sistema: no se puede editar, pero se permite cargar documentos.
    if (r && r.ok) {
      msg.style.color = '#059669'; msg.textContent = '✓ Datos integrados al sistema. Ya puede subir documentos.';
    } else if (r && /existe/i.test(r.error || '')) {
      msg.style.color = '#059669'; msg.textContent = '✓ Trabajador ya registrado en el sistema. Puede subir documentos a su legajo.';
    } else {
      msg.style.color = '#dc2626'; msg.textContent = (r && r.error) || 'Error al guardar.';
      return;
    }
    dniActivo = dni;
    $('#bDniLegajo').textContent = dni;
    bloquearPaso2(false);
    // Bloquear edición de los datos ya ingresados en esta sesión.
    const p1 = $('#basicoPaso1'); if (p1) { p1.style.opacity = '.6'; p1.style.pointerEvents = 'none'; }
  };

  window.basicoSubirDocumento = async function () {
    const msg = $('#bMsg2');
    if (!dniActivo) { msg.style.color = '#dc2626'; msg.textContent = 'Primero guarde los datos del trabajador.'; return; }
    const file = $('#bArchivo').files[0];
    if (!file) { msg.style.color = '#dc2626'; msg.textContent = 'Seleccione un archivo.'; return; }
    const fd = new FormData();
    fd.append('archivo', file);
    fd.append('categoria', $('#bCategoria').value || 'OTROS');
    fd.append('descripcion', $('#bDescripcion').value || '');
    $('#bBtnSubir').disabled = true;
    msg.style.color = '#64748b'; msg.textContent = 'Subiendo…';
    const r = await Auth.fetchForm('/legajo/' + dniActivo + '/documento', fd);
    $('#bBtnSubir').disabled = false;
    if (r && r.ok) {
      subidos++;
      msg.style.color = '#059669'; msg.textContent = '✓ Documento cargado.';
      $('#bArchivo').value = ''; $('#bDescripcion').value = '';
      $('#bContador').textContent = `Documentos cargados en esta sesión: ${subidos}`;
    } else {
      msg.style.color = '#dc2626'; msg.textContent = (r && r.error) || 'Error al subir.';
    }
  };

  window.basicoNuevoTrabajador = function () { limpiarSesion(); $('#bDni').focus(); };

  // Arranque: si el rol es Usuario Básico, montar la vista exclusiva.
  document.addEventListener('DOMContentLoaded', () => {
    let n = 0;
    const t = setInterval(() => {
      n++;
      const listo = (typeof Auth !== 'undefined' && Auth.getToken && Auth.getToken());
      if (listo) { clearInterval(t); if (esBasico()) montar(); }
      else if (n > 60) clearInterval(t);
    }, 100);
  });
})();
