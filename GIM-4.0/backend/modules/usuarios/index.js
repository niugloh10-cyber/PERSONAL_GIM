/**
 * MÓDULO: ADMINISTRACIÓN - USUARIOS, ROLES Y AUTENTICACIÓN
 * ========================================================
 * Login/logout, perfil, cambio de contraseña, gestión de usuarios,
 * catálogo de roles y listado de sesiones.
 */
'use strict';
const express = require('express');
const { limpiarString, esEmailValido } = require('../../lib/validator');

module.exports = function (usersMgr, sessionMgr, auditMgr, mw) {
  const router = express.Router();

  // ── AUTENTICACIÓN ────────────────────────────────────────────
  router.post('/api/auth/login', async (req, res) => {
    try {
      const email     = limpiarString(req.body.email || '', 200).toLowerCase();
      const contrasena = req.body.contrasena || req.body.password || '';
      if (!email || !contrasena) return res.status(400).json({ ok: false, error: 'Email y contraseña son obligatorios' });
      if (!esEmailValido(email)) return res.status(400).json({ ok: false, error: 'Formato de email inválido' });

      const resultado = await usersMgr.verificarCredenciales(email, contrasena);
      if (!resultado.valido) {
        await auditMgr.registrarEvento('LOGIN_FALLIDO', null,
          { email, razon: resultado.error, ipAddress: req.ip, userAgent: req.get('user-agent') }, 'ADVERTENCIA');
        return res.status(401).json({ ok: false, error: resultado.error });
      }
      const token = await sessionMgr.crearSesion(resultado.usuario, req.ip, req.get('user-agent'));
      await usersMgr.registrarLogin(resultado.usuario.id);
      await auditMgr.registrarEvento('LOGIN', resultado.usuario.id, { email, rol: resultado.usuario.rol, ipAddress: req.ip }, 'INFO');
      res.json({
        ok: true, mensaje: 'Sesión iniciada', token,
        usuario: {
          id: resultado.usuario.id, email: resultado.usuario.email,
          nombre: resultado.usuario.nombre, apellido: resultado.usuario.apellido, rol: resultado.usuario.rol,
        },
      });
    } catch (e) { res.status(500).json({ ok: false, error: 'Error al iniciar sesión' }); }
  });

  router.post('/api/auth/logout', mw.autenticar, async (req, res) => {
    try {
      await sessionMgr.cerrarSesion(req.token);
      await auditMgr.registrarEvento('LOGOUT', req.usuario.id, { ipAddress: req.ip }, 'INFO');
      res.json({ ok: true, mensaje: 'Sesión cerrada' });
    } catch (e) { res.status(500).json({ ok: false, error: 'Error al cerrar sesión' }); }
  });

  router.get('/api/auth/me', mw.autenticar, async (req, res) => {
    try {
      const usuario = await usersMgr.obtenerPorId(req.usuario.id);
      if (!usuario) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
      const { contrasena_hash, ...safe } = usuario;
      const permisos = usersMgr.obtenerPermisosRol(usuario.rol);
      res.json({ ok: true, usuario: safe, permisos });
    } catch (e) { res.status(500).json({ ok: false, error: 'Error obteniendo perfil' }); }
  });

  router.post('/api/auth/cambiar-contrasena', mw.autenticar, async (req, res) => {
    try {
      const { contrasenaActual, contrasenaNueva } = req.body;
      if (!contrasenaActual || !contrasenaNueva) return res.status(400).json({ ok: false, error: 'Ambas contraseñas son obligatorias' });
      if (contrasenaNueva.length < 8) return res.status(400).json({ ok: false, error: 'La nueva contraseña debe tener al menos 8 caracteres' });
      await usersMgr.cambiarContrasena(req.usuario.id, contrasenaActual, contrasenaNueva);
      await auditMgr.registrarEvento('CAMBIAR_CONTRASENA', req.usuario.id, { ipAddress: req.ip }, 'INFO');
      await sessionMgr.cerrarSesionesUsuario(req.usuario.id);
      res.json({ ok: true, mensaje: 'Contraseña actualizada. Por seguridad, inicie sesión nuevamente.' });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  // ── USUARIOS ─────────────────────────────────────────────────
  router.get('/api/usuarios', mw.autenticar, mw.permiso('usuarios.ver'), async (req, res) => {
    try { res.json({ ok: true, usuarios: await usersMgr.listarUsuarios() }); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/api/usuarios', mw.autenticar, mw.permiso('usuarios.crear'), async (req, res) => {
    try {
      const nuevo = await usersMgr.crearUsuario(req.body);
      await auditMgr.registrarEvento('CREAR_USUARIO', req.usuario.id, { emailNuevo: nuevo.email, rol: nuevo.rol }, 'INFO');
      res.json({ ok: true, usuario: nuevo });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.put('/api/usuarios/:id', mw.autenticar, mw.permiso('usuarios.editar'), async (req, res) => {
    try {
      const actualizado = await usersMgr.actualizarUsuario(req.params.id, req.body);
      // Si el admin cambió la contraseña de otro usuario, invalidar sus sesiones activas.
      if (req.body.contrasena) {
        await sessionMgr.cerrarSesionesUsuario(req.params.id);
      }
      await auditMgr.registrarEvento('EDITAR_USUARIO', req.usuario.id, { usuarioId: req.params.id }, 'INFO');
      res.json({ ok: true, usuario: actualizado });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.delete('/api/usuarios/:id', mw.autenticar, mw.permiso('usuarios.eliminar'), async (req, res) => {
    try {
      if (req.params.id === req.usuario.id) return res.status(400).json({ ok: false, error: 'No puedes eliminarte a ti mismo' });
      await usersMgr.eliminarUsuario(req.params.id);
      await auditMgr.registrarEvento('ELIMINAR_USUARIO', req.usuario.id, { usuarioEliminado: req.params.id }, 'ADVERTENCIA');
      res.json({ ok: true, mensaje: 'Usuario eliminado' });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.put('/api/usuarios/:id/bloquear', mw.autenticar, mw.permiso('usuarios.bloquear'), async (req, res) => {
    try {
      await usersMgr.bloquearUsuario(req.params.id, req.body.razon || '');
      await auditMgr.registrarEvento('BLOQUEAR_USUARIO', req.usuario.id, { usuarioId: req.params.id, razon: req.body.razon }, 'ADVERTENCIA');
      res.json({ ok: true, mensaje: 'Usuario bloqueado' });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.put('/api/usuarios/:id/desbloquear', mw.autenticar, mw.permiso('usuarios.bloquear'), async (req, res) => {
    try {
      await usersMgr.desbloquearUsuario(req.params.id);
      await auditMgr.registrarEvento('DESBLOQUEAR_USUARIO', req.usuario.id, { usuarioId: req.params.id }, 'INFO');
      res.json({ ok: true, mensaje: 'Usuario desbloqueado' });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  // ── ROLES ────────────────────────────────────────────────────
  router.get('/api/auth/roles', mw.autenticar, (req, res) => {
    res.json({ ok: true, roles: usersMgr.obtenerRolesDisponibles() });
  });

  // ── SESIONES ─────────────────────────────────────────────────
  router.get('/api/sesiones', mw.autenticar, mw.rol('super_admin'), async (req, res) => {
    try {
      const sesiones = await sessionMgr.obtenerTodasLasSesiones();
      res.json({ ok: true, sesiones: sesiones.map(s => ({ ...s, token: s.token.substring(0, 12) + '...' })) });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
