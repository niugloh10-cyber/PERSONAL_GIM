/**
 * MÓDULO: REPORTES (NUEVO v4.0)
 * ==============================
 *   GET /api/reportes/indicadores     tarjetas resumen (Inicio / Reportes)
 *   GET /api/reportes/estadisticas    distribuciones por cargo/proyecto/estado
 */
'use strict';
const express = require('express');
const reportesMgr = require('../../lib/reportesManager');

module.exports = function (mw) {
  const router = express.Router();

  router.get('/api/reportes/indicadores', mw.autenticar, async (req, res) => {
    try {
      const indicadores = await reportesMgr.indicadores();
      res.json({ ok: true, indicadores });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/api/reportes/estadisticas', mw.autenticar, async (req, res) => {
    try {
      const estadisticas = await reportesMgr.estadisticas();
      res.json({ ok: true, estadisticas });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
