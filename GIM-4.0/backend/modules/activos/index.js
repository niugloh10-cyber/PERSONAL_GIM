/**
 * MÓDULO: CONTROL DE ACTIVOS (v4.1)
 * ===================================
 *   GET    /api/activos                    — listar con filtros
 *   POST   /api/activos                    — crear activo
 *   PUT    /api/activos/:id                — actualizar
 *   PUT    /api/activos/:id/asignar        — asignar a trabajador
 *   PUT    /api/activos/:id/desasignar     — desasignar
 *   DELETE /api/activos/:id                — eliminar
 *   GET    /api/activos/estadisticas       — estadísticas
 *   GET    /api/activos/categorias         — catálogo
 */
'use strict';

const express    = require('express');
const activosMgr = require('../../lib/activosManager');
const logger     = require('../../lib/logger');
const { RUTAS }  = require('../../lib/config');

const MOD = 'ModActivos';

module.exports = function (mw) {
  const router = express.Router();
  const RUTA   = RUTAS.ACTIVOS;

  router.get('/api/activos/categorias', mw.autenticar, (req, res) => {
    res.json({ ok: true, categorias: activosMgr.CATEGORIAS, estados: activosMgr.ESTADOS });
  });

  router.get('/api/activos/estadisticas', mw.autenticar, mw.permiso('registros.ver'), async (req, res) => {
    try {
      const stats = await activosMgr.estadisticas(RUTA);
      res.json({ ok: true, ...stats });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/api/activos', mw.autenticar, mw.permiso('registros.ver'), async (req, res) => {
    try {
      const { dni, categoria, estado, q } = req.query;
      const activos = await activosMgr.listar(RUTA, { dni, categoria, estado, q });
      res.json({ ok: true, activos, total: activos.length });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/api/activos', mw.autenticar, mw.permiso('registros.editar'), async (req, res) => {
    try {
      const activo = await activosMgr.crear(RUTA, req.body, req.usuario.email);
      logger.info(MOD, 'Activo creado', { id: activo.id, codigo: activo.codigo });
      res.json({ ok: true, activo });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.put('/api/activos/:id/asignar', mw.autenticar, mw.permiso('registros.editar'), async (req, res) => {
    try {
      const { dni, apellidosNombres, fechaAsignacion } = req.body;
      const activo = await activosMgr.asignar(RUTA, req.params.id, dni, apellidosNombres, fechaAsignacion, req.usuario.email);
      res.json({ ok: true, activo });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.put('/api/activos/:id/desasignar', mw.autenticar, mw.permiso('registros.editar'), async (req, res) => {
    try {
      const activo = await activosMgr.desasignar(RUTA, req.params.id, req.usuario.email);
      res.json({ ok: true, activo });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.put('/api/activos/:id', mw.autenticar, mw.permiso('registros.editar'), async (req, res) => {
    try {
      const activo = await activosMgr.actualizar(RUTA, req.params.id, req.body);
      res.json({ ok: true, activo });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.delete('/api/activos/:id', mw.autenticar, mw.permiso('registros.eliminar'), async (req, res) => {
    try {
      await activosMgr.eliminar(RUTA, req.params.id);
      logger.info(MOD, 'Activo eliminado', { id: req.params.id });
      res.json({ ok: true, mensaje: 'Activo eliminado' });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  return router;
};
