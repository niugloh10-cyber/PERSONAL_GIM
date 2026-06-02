/**
 * MÓDULO: CARGOS Y TABLA SALARIAL
 * ================================
 *   GET    /api/cargos
 *   POST   /api/cargos
 *   DELETE /api/cargos/:codigo
 *   POST   /api/cargos/importar
 */

'use strict';

const express = require('express');
const fs      = require('fs-extra');
const cargosMgr = require('../../lib/cargosManager');
const excelMgr  = require('../../lib/excelManager');
const { limpiarString } = require('../../lib/validator');
const { RUTAS } = require('../../lib/config');

module.exports = function (mw, uploadMiddleware) {
  const router = express.Router();

  router.get('/api/cargos', async (req, res) => {
    try {
      const cargos = await cargosMgr.cargarCargos(RUTAS.CARGOS);
      res.json({ ok: true, cargos });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/api/cargos', mw.autenticar, mw.permiso('cargos.crear'), async (req, res) => {
    try {
      const nuevo = req.body;
      if (!limpiarString(nuevo.codigo) || !limpiarString(nuevo.nombre)) {
        return res.status(400).json({ ok: false, error: 'Código y nombre son obligatorios' });
      }
      const cargos = await cargosMgr.cargarCargos(RUTAS.CARGOS);
      const idx = cargos.findIndex(c => c.codigo === nuevo.codigo);
      if (idx >= 0) { cargos[idx] = { ...cargos[idx], ...nuevo }; }
      else { cargos.push({ activo: true, ...nuevo }); }
      await cargosMgr.guardarCargos(RUTAS.CARGOS, cargos);
      res.json({ ok: true, cargos });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.delete('/api/cargos/:codigo', mw.autenticar, mw.permiso('cargos.eliminar'), async (req, res) => {
    try {
      const cargos = await cargosMgr.cargarCargos(RUTAS.CARGOS);
      const filtrados = cargos.filter(c => c.codigo !== req.params.codigo);
      await cargosMgr.guardarCargos(RUTAS.CARGOS, filtrados);
      res.json({ ok: true, cargos: filtrados });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/api/cargos/importar', mw.autenticar, mw.permiso('cargos.crear'),
    uploadMiddleware.single('archivo'), mw.validarArchivo('.xlsx', '.xls'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ ok: false, error: 'No se subió archivo' });
      const cargosImportados = await excelMgr.importarTablaSalarial(req.file.path);
      await fs.remove(req.file.path).catch(() => {});
      const existentes = await cargosMgr.cargarCargos(RUTAS.CARGOS);
      let agregados = 0, actualizados = 0;
      for (const ci of cargosImportados) {
        const idx = existentes.findIndex(c => c.nombre.toUpperCase() === ci.nombre.toUpperCase());
        if (idx >= 0) { existentes[idx].monto = ci.monto; existentes[idx].requisitos = ci.requisitos; actualizados++; }
        else { existentes.push({ ...ci, plantilla: '', activo: true, requiereCIP: false }); agregados++; }
      }
      await cargosMgr.guardarCargos(RUTAS.CARGOS, existentes);
      res.json({ ok: true, agregados, actualizados, cargos: existentes });
    } catch (e) {
      if (req.file) await fs.remove(req.file.path).catch(() => {});
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
};
