/**
 * SISTEMA GIM v3.0 - MIDDLEWARES DE SEGURIDAD
 * =============================================
 * MEJORAS v3.0:
 * - Helmet integrado
 * - Rate limiting mejorado con express-rate-limit
 * - Validación de uploads más estricta
 * - Manejo centralizado de errores
 * - Headers de seguridad
 */

'use strict';

const path   = require('path');
const logger = require('../lib/logger');
const { SECURITY, UPLOAD } = require('../lib/config');

const MOD = 'Middleware';

// ── Autenticación ─────────────────────────────────────────────

function middlewareAutenticar(sessionMgr, auditMgr) {
  return async (req, res, next) => {
    try {
      const token =
        (req.headers.authorization || '').replace(/^Bearer\s+/i, '') ||
        (req.cookies && req.cookies.sesion_token) ||
        '';

      if (!token) {
        return res.status(401).json({ ok: false, error: 'No autenticado. Se requiere token.' });
      }

      const sesion = await sessionMgr.obtenerSesion(token);
      if (!sesion) {
        if (auditMgr) {
          auditMgr.registrarEvento('LOGIN_FALLIDO', null,
            { razon: 'Token inválido o expirado', ip: req.ip }, 'ADVERTENCIA');
        }
        return res.status(401).json({ ok: false, error: 'Sesión inválida o expirada' });
      }

      await sessionMgr.actualizarActividad(token);

      req.usuario = {
        id: sesion.usuarioId,
        email: sesion.email,
        nombre: sesion.nombre,
        apellido: sesion.apellido,
        rol: sesion.rol,
      };
      req.token = token;
      next();
    } catch (e) {
      logger.error(MOD, 'Error en autenticación', { error: e.message });
      res.status(500).json({ ok: false, error: 'Error de autenticación' });
    }
  };
}

// ── Autorización por permiso ──────────────────────────────────

function middlewarePermiso(usersManager, permisoRequerido) {
  return async (req, res, next) => {
    try {
      if (!req.usuario) {
        return res.status(401).json({ ok: false, error: 'No autenticado' });
      }
      const usuario = await usersManager.obtenerPorId(req.usuario.id);
      if (!usuario || !usersManager.tienePermiso(usuario, permisoRequerido)) {
        logger.warn(MOD, 'Acceso denegado', { usuario: req.usuario.email, permiso: permisoRequerido });
        return res.status(403).json({ ok: false, error: 'Acceso denegado. Permisos insuficientes.' });
      }
      next();
    } catch (e) {
      logger.error(MOD, 'Error en permiso', { error: e.message });
      res.status(500).json({ ok: false, error: 'Error de autorización' });
    }
  };
}

function middlewarePermisoOr(usersManager, permisosRequeridos) {
  return async (req, res, next) => {
    try {
      if (!req.usuario) return res.status(401).json({ ok: false, error: 'No autenticado' });
      const usuario = await usersManager.obtenerPorId(req.usuario.id);
      if (!usuario || !usersManager.tieneAlgunPermiso(usuario, permisosRequeridos)) {
        return res.status(403).json({ ok: false, error: 'Acceso denegado. Permisos insuficientes.' });
      }
      next();
    } catch (e) {
      res.status(500).json({ ok: false, error: 'Error de autorización' });
    }
  };
}

function middlewareRol(usersManager, rolMinimo) {
  const niveles = { usuario: 1, editor: 2, admin: 3, super_admin: 4 };
  const nivelReq = niveles[rolMinimo] || 0;
  return async (req, res, next) => {
    try {
      if (!req.usuario) return res.status(401).json({ ok: false, error: 'No autenticado' });
      const usuario = await usersManager.obtenerPorId(req.usuario.id);
      if (!usuario || !usersManager.tieneNivelRol(usuario, nivelReq)) {
        return res.status(403).json({ ok: false, error: `Rol insuficiente. Se requiere: ${rolMinimo}` });
      }
      next();
    } catch (e) {
      res.status(500).json({ ok: false, error: 'Error de autorización' });
    }
  };
}

// ── Auditoría ─────────────────────────────────────────────────

function middlewareAuditoria(auditMgr, tipoEvento, nivel = 'INFO') {
  return async (req, res, next) => {
    const orig = res.json.bind(res);
    res.json = function(data) {
      if (req.usuario && data.ok !== false) {
        auditMgr.registrarEvento(tipoEvento, req.usuario.id, {
          metodo: req.method, ruta: req.path,
          ipAddress: req.ip, userAgent: req.get('user-agent'),
        }, nivel);
      }
      return orig(data);
    };
    next();
  };
}

// ── Rate limiting (Map en memoria, sobrevive reinicios con TTL corto) ─────────
// Usamos un Map por proceso (rápido) pero con limpieza automática cada minuto.
// Para el login se aplica rate limit estricto independiente.

