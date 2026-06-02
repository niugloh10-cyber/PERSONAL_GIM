/**
 * MÓDULO: PROYECTOS
 * ==================
 *   GET    /api/proyectos
 *   POST   /api/proyectos
 *   PUT    /api/proyectos/:cui/toggle
 *   DELETE /api/proyectos/:cui
 *   POST   /api/proyectos/importar
 */

'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs-extra');
const proyectosMgr = require('../../lib/proyectosManager');
const excelMgr     = require('../../lib/excelManager');
const { RUTAS } = require('../../lib/config');

module.exports = function (mw, uploadMiddleware) {
  const router = express.Router();

  router.get('/api/proyectos', mw.autenticar, async (req, res) => {
    try {
      const proyectos = await proyectosMgr.cargarProyectos(RUTAS.PROYECTOS);
      res.json({ ok: true, proyectos });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/api/proyectos', mw.autenticar, async (req, res) => {
    try {
      const resultado = await proyectosMgr.upsertProyecto(RUTAS.PROYECTOS, req.body);
      if (!resultado.ok) return res.status(400).json({ ok: false, errores: resultado.errores });
      res.json({ ok: true, accion: resultado.accion, proyectos: resultado.proyectos });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.put('/api/proyectos/:cui/toggle', mw.autenticar, async (req, res) => {
    try {
      const resultado = await proyectosMgr.toggleActivo(RUTAS.PROYECTOS, req.params.cui, req.body.activo);
      if (!resultado.ok) return res.status(404).json(resultado);
      res.json(resultado);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.delete('/api/proyectos/:cui', mw.autenticar, async (req, res) => {
    try {
      const proyectos = await proyectosMgr.eliminarProyecto(RUTAS.PROYECTOS, req.params.cui);
      res.json({ ok: true, proyectos });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/api/proyectos/importar', mw.autenticar, uploadMiddleware.single('archivo'), mw.validarArchivo('.xlsx', '.xls'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ ok: false, error: 'No se subió archivo' });
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (!['.xlsx', '.xls'].includes(ext)) {
        await fs.remove(req.file.path).catch(() => {});
        return res.status(400).json({ ok: false, error: 'Solo se aceptan archivos .xlsx o .xls' });
      }
      let resultado;
      try { resultado = await excelMgr.importarProyectos(req.file.path); }
      finally { await fs.remove(req.file.path).catch(() => {}); }
      const { proyectos: importados, errores: erroresImp } = resultado;
      if (importados.length === 0 && erroresImp.length === 0) {
        return res.status(400).json({ ok: false, error: 'El archivo no contiene proyectos válidos.' });
      }
      let agregados = 0, actualizados = 0;
      const erroresGuardado = [];
      for (const p of importados) {
        try {
          const r = await proyectosMgr.upsertProyecto(RUTAS.PROYECTOS, p);
          if (r.ok) { if (r.accion === 'creado') agregados++; else actualizados++; }
          else erroresGuardado.push({ cui: p.cui, mensajes: r.errores });
        } catch (e) { erroresGuardado.push({ cui: p.cui, mensajes: [e.message] }); }
      }
      const final = await proyectosMgr.cargarProyectos(RUTAS.PROYECTOS);
      res.json({ ok: true, agregados, actualizados, total: importados.length, erroresImp, erroresGuardado, proyectos: final });
    } catch (e) {
      if (req.file) await fs.remove(req.file.path).catch(() => {});
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
};
