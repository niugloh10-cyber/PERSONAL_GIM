/**
 * MÓDULO: CONFIGURACIÓN DE MÓDULOS (PLATAFORMA CONFIGURABLE) — NUEVO v4.0
 * =======================================================================
 * Permite al Super Administrador gobernar la estructura del sistema sin
 * tocar código fuente.
 *
 *   GET   /api/modulos            registro completo (cualquier autenticado;
 *                                  el front filtra por permiso/estado)
 *   PUT   /api/modulos            reemplaza el registro          [super_admin]
 *   POST  /api/modulos/reset      restaura el catálogo de fábrica [super_admin]
 */
'use strict';
const express = require('express');
const modulosMgr = require('../../lib/modulosManager');
const logger = require('../../lib/logger');
const { RUTAS } = require('../../lib/config');

const MOD = 'ModConfiguracion';

module.exports = function (mw) {
  const router = express.Router();

  router.get('/api/modulos', mw.autenticar, async (req, res) => {
    try {
      const config = await modulosMgr.cargar(RUTAS.MODULOS);
      res.json({ ok: true, modulos: config });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.put('/api/modulos', mw.autenticar, mw.permiso('modulos.configurar'), async (req, res) => {
    try {
      const entrante = req.body && req.body.modulos ? req.body.modulos : req.body;
      if (!entrante || !Array.isArray(entrante.grupos)) {
        return res.status(400).json({ ok: false, error: 'Estructura inválida: se esperaba { grupos: [...] }' });
      }
      const guardado = await modulosMgr.guardar(RUTAS.MODULOS, entrante);
      logger.info(MOD, 'Registro de módulos actualizado', { usuario: req.usuario?.email });
      res.json({ ok: true, modulos: guardado });
    } catch (e) {
      logger.error(MOD, 'Error guardando módulos', { error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.post('/api/modulos/reset', mw.autenticar, mw.permiso('modulos.configurar'), async (req, res) => {
    try {
      const def = await modulosMgr.resetear(RUTAS.MODULOS);
      logger.info(MOD, 'Registro de módulos restaurado a fábrica', { usuario: req.usuario?.email });
      res.json({ ok: true, modulos: def });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
