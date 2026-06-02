/**
 * SISTEMA GIM v3.1 - MÓDULO DE AUTENTICACIÓN FRONTEND
 * =====================================================
 * CORRECCIÓN v3.1:
 *  - NO llama a Auth.init() automáticamente al cargar.
 *    El dashboard.js lo llama explícitamente en DOMContentLoaded.
 *  - Esto evita la condición de carrera que producía pantalla en blanco.
 */

'use strict';

const Auth = (() => {
  const API = '/api';
  let _usuario = null;
  let _token   = null;
  let _permisos = [];

  function _cargarSesion() {
    _token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
    try {
      const u = sessionStorage.getItem('usuario') || localStorage.getItem('usuario');
      _usuario = u ? JSON.parse(u) : null;
    } catch (_) { _usuario = null; }
  }

  function _guardarSesion(token, usuario) {
    _token   = token;
    _usuario = usuario;
    sessionStorage.setItem('auth_token', token);
    sessionStorage.setItem('usuario', JSON.stringify(usuario));
    localStorage.setItem('auth_token', token);
    localStorage.setItem('usuario', JSON.stringify(usuario));
  }

  function _limpiarSesion() {
    _token = _usuario = null;
    _permisos = [];
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('usuario');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('usuario');
  }

  /**
   * Inicializar autenticación.
   * Redirige a /login.html si no hay sesión válida.
   * Devuelve true si la sesión es válida, false si redirigió.
   */
  async function init() {
    _cargarSesion();
    if (!_token || !_usuario) {
      if (!window.location.pathname.includes('login')) {
        window.location.href = '/login.html';
      }
      return false;
    }

    try {
      const resp = await fetch(`${API}/auth/me`, {
        headers: { 'Authorization': `Bearer ${_token}` },
      });
      if (resp.status === 401) {
        _limpiarSesion();
        window.location.href = '/login.html';
        return false;
      }
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok) {
          _usuario  = data.usuario;
          _permisos = data.permisos || [];
          sessionStorage.setItem('usuario', JSON.stringify(_usuario));
          localStorage.setItem('usuario', JSON.stringify(_usuario));
        }
      }
    } catch (_) {
      // Sin red: continuar con datos locales (modo offline)
    }

    return true;
  }

  /**
   * Petición autenticada al API
   */
  async function fetch_(endpoint, opciones = {}) {
    _cargarSesion();
    const headers = {
      'Content-Type': 'application/json',
      ...opciones.headers,
    };
    if (_token) headers['Authorization'] = `Bearer ${_token}`;
    if (opciones.body instanceof FormData) delete headers['Content-Type'];

    try {
      const resp = await fetch(`${API}${endpoint}`, { ...opciones, headers });
      if (resp.status === 401) {
        _limpiarSesion();
        window.location.href = '/login.html';
        return { ok: false, error: 'Sesión expirada' };
      }
      return await resp.json();
    } catch (e) {
      return { ok: false, error: 'Error de conexión: ' + e.message };
    }
  }

  async function fetchForm(endpoint, formData) {
    _cargarSesion();
    try {
      const resp = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: _token ? { 'Authorization': `Bearer ${_token}` } : {},
        body: formData,
      });
      if (resp.status === 401) {
        _limpiarSesion();
        window.location.href = '/login.html';
        return { ok: false, error: 'Sesión expirada' };
      }
      return await resp.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async function logout() {
    try { await fetch_('/auth/logout', { method: 'POST' }); } catch (_) {}
    _limpiarSesion();
    window.location.href = '/login.html';
  }

  function getUsuario()  { return _usuario; }
  function getToken()    { return _token; }
  function getRol()      { return _usuario?.rol || 'usuario'; }

  function tienePermiso(permiso) {
    if (!_usuario) return false;
    if (_permisos.length > 0) return _permisos.includes(permiso);
    const PERMISOS_ROL = {
      super_admin: ['*'],
      admin: ['generar.crear','generar.ver','registros.ver','registros.editar','cargos.ver','usuarios.ver','logs.ver','config.ver','legajo.ver','legajo.cargar','legajo.editar','asistencia.ver','asistencia.cargar','asistencia.editar','personal.cargar'],
      editor: ['generar.crear','generar.ver','registros.ver','registros.editar','cargos.ver','legajo.ver','legajo.cargar','asistencia.ver','asistencia.cargar','personal.cargar'],
      usuario: ['legajo.ver','legajo.cargar','asistencia.ver','asistencia.cargar','personal.cargar'],
    };
    const ps = PERMISOS_ROL[_usuario.rol] || [];
    return ps.includes('*') || ps.includes(permiso);
  }

  return { init, fetch_, fetchForm, logout, getUsuario, getToken, getRol, tienePermiso };
})();

window.Auth = Auth;
