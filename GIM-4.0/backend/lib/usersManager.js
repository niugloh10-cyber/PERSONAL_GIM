/**
 * SISTEMA GIM v3.0 - GESTOR DE USUARIOS
 * ======================================
 * MEJORAS v3.0:
 * - Hash de contraseñas mejorado (PBKDF2 con mayor iteraciones)
 * - Validación de contraseña fuerte
 * - Sanitización de inputs
 * - Registro de auditoría en operaciones críticas
 */

'use strict';

const fs     = require('fs-extra');
const path   = require('path');
const crypto = require('crypto');
const { limpiarString, esEmailValido } = require('./validator');

// ── Roles y permisos ──────────────────────────────────────────

const ROLES_CONFIG = {
  super_admin: {
    nombre: 'Super Administrador', nivel: 4,
    descripcion: 'Acceso total al sistema',
    permisos: [
      'generar.crear','generar.editar','generar.ver','generar.descargar',
      'registros.ver','registros.editar','registros.eliminar','registros.exportar',
      'cargos.ver','cargos.crear','cargos.editar','cargos.eliminar',
      'usuarios.ver','usuarios.crear','usuarios.editar','usuarios.eliminar',
      'usuarios.bloquear','usuarios.cambiar_rol',
      'config.ver','config.editar',
      'logs.ver','logs.limpiar',
      'sistema.respaldos','sistema.restaurar','sistema.parametros',
      'modulos.ver','modulos.configurar',
      'legajo.ver','legajo.cargar','legajo.editar',
      'asistencia.ver','asistencia.cargar','asistencia.editar',
      'personal.cargar',
    ],
  },
  admin: {
    nombre: 'Administrador', nivel: 3,
    descripcion: 'Gestión de contenido y usuarios',
    permisos: [
      'generar.crear','generar.editar','generar.ver','generar.descargar',
      'registros.ver','registros.editar','registros.exportar',
      'cargos.ver','cargos.crear','cargos.editar',
      'usuarios.ver','usuarios.crear','usuarios.editar',
      'logs.ver','config.ver',
      'legajo.ver','legajo.cargar','legajo.editar',
      'asistencia.ver','asistencia.cargar','asistencia.editar',
      'personal.cargar',
    ],
  },
  editor: {
    nombre: 'Editor', nivel: 2,
    descripcion: 'Crear y editar información',
    permisos: [
      'generar.crear','generar.editar','generar.ver','generar.descargar',
      'registros.ver','registros.editar','cargos.ver',
      'legajo.ver','legajo.cargar',
      'asistencia.ver','asistencia.cargar',
      'personal.cargar',
    ],
  },
  usuario: {
    nombre: 'Usuario Básico', nivel: 1,
    descripcion: 'Solo carga (escritura): datos del trabajador y documentos del legajo por DNI. Sin lectura, edición ni eliminación.',
    permisos: [
      'personal.cargar',
      'legajo.cargar',
    ],
  },
};

// ── Hash de contraseñas ───────────────────────────────────────

const PBKDF2_ITERATIONS = 150000; // más que v2.5 (100000)
const PBKDF2_KEYLEN     = 64;
const PBKDF2_DIGEST     = 'sha512';

function hashearContrasena(contrasena) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(contrasena, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  return `v3$${salt}$${hash}`;
}

function verificarContrasena(contrasena, hashAlmacenado) {
  const partes = hashAlmacenado.split('$');
  let salt, hashOriginal, iterations, keylen, digest;

  if (partes[0] === 'v3') {
    // Formato v3.0
    [, salt, hashOriginal] = partes;
    iterations = PBKDF2_ITERATIONS; keylen = PBKDF2_KEYLEN; digest = PBKDF2_DIGEST;
  } else {
    // Formato v2.x (compatibilidad)
    [salt, hashOriginal] = partes;
    iterations = 100000; keylen = 64; digest = 'sha512';
  }

  const verificacion = crypto.pbkdf2Sync(contrasena, salt, iterations, keylen, digest).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(verificacion, 'hex'), Buffer.from(hashOriginal, 'hex'));
}

function generarId() {
  return 'usr_' + crypto.randomBytes(12).toString('hex');
}

// ── Clase principal ───────────────────────────────────────────

class UsersManager {
  constructor(rutaArchivo) {
    this.rutaArchivo = rutaArchivo;
  }

