/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  SISTEMA GIM v4.0 - SERVIDOR PRINCIPAL                    ║
 * ║  Arquitectura Modular Empresarial                        ║
 * ║  Gerencia de Ingeniería Municipal - MPP                  ║
 * ║                                                          ║
 * ║  Módulos (backend/modules/):                             ║
 * ║   • documentos  • cargos      • personal                 ║
 * ║   • evaluaciones• conclusiones• proyectos                ║
 * ║   • asistencia  • legajo      • reportes                 ║
 * ║   • usuarios    • auditoria   • sistema                  ║
 * ╚══════════════════════════════════════════════════════════╝
 */

'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs-extra');
const multer  = require('multer');
const cors    = require('cors');

const { RUTAS, SECURITY, VERSION, VERSION_NOMBRE } = require('./lib/config');
const logger         = require('./lib/logger');
const UsersManager   = require('./lib/usersManager');
const SessionManager = require('./lib/sessionManager');
const AuditManager   = require('./lib/auditManager');
const cargosMgr   = require('./lib/cargosManager');
const configMgr   = require('./lib/configManager');
// Carga tolerante: si falta el archivo (copia parcial), el sistema sigue
// funcionando sin la plataforma configurable en vez de caerse.
let modulosMgr;
try {
  modulosMgr = require('./lib/modulosManager');
} catch (e) {
  console.warn('  ⚠  No se encontró lib/modulosManager.js — plataforma configurable deshabilitada.');
  modulosMgr = {
    cargar: async () => ({ grupos: [] }),
    rutaApiHabilitada: () => true,
    guardar: async (_, c) => c,
    resetear: async () => ({ grupos: [] }),
  };
}
const excelMgr    = require('./lib/excelManager');
const {
  middlewareAutenticar, middlewarePermiso, middlewarePermisoOr, middlewareRol,
  middlewareAuditoria, middlewareRateLimiting, middlewareErrores,
  middlewareSeguridad, middlewareValidarArchivo, middlewareUsuarioBasico,
} = require('./middleware/index');
const { programarBackupDiario } = require('./services/backupService');

// ── Módulos de dominio ────────────────────────────────────────
const modDocumentos   = require('./modules/documentos');
const modCargos       = require('./modules/cargos');
const modPersonal     = require('./modules/personal');
const modContratos    = require('./modules/contratos');
const modEvaluaciones = require('./modules/evaluaciones');
const modConclusiones = require('./modules/conclusiones');
const modProyectos    = require('./modules/proyectos');
const modAsistencia   = require('./modules/asistencia');
const modLegajo       = require('./modules/legajo');
const modReportes     = require('./modules/reportes');
const modUsuarios     = require('./modules/usuarios');
const modAuditoria    = require('./modules/auditoria');
const modSistema      = require('./modules/sistema');
let modConfiguracion;
try {
  modConfiguracion = require('./modules/configuracion');
} catch (e) {
  modConfiguracion = () => require('express').Router();
}

// ── Asegurar directorios ──────────────────────────────────────
[RUTAS.DATA_DIR, RUTAS.UPLOADS_DIR, RUTAS.PLANTILLAS_DIR, RUTAS.LOGS_DIR,
 RUTAS.BACKUPS_DIR, RUTAS.STORAGE_DIR, RUTAS.EXPEDIENTES_DIR, RUTAS.DATABASE_DIR]
  .forEach(d => fs.ensureDirSync(d));

// ── Gestores compartidos ──────────────────────────────────────
const usersMgr   = new UsersManager(RUTAS.USUARIOS);
const sessionMgr = new SessionManager(RUTAS.SESIONES);
const auditMgr   = new AuditManager(RUTAS.LOGS);

// ── Middleware wrapper ────────────────────────────────────────
const mw = {
  autenticar:    middlewareAutenticar(sessionMgr, auditMgr),
  permiso:       (p)  => middlewarePermiso(usersMgr, p),
  permisoOr:     (ps) => middlewarePermisoOr(usersMgr, ps),
  rol:           (r)  => middlewareRol(usersMgr, r),
  auditoria:     (t, n) => middlewareAuditoria(auditMgr, t, n),
  validarArchivo: (...tipos) => middlewareValidarArchivo(tipos.length ? tipos : undefined),
};

// ── Upload (Multer) ───────────────────────────────────────────
const uploadMiddleware = multer({
  dest: RUTAS.UPLOADS_DIR,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ── App Express ───────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

app.use(middlewareSeguridad());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));
app.use(express.json({ limit: SECURITY.BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: SECURITY.BODY_LIMIT }));
app.use(express.static(RUTAS.PUBLIC_DIR));
app.use(middlewareRateLimiting(SECURITY.RATE_LIMIT_WINDOW_MS, SECURITY.RATE_LIMIT_MAX));
app.use('/api/auth/login', middlewareRateLimiting(60 * 1000, SECURITY.LOGIN_RATE_LIMIT_MAX));

