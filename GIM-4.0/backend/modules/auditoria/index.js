/**
 * MÓDULO: ADMINISTRACIÓN - AUDITORÍA (LOGS)
 * ==========================================
 *   GET    /api/logs
 *   GET    /api/logs/exportar
 *   DELETE /api/logs
 */
'use strict';
const express = require('express');

module.exports = function (auditMgr, mw) {
  const router = express.Router();

  router.get('/api/logs', mw.autenticar, mw.permiso('logs.ver'), async (req, res) => {
    try {
      const filtros = {
        tipo: req.query.tipo, nivel: req.query.nivel, usuarioId: req.query.usuarioId,
        desde: req.query.desde, hasta: req.query.hasta, limite: parseInt(req.query.limite) || 200,
      };
      res.json({ ok: true, logs: await auditMgr.obtenerLogs(filtros) });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/api/logs/exportar', mw.autenticar, mw.permiso('logs.ver'), async (req, res) => {
    try {
      const csv = await auditMgr.exportarCSV();
      res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="audit-logs.csv"' });
      res.send(csv);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.delete('/api/logs', mw.autenticar, mw.permiso('logs.limpiar'), async (req, res) => {
    try {
      const resultado = await auditMgr.limpiarLogsAntiguos(req.body.dias || 90);
      await auditMgr.registrarEvento('LIMPIAR_LOGS', req.usuario.id, resultado, 'ADVERTENCIA');
      res.json({ ok: true, ...resultado });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
