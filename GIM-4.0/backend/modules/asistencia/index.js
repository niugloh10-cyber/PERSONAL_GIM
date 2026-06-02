/**
 * MÓDULO: CONTROL DE ASISTENCIA (NUEVO v4.0)
 * ===========================================
 *   GET    /api/asistencia                 (filtros: dni, fecha, desde, hasta, estado)
 *   POST   /api/asistencia                 (registrar/actualizar)
 *   DELETE /api/asistencia/:id
 *   GET    /api/asistencia/resumen/:dni     (?mes=YYYY-MM)
 *   GET    /api/asistencia/estados          (catálogo de estados)
 */
'use strict';
const express = require('express');
const asistenciaMgr = require('../../lib/asistenciaManager');
const { RUTAS } = require('../../lib/config');

module.exports = function (mw) {
  const router = express.Router();

  router.get('/api/asistencia/estados', mw.autenticar, (req, res) => {
    res.json({ ok: true, estados: asistenciaMgr.ESTADOS });
  });

  router.get('/api/asistencia', mw.autenticar, mw.permiso('asistencia.ver'), async (req, res) => {
    try {
      const { dni, fecha, desde, hasta, estado } = req.query;
      const registros = await asistenciaMgr.listar(RUTAS.ASISTENCIA, { dni, fecha, desde, hasta, estado });
      res.json({ ok: true, registros });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/api/asistencia', mw.autenticar, mw.permiso('asistencia.cargar'), async (req, res) => {
    try {
      const reg = await asistenciaMgr.registrar(RUTAS.ASISTENCIA, req.body, req.usuario?.email);
      res.json({ ok: true, registro: reg });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.delete('/api/asistencia/:id', mw.autenticar, mw.permiso('asistencia.editar'), async (req, res) => {
    try {
      const r = await asistenciaMgr.eliminar(RUTAS.ASISTENCIA, req.params.id);
      res.json(r);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/api/asistencia/resumen/:dni', mw.autenticar, mw.permiso('asistencia.ver'), async (req, res) => {
    try {
      const dni = (req.params.dni || '').replace(/\D/g, '');
      if (!dni || dni.length !== 8) return res.status(400).json({ ok: false, error: 'DNI inválido' });
      const resumen = await asistenciaMgr.resumenMensual(RUTAS.ASISTENCIA, dni, req.query.mes);
      res.json({ ok: true, ...resumen });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