// ── Guard de plataforma configurable ──────────────────────────
// Bloquea las rutas de API de módulos que el Super Administrador haya
// deshabilitado desde el registro (data/modulos.json), sin tocar código.
app.use(async (req, res, next) => {
  try {
    if (!req.path.startsWith('/api/')) return next();
    const config = await modulosMgr.cargar(RUTAS.MODULOS);
    if (!modulosMgr.rutaApiHabilitada(config, req.path)) {
      return res.status(403).json({ ok: false, error: 'Módulo deshabilitado por el administrador', moduloDeshabilitado: true });
    }
  } catch (_) { /* ante cualquier error, no bloquear */ }
  next();
});

// Cumplimiento del rol "Usuario Básico" (solo escritura, sin lectura/edición).
app.use(middlewareUsuarioBasico(sessionMgr));

// ── Montaje de módulos ────────────────────────────────────────
// Recursos Humanos
app.use(modPersonal(mw));
app.use(modContratos(mw));
app.use(modEvaluaciones(mw));
app.use(modConclusiones(mw));
app.use(modAsistencia(mw));
app.use(modLegajo(mw, uploadMiddleware));
// Gestión Documental
app.use(modDocumentos(mw, uploadMiddleware));
app.use(modCargos(mw, uploadMiddleware));
// Proyectos
app.use(modProyectos(mw, uploadMiddleware));
// Reportes
app.use(modReportes(mw));
// Administración
app.use(modUsuarios(usersMgr, sessionMgr, auditMgr, mw));
app.use(modAuditoria(auditMgr, mw));
app.use(modSistema(mw));
app.use(modConfiguracion(mw));

// Fallback SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'Ruta no encontrada' });
  res.sendFile(path.join(RUTAS.PUBLIC_DIR, 'index.html'));
});

app.use(middlewareErrores());

// ── Inicialización ────────────────────────────────────────────
async function inicializar() {
  try {
    logger.info('Server', `Sistema GIM v${VERSION} (${VERSION_NOMBRE}) iniciando...`);

    await cargosMgr.cargarCargos(RUTAS.CARGOS);
    await configMgr.cargarConfig(RUTAS.CONFIG);
    await modulosMgr.cargar(RUTAS.MODULOS);
    await excelMgr.asegurarBaseDeDatos(RUTAS.BD_DEFAULT);

    const usuarios = await usersMgr.cargarUsuarios();
    if (usuarios.length === 0) {
      const admin = await usersMgr.crearUsuario({
        email: 'admin@gim.local', nombre: 'Administrador', apellido: 'Del Sistema',
        rol: 'super_admin', contrasena: 'Admin123456',
      });
      logger.info('Server', '👤 Usuario administrador creado', { email: admin.email });
      console.log('\n  ⚠  CREDENCIALES INICIALES:');
      console.log('     Email:    admin@gim.local');
      console.log('     Password: Admin123456');
      console.log('     ⚠  CAMBIA LA CONTRASEÑA DESPUÉS DEL PRIMER LOGIN\n');
    }

    const { eliminadas } = await sessionMgr.limpiarExpiradas();
    if (eliminadas > 0) logger.info('Server', `${eliminadas} sesiones expiradas eliminadas`);

    programarBackupDiario();

    // Integración del Expediente Único: generar/actualizar el Legajo de todo
    // el personal existente al iniciar (idempotente, en segundo plano).
    (async () => {
      try {
        const legajoSync = require('./lib/legajoSync');
        const r = await legajoSync.sincronizarTodo();
        logger.info('Server', 'Legajo sincronizado al inicio', r);
      } catch (e) {
        logger.warn('Server', 'No se pudo sincronizar el Legajo al inicio', { error: e.message });
      }
    })();

    app.listen(PORT, () => {
      const linea = '═'.repeat(52);
      console.log(`\n  ╔${linea}╗`);
      console.log(`  ║  SISTEMA GIM v${VERSION} - SERVIDOR ACTIVO${' '.repeat(Math.max(0, 52 - 22 - VERSION.length))}║`);
      console.log(`  ║  Arquitectura Modular Empresarial${' '.repeat(Math.max(0, 52 - 35))}║`);
      console.log(`  ╚${linea}╝`);
      console.log(`\n  🌐  URL:         http://localhost:${PORT}`);
      console.log(`  📁  Plantillas:  ${RUTAS.PLANTILLAS_DIR}`);
      console.log(`  💾  Base datos:  ${RUTAS.BD_DEFAULT}`);
      console.log(`  🗂️   Expedientes: ${RUTAS.EXPEDIENTES_DIR}`);
      console.log(`  📝  Logs:        ${RUTAS.LOGS_DIR}`);
      console.log(`\n  Para detener: Ctrl + C\n`);
      logger.info('Server', `Servidor escuchando en http://localhost:${PORT}`);
    });
  } catch (e) {
    logger.error('Server', 'Error fatal al inicializar', { error: e.message });
    process.exit(1);
  }
}

process.on('uncaughtException', (e) => logger.error('Process', 'Excepción no capturada', { error: e.message, stack: e.stack }));
process.on('unhandledRejection', (reason) => logger.error('Process', 'Promesa rechazada no manejada', { reason: String(reason) }));

inicializar();
module.exports = app;
