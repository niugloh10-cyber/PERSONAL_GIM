/**
 * MÓDULO: CAPACITACIONES (v4.1)
 * ==============================
 *   GET    /api/capacitaciones                         — listar
 *   POST   /api/capacitaciones                         — crear
 *   PUT    /api/capacitaciones/:id                     — actualizar
 *   DELETE /api/capacitaciones/:id                     — eliminar
 *   POST   /api/capacitaciones/:id/participantes       — agregar participante
 *   PUT    /api/capacitaciones/:id/participantes/:dni  — actualizar participante
 *   GET    /api/capacitaciones/trabajador/:dni         — capacitaciones de un trabajador
 *   GET    /api/capacitaciones/tipos                   — catálogo
 */
'use strict';

const express    = require('express');
const capMgr     = require('../../lib/capacitacionesManager');
const logger     = require('../../lib/logger');
const { RUTAS }  = require('../../lib/config');

const MOD = 'ModCapacitaciones';

module.exports = function (mw) {
  const router = express.Router();
  const RUTA   = RUTAS.CAPACITACIONES;

  router.get('/api/capacitaciones/tipos', mw.autenticar, (req, res) => {
    res.json({ ok: true, tipos: capMgr.TIPOS, modalidades: capMgr.MODALIDADES });
  });

  router.get('/api/capacitaciones/trabajador/:dni', mw.autenticar, async (req, res) => {
    try {
      const resumen = await capMgr.resumenDni(RUTA, req.params.dni);
      res.json({ ok: true, ...resumen });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/api/capacitaciones', mw.autenticar, async (req, res) => {
    try {
      const { tipo, modalidad, desde, hasta, dniParticipante } = req.query;
      const capacitaciones = await capMgr.listar(RUTA, { tipo, modalidad, desde, hasta, dniParticipante });
      res.json({ ok: true, capacitaciones, total: capacitaciones.length });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/api/capacitaciones', mw.autenticar, mw.permiso('registros.editar'), async (req, res) => {
    try {
      const cap = await capMgr.crear(RUTA, req.body, req.usuario.email);
      logger.info(MOD, 'Capacitación creada', { id: cap.id, titulo: cap.titulo });
      res.json({ ok: true, capacitacion: cap });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.put('/api/capacitaciones/:id', mw.autenticar, mw.permiso('registros.editar'), async (req, res) => {
    try {
      const cap = await capMgr.actualizar(RUTA, req.params.id, req.body);
      res.json({ ok: true, capacitacion: cap });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.delete('/api/capacitaciones/:id', mw.autenticar, mw.permiso('registros.eliminar'), async (req, res) => {
    try {
      await capMgr.eliminar(RUTA, req.params.id);
      res.json({ ok: true, mensaje: 'Capacitación eliminada' });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.post('/api/capacitaciones/:id/participantes', mw.autenticar, mw.permiso('registros.editar'), async (req, res) => {
    try {
      const cap = await capMgr.agregarParticipante(RUTA, req.params.id, req.body);
      res.json({ ok: true, capacitacion: cap });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.put('/api/capacitaciones/:id/participantes/:dni', mw.autenticar, mw.permiso('registros.editar'), async (req, res) => {
    try {
      const cap = await capMgr.actualizarParticipante(RUTA, req.params.id, req.params.dni, req.body);
      res.json({ ok: true, capacitacion: cap });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  return router;
};