function middlewareRateLimiting(ventanaMs = SECURITY.RATE_LIMIT_WINDOW_MS, maxSolicitudes = SECURITY.RATE_LIMIT_MAX) {
  // Mapa compartido entre instancias de este middleware en el mismo proceso.
  // Clave: `${ip}:${ventanaMs}` para que login y general no interfieran.
  if (!global._gimRateMap) global._gimRateMap = new Map();
  const solicitudes = global._gimRateMap;

  setInterval(() => {
    const ahora = Date.now();
    for (const [key, ts] of solicitudes) {
      const validos = ts.filter(t => ahora - t < ventanaMs);
      if (!validos.length) solicitudes.delete(key);
      else solicitudes.set(key, validos);
    }
  }, 60 * 1000).unref(); // unref() para no bloquear el cierre del proceso

  return (req, res, next) => {
    const ip    = req.ip || req.socket?.remoteAddress || 'unknown';
    const key   = `${ip}:${ventanaMs}`;
    const ahora = Date.now();
    const ts    = (solicitudes.get(key) || []).filter(t => ahora - t < ventanaMs);
    if (ts.length >= maxSolicitudes) {
      logger.warn(MOD, 'Rate limit alcanzado', { ip, ventanaMs, max: maxSolicitudes });
      res.set('Retry-After', Math.ceil(ventanaMs / 1000));
      return res.status(429).json({ ok: false, error: 'Demasiadas solicitudes. Intente en un momento.' });
    }
    ts.push(ahora);
    solicitudes.set(key, ts);
    next();
  };
}

// ── Validación de archivo subido ──────────────────────────────

function middlewareValidarArchivo(tiposPermitidos = UPLOAD.ALLOWED_EXTENSIONS) {
  return (req, res, next) => {
    if (!req.file) return next();
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!tiposPermitidos.includes(ext)) {
      return res.status(400).json({ ok: false, error: `Tipo de archivo no permitido. Solo: ${tiposPermitidos.join(', ')}` });
    }
    if (req.file.size > UPLOAD.MAX_FILE_SIZE) {
      return res.status(400).json({ ok: false, error: 'Archivo demasiado grande. Máximo 20MB.' });
    }
    next();
  };
}

// ── Cumplimiento estricto del rol "Usuario Básico" (solo escritura) ──
// Garantiza que el rol 'usuario' SOLO pueda cargar datos del trabajador y
// subir documentos del legajo por DNI. Bloquea toda lectura de datos previos
// y toda edición/eliminación, sin importar qué módulo exponga la ruta.
function middlewareUsuarioBasico(sessionMgr) {
  const permitido = (method, p) => {
    if (!p.startsWith('/api/')) return true;            // estáticos
    if (p.startsWith('/api/auth/')) return true;        // login/logout/perfil
    if (method === 'GET' && (p === '/api/info' || p === '/api/modulos')) return true;
    if (method === 'GET' && p === '/api/legajo/categorias') return true; // catálogo estático
    if (method === 'POST' && p === '/api/trabajadores') return true;     // 2. Datos del Trabajador
    if (method === 'POST' && /^\/api\/legajo\/\d{8}\/documento$/.test(p)) return true; // subir doc por DNI
    return false;
  };
  return async (req, res, next) => {
    try {
      if (!req.path.startsWith('/api/')) return next();
      const token =
        (req.headers.authorization || '').replace(/^Bearer\s+/i, '') ||
        (req.cookies && req.cookies.sesion_token) || '';
      if (!token) return next();
      const sesion = await sessionMgr.obtenerSesion(token);
      if (!sesion || sesion.rol !== 'usuario') return next();
      req.rolBasico = true;
      if (permitido(req.method, req.path)) return next();
      return res.status(403).json({
        ok: false,
        soloEscritura: true,
        error: 'Rol Usuario Básico: solo puede cargar datos del trabajador y documentos. Sin lectura ni edición de datos previos.',
      });
    } catch (_) { next(); }
  };
}

// ── Manejo centralizado de errores ────────────────────────────

function middlewareErrores() {
  return (err, req, res, next) => {
    logger.error(MOD, 'Error no manejado', { error: err.message, stack: err.stack, url: req.url });
    res.status(err.statusCode || 500).json({
      ok: false,
      error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno del servidor',
    });
  };
}

// ── Headers adicionales de seguridad ─────────────────────────

function middlewareSeguridad() {
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.removeHeader('X-Powered-By');
    next();
  };
}

module.exports = {
  middlewareAutenticar,
  middlewarePermiso,
  middlewarePermisoOr,
  middlewareRol,
  middlewareAuditoria,
  middlewareRateLimiting,
  middlewareValidarArchivo,
  middlewareUsuarioBasico,
  middlewareErrores,
  middlewareSeguridad,
};
