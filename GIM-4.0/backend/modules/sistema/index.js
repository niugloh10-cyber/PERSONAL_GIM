/**
 * MÓDULO: ADMINISTRACIÓN - SISTEMA (CONFIG, BACKUPS, INFO)
 * ========================================================
 *   GET    /api/config
 *   POST   /api/config
 *   POST   /api/backup
 *   GET    /api/backup
 *   GET    /api/info
 */
'use strict';
const express = require('express');
const configMgr = require('../../lib/configManager');
const { RUTAS, VERSION, VERSION_NOMBRE } = require('../../lib/config');
const { crearBackup, listarBackups } = require('../../services/backupService');

module.exports = function (mw) {
  const router = express.Router();

  router.get('/api/config', mw.autenticar, async (req, res) => {
    try { res.json({ ok: true, config: await configMgr.cargarConfig(RUTAS.CONFIG) }); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/api/config', mw.autenticar, mw.permiso('config.editar'), async (req, res) => {
    try {
      const config = await configMgr.cargarConfig(RUTAS.CONFIG);
      const camposPermitidos = ['carpetaSalida', 'rutaBaseDatos', 'numeroResolucion', 'ultimoNumeroMemo', 'prefijoMemo', 'anio'];
      for (const campo of camposPermitidos) {
        if (req.body[campo] !== undefined) config[campo] = req.body[campo];
      }
      await configMgr.guardarConfig(RUTAS.CONFIG, config);
      res.json({ ok: true, config });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/api/backup', mw.autenticar, mw.permiso('sistema.respaldos'), async (req, res) => {
    try { res.json(await crearBackup('manual')); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/api/backup', mw.autenticar, mw.permiso('sistema.respaldos'), async (req, res) => {
    try { res.json({ ok: true, backups: await listarBackups() }); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/api/info', async (req, res) => {
    res.json({
      ok: true,
      version: VERSION,
      versionNombre: VERSION_NOMBRE,
      sistema: 'GIM - Gerencia de Ingeniería Municipal',
      entidad: 'Municipalidad Provincial de Puno',
    });
  });

  return router;
};
