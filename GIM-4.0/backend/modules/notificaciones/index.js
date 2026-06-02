/**
 * MÓDULO: NOTIFICACIONES (v4.1)
 * ==============================
 *   GET    /api/notificaciones           — mis notificaciones (con filtros tipo, leida)
 *   GET    /api/notificaciones/contar    — { ok, noLeidas: N }
 *   PUT    /api/notificaciones/:id/leer  — marcar una como leída
 *   PUT    /api/notificaciones/leer-todas — marcar todas como leídas
 *   POST   /api/notificaciones           — crear (solo admin/super_admin)
 *   DELETE /api/notificaciones/limpiar   — eliminar antiguas (solo super_admin)
 *
 * Todas las rutas requieren autenticar.
 */
'use strict';

const express    = require('express');
const notifMgr   = require('../../lib/notificacionesManager');
const logger     = require('../../lib/logger');
const { RUTAS }  = require('../../lib/config');

const MOD = 'ModNotificaciones';

module.exports = function (mw) {
  const router = express.Router();
  const RUTA   = RUTAS.NOTIFICACIONES;

  // ── Contar no leídas ───────────────────────────────────────────
  // IMPORTANTE: rutas estáticas antes de /:id para evitar conflictos
  router.get('/api/notificaciones/contar', mw.autenticar, async (req, res) => {
    try {
      const noLeidas = await notifMgr.contarNoLeidas(
        RUTA,
        req.usuario.id,
        req.usuario.rol
      );
      res.json({ ok: true, noLeidas });
    } catch (e) {
      logger.error(MOD, 'Error contando notificaciones', { error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Marcar todas como leídas ───────────────────────────────────
  router.put('/api/notificaciones/leer-todas', mw.autenticar, async (req, res) => {
    try {
      const resultado = await notifMgr.marcarTodasLeidas(
        RUTA,
        req.usuario.id,
        req.usuario.rol
      );
      res.json({ ok: true, ...resultado });
    } catch (e) {
      logger.error(MOD, 'Error marcando todas como leídas', { error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Eliminar antiguas (solo super_admin) ───────────────────────
  router.delete('/api/notificaciones/limpiar', mw.autenticar, mw.rol('super_admin'), async (req, res) => {
    try {
      const dias = parseInt(req.query.dias) || 30;
      const resultado = await notifMgr.eliminarAntiguas(RUTA, dias);
      res.json({ ok: true, ...resultado });
    } catch (e) {
      logger.error(MOD, 'Error limpiando notificaciones', { error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Listar mis notificaciones ──────────────────────────────────
  router.get('/api/notificaciones', mw.autenticar, async (req, res) => {
    try {
      const { tipo, leida } = req.query;
      const registros = await notifMgr.listar(
        RUTA,
        req.usuario.id,
        req.usuario.rol,
        { tipo, leida }
      );
      res.json({ ok: true, total: registros.length, registros });
    } catch (e) {
      logger.error(MOD, 'Error listando notificaciones', { error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Crear notificación (solo admin/super_admin) ────────────────
  router.post('/api/notificaciones', mw.autenticar, mw.permiso('config.editar'), async (req, res) => {
    try {
      const nueva = await notifMgr.crear(RUTA, {
        ...req.body,
        origen: 'manual'
      });
      res.status(201).json({ ok: true, registro: nueva });
    } catch (e) {
      logger.error(MOD, 'Error creando notificación', { error: e.message });
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  // ── Marcar una como leída ──────────────────────────────────────
  router.put('/api/notificaciones/:id/leer', mw.autenticar, async (req, res) => {
    try {
      const actualizada = await notifMgr.marcarLeida(
        RUTA,
        req.params.id,
        req.usuario.id,
        req.usuario.rol
      );
      res.json({ ok: true, registro: actualizada });
    } catch (e) {
      logger.error(MOD, 'Error marcando como leída', { error: e.message });
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  return router;
};
