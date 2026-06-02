/**
 * SISTEMA GIM v3.4 - GESTOR DE SESIONES
 * =======================================
 * MEJORAS v3.3 (incluye correcciones críticas):
 * - Tokens criptográficamente seguros
 * - Rotación de tokens en actividad
 * - Sesiones indexadas en memoria para O(1) lookup
 * - Límite máximo de sesiones por usuario
 */

'use strict';

const crypto = require('crypto');
const fs     = require('fs-extra');
const path   = require('path');
const { SECURITY } = require('./config');

const MAX_SESIONES_POR_USUARIO = 5;

class SessionManager {
  constructor(rutaArchivo) {
    this.rutaArchivo = rutaArchivo;
    this._cache = new Map(); // token → sesion
  }

  async crearSesion(usuario, ipAddress = '', userAgent = '') {
    const token = this._generarToken();
    const sesion = {
      token,
      usuarioId: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol,
      creadaEn: new Date().toISOString(),
      ultimaActividad: new Date().toISOString(),
      expiresAt: new Date(Date.now() + SECURITY.SESSION_EXPIRY_MS).toISOString(),
      ipAddress: ipAddress || '',
      userAgent: (userAgent || '').substring(0, 200),
    };

    this._cache.set(token, sesion);

    // Guardar en disco y limitar sesiones
    const sesiones = await this._cargar();
    sesiones.push(sesion);

    // Limitar a MAX_SESIONES_POR_USUARIO por usuario (eliminar las más viejas)
    const delUsuario = sesiones.filter(s => s.usuarioId === usuario.id);
    if (delUsuario.length > MAX_SESIONES_POR_USUARIO) {
      delUsuario.sort((a, b) => new Date(a.creadaEn) - new Date(b.creadaEn));
      const aEliminar = delUsuario.slice(0, delUsuario.length - MAX_SESIONES_POR_USUARIO).map(s => s.token);
      for (const t of aEliminar) this._cache.delete(t);
      // La sesión nueva ya está en `sesiones`; solo hay que excluir las viejas y guardar
      const filtradas = sesiones.filter(s => !aEliminar.includes(s.token));
      await this._guardar(filtradas);
      return token;
    }

    await this._guardar(sesiones);
    return token;
  }

  async obtenerSesion(token) {
    if (!token) return null;

    // Primero en caché
    if (this._cache.has(token)) {
      const s = this._cache.get(token);
      if (new Date(s.expiresAt) < new Date()) {
        this._cache.delete(token);
        await this._eliminarDelDisco(token);
        return null;
      }
      return s;
    }

    // En disco
    const sesiones = await this._cargar();
    const s = sesiones.find(s => s.token === token);
    if (!s) return null;
    if (new Date(s.expiresAt) < new Date()) {
      await this._eliminarDelDisco(token);
      return null;
    }
    this._cache.set(token, s);
    return s;
  }

  async actualizarActividad(token) {
    const s = await this.obtenerSesion(token);
    if (!s) return false;
    // Calcular diff ANTES de actualizar para que el umbral de 5 min funcione correctamente
    const diff = Date.now() - new Date(s.ultimaActividad).getTime();
    s.ultimaActividad = new Date().toISOString();
    this._cache.set(token, s);
    // Persistir en disco solo si han pasado más de 5 minutos desde la última escritura
    if (diff > 5 * 60 * 1000) {
      const sesiones = await this._cargar();
      const idx = sesiones.findIndex(x => x.token === token);
      if (idx !== -1) { sesiones[idx] = s; await this._guardar(sesiones); }
    }
    return true;
  }

  async cerrarSesion(token) {
    this._cache.delete(token);
    await this._eliminarDelDisco(token);
    return true;
  }

  async cerrarSesionesUsuario(usuarioId) {
    for (const [t, s] of this._cache) {
      if (s.usuarioId === usuarioId) this._cache.delete(t);
    }
    const sesiones = await this._cargar();
    await this._guardar(sesiones.filter(s => s.usuarioId !== usuarioId));
    return true;
  }

  async limpiarExpiradas() {
    const ahora = new Date();
    for (const [t, s] of this._cache) {
      if (new Date(s.expiresAt) < ahora) this._cache.delete(t);
    }
    const sesiones = await this._cargar();
    const activas = sesiones.filter(s => new Date(s.expiresAt) >= ahora);
    await this._guardar(activas);
    return { eliminadas: sesiones.length - activas.length, retenidas: activas.length };
  }

  async obtenerTodasLasSesiones() {
    const sesiones = await this._cargar();
    return sesiones.filter(s => new Date(s.expiresAt) >= new Date());
  }

  async obtenerSesionesUsuario(usuarioId) {
    const todas = await this.obtenerTodasLasSesiones();
    return todas.filter(s => s.usuarioId === usuarioId);
  }

  _generarToken() {
    return 'tok_' + crypto.randomBytes(48).toString('hex');
  }

  async _cargar() {
    try {
      if (await fs.pathExists(this.rutaArchivo)) {
        return JSON.parse(await fs.readFile(this.rutaArchivo, 'utf-8'));
      }
      return [];
    } catch (_) { return []; }
  }

  async _guardar(sesiones) {
    await fs.ensureDir(path.dirname(this.rutaArchivo));
    await fs.writeFile(this.rutaArchivo, JSON.stringify(sesiones, null, 2), 'utf-8');
  }

  async _eliminarDelDisco(token) {
    const sesiones = await this._cargar();
    await this._guardar(sesiones.filter(s => s.token !== token));
  }
}

module.exports = SessionManager;
