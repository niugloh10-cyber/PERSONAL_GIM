/**
 * MÓDULO: ORGANIGRAMA (v4.1)
 * ===========================
 *   GET    /api/organigrama            — obtener estructura completa
 *   POST   /api/organigrama/nodo       — agregar nodo
 *   PUT    /api/organigrama/nodo/:id   — actualizar nodo
 *   DELETE /api/organigrama/nodo/:id   — eliminar nodo
 *   PUT    /api/organigrama            — reemplazar estructura completa
 */
'use strict';

const express  = require('express');
const orgMgr   = require('../../lib/organigramaManager');
const logger   = require('../../lib/logger');
const { RUTAS } = require('../../lib/config');

const MOD = 'ModOrganigrama';

module.exports = function (mw) {
  const router = express.Router();
  const RUTA   = RUTAS.ORGANIGRAMA;

  router.get('/api/organigrama', mw.autenticar, async (req, res) => {
    try {
      const datos = await orgMgr.obtener(RUTA);
      res.json({ ok: true, ...datos });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/api/organigrama/nodo', mw.autenticar, mw.permiso('config.editar'), async (req, res) => {
    try {
      const nodo = await orgMgr.agregarNodo(RUTA, req.body, req.usuario.email);
      res.json({ ok: true, nodo });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.put('/api/organigrama/nodo/:id', mw.autenticar, mw.permiso('config.editar'), async (req, res) => {
    try {
      const nodo = await orgMgr.actualizarNodo(RUTA, req.params.id, req.body);
      res.json({ ok: true, nodo });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.delete('/api/organigrama/nodo/:id', mw.autenticar, mw.permiso('config.editar'), async (req, res) => {
    try {
      await orgMgr.eliminarNodo(RUTA, req.params.id);
      logger.info(MOD, 'Nodo eliminado', { id: req.params.id });
      res.json({ ok: true, mensaje: 'Nodo eliminado' });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.put('/api/organigrama', mw.autenticar, mw.permiso('config.editar'), async (req, res) => {
    try {
      const { nodos } = req.body;
      const datos = await orgMgr.guardarCompleto(RUTA, nodos, req.usuario.email);
      res.json({ ok: true, ...datos });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  return router;
};