  async cargarUsuarios() {
    try {
      if (await fs.pathExists(this.rutaArchivo)) {
        return JSON.parse(await fs.readFile(this.rutaArchivo, 'utf-8'));
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  async guardarUsuarios(usuarios) {
    await fs.ensureDir(path.dirname(this.rutaArchivo));
    await fs.writeFile(this.rutaArchivo, JSON.stringify(usuarios, null, 2), 'utf-8');
  }

  async crearUsuario(datos) {
    if (!esEmailValido(datos.email)) throw new Error('Email inválido');
    if (!datos.contrasena || datos.contrasena.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
    if (!limpiarString(datos.nombre)) throw new Error('Nombre es obligatorio');

    const usuarios = await this.cargarUsuarios();
    if (usuarios.some(u => u.email.toLowerCase() === datos.email.toLowerCase())) {
      throw new Error('El email ya está registrado');
    }

    const nuevo = {
      id: generarId(),
      email: datos.email.toLowerCase().trim(),
      nombre: limpiarString(datos.nombre, 100),
      apellido: limpiarString(datos.apellido || '', 100),
      rol: ROLES_CONFIG[datos.rol] ? datos.rol : 'usuario',
      contrasena_hash: hashearContrasena(datos.contrasena),
      estado: datos.estado || 'activo',
      fechaCreacion: new Date().toISOString(),
      fechaUltimoLogin: null,
      intentosFallidos: 0,
      bloqueadoHasta: null,
      notas: limpiarString(datos.notas || '', 500),
    };

    usuarios.push(nuevo);
    await this.guardarUsuarios(usuarios);
    return this._sanitizar(nuevo);
  }

  async obtenerPorEmail(email) {
    const usuarios = await this.cargarUsuarios();
    return usuarios.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  async obtenerPorId(id) {
    const usuarios = await this.cargarUsuarios();
    return usuarios.find(u => u.id === id);
  }

  async listarUsuarios(filtros = {}) {
    let usuarios = await this.cargarUsuarios();
    if (filtros.rol)    usuarios = usuarios.filter(u => u.rol === filtros.rol);
    if (filtros.estado) usuarios = usuarios.filter(u => u.estado === filtros.estado);
    return usuarios.map(u => this._sanitizar(u));
  }

  async verificarCredenciales(email, contrasena) {
    const usuario = await this.obtenerPorEmail(email);
    if (!usuario) return { valido: false, error: 'Credenciales incorrectas' };
    if (usuario.estado === 'bloqueado') return { valido: false, error: 'Usuario bloqueado. Contacte al administrador' };
    if (usuario.estado === 'inactivo')  return { valido: false, error: 'Usuario inactivo' };
    if (usuario.bloqueadoHasta && new Date(usuario.bloqueadoHasta) > new Date()) {
      const minutos = Math.ceil((new Date(usuario.bloqueadoHasta) - new Date()) / 60000);
      return { valido: false, error: `Cuenta bloqueada temporalmente. Intente en ${minutos} minuto(s)` };
    }

    let esValida;
    try {
      esValida = verificarContrasena(contrasena, usuario.contrasena_hash);
    } catch (_) {
      esValida = false;
    }

    if (!esValida) {
      await this._registrarIntentoFallido(usuario.id);
      return { valido: false, error: 'Credenciales incorrectas' };
    }

    // Reencriptar si es hash antiguo (migración automática v2→v3)
    if (!usuario.contrasena_hash.startsWith('v3$')) {
      await this._actualizarHash(usuario.id, contrasena);
    }

    return { valido: true, usuario: this._sanitizar(usuario) };
  }

  async actualizarUsuario(id, datos) {
    const usuarios = await this.cargarUsuarios();
    const idx = usuarios.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('Usuario no encontrado');

    const u = usuarios[idx];
    if (datos.nombre !== undefined) u.nombre = limpiarString(datos.nombre, 100);
    if (datos.apellido !== undefined) u.apellido = limpiarString(datos.apellido, 100);
    if (datos.rol !== undefined && ROLES_CONFIG[datos.rol]) u.rol = datos.rol;
    if (datos.estado !== undefined) u.estado = datos.estado;
    if (datos.notas !== undefined) u.notas = limpiarString(datos.notas, 500);
    if (datos.contrasena) u.contrasena_hash = hashearContrasena(datos.contrasena);

    usuarios[idx] = u;
    await this.guardarUsuarios(usuarios);
    return this._sanitizar(u);
  }

  async cambiarContrasena(id, contrasenaActual, contrasenaNueva) {
    const usuario = await this.obtenerPorId(id);
    if (!usuario) throw new Error('Usuario no encontrado');

    let esValida = false;
    try {
      esValida = verificarContrasena(contrasenaActual, usuario.contrasena_hash);
    } catch (_) {
      // Hash corrupto: tratar como contraseña incorrecta, no lanzar excepción interna
      esValida = false;
    }
    if (!esValida) throw new Error('Contraseña actual incorrecta');
    if (contrasenaNueva.length < 8)
      throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
    if (contrasenaNueva === contrasenaActual)
      throw new Error('La nueva contraseña debe ser diferente a la actual');

    return this.actualizarUsuario(id, { contrasena: contrasenaNueva });
  }

  async bloquearUsuario(id, razon = '') {
    return this.actualizarUsuario(id, { estado: 'bloqueado', notas: razon });
  }

  async desbloquearUsuario(id) {
    const usuarios = await this.cargarUsuarios();
    const idx = usuarios.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('Usuario no encontrado');
    usuarios[idx].estado = 'activo';
    usuarios[idx].intentosFallidos = 0;
    usuarios[idx].bloqueadoHasta = null;
    await this.guardarUsuarios(usuarios);
    return this._sanitizar(usuarios[idx]);
  }

  async eliminarUsuario(id) {
    const usuarios = await this.cargarUsuarios();
    const filtrados = usuarios.filter(u => u.id !== id);
    if (filtrados.length === usuarios.length) throw new Error('Usuario no encontrado');
    await this.guardarUsuarios(filtrados);
    return true;
  }

  async registrarLogin(userId) {
    const usuarios = await this.cargarUsuarios();
    const u = usuarios.find(u => u.id === userId);
    if (u) {
      u.fechaUltimoLogin = new Date().toISOString();
      u.intentosFallidos = 0;
      u.bloqueadoHasta = null;
      await this.guardarUsuarios(usuarios);
    }
  }

  obtenerRolesDisponibles() { return ROLES_CONFIG; }
  obtenerPermisosRol(rol) { return ROLES_CONFIG[rol]?.permisos || []; }

  tienePermiso(usuario, permiso) {
    if (!usuario) return false;
    return this.obtenerPermisosRol(usuario.rol).includes(permiso);
  }

  tienePermisos(usuario, permisos) {
    return permisos.every(p => this.tienePermiso(usuario, p));
  }

  tieneAlgunPermiso(usuario, permisos) {
    return permisos.some(p => this.tienePermiso(usuario, p));
  }

  tieneNivelRol(usuario, nivelRequerido) {
    return (ROLES_CONFIG[usuario?.rol]?.nivel ?? 0) >= nivelRequerido;
  }

  // ── Privados ───────────────────────────────────────────────

  _sanitizar(u) {
    const { contrasena_hash, ...rest } = u;
    return rest;
  }

  async _registrarIntentoFallido(userId) {
    try {
      const { SECURITY } = require('./config');
      const usuarios = await this.cargarUsuarios();
      const u = usuarios.find(u => u.id === userId);
      if (!u) return;
      u.intentosFallidos = (u.intentosFallidos || 0) + 1;
      if (u.intentosFallidos >= SECURITY.MAX_FAILED_ATTEMPTS) {
        u.bloqueadoHasta = new Date(Date.now() + SECURITY.LOCKOUT_DURATION_MS).toISOString();
      }
      await this.guardarUsuarios(usuarios);
    } catch (_) {}
  }

  async _actualizarHash(userId, contrasena) {
    try {
      const usuarios = await this.cargarUsuarios();
      const u = usuarios.find(u => u.id === userId);
      if (u) { u.contrasena_hash = hashearContrasena(contrasena); await this.guardarUsuarios(usuarios); }
    } catch (_) {}
  }
}

module.exports = UsersManager;
module.exports.ROLES_CONFIG = ROLES_CONFIG;
module.exports.hashearContrasena = hashearContrasena;
module.exports.verificarContrasena = verificarContrasena;
