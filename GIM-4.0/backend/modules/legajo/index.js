/**
 * MÓDULO: LEGAJO DIGITAL / EXPEDIENTE ÚNICO (NUEVO v4.0)
 * ======================================================
 * Cada trabajador tiene un Expediente Único: GIM-RH-AAAA-NNNNNN
 *   GET    /api/legajo                       lista expedientes (?q=)
 *   GET    /api/legajo/categorias            catálogo de categorías de documento
 *   GET    /api/legajo/:codigo               detalle de un expediente
 *   POST   /api/legajo                       abrir expediente { dni, apellidosNombres, cargo }
 *   POST   /api/legajo/:dni/documento        subir documento (multipart: archivo, categoria, descripcion)
 *   GET    /api/legajo/:codigo/documento/:docId  descargar documento
 *   DELETE /api/legajo/:codigo/documento/:docId  eliminar documento
 */
'use strict';
const express = require('express');
const path    = require('path');
const fs      = require('fs-extra');
const legajoMgr = require('../../lib/legajoManager');
const excelMgr  = require('../../lib/excelManager');
const personalMgr = require('../../lib/personalManager');
const logger    = require('../../lib/logger');
const { RUTAS } = require('../../lib/config');
const { obtenerRutaBD } = require('../../lib/dbPath');

/** Elimina caracteres peligrosos del nombre de archivo antes de enviarlo al cliente. */
function sanitizarNombreArchivo(nombre) {
  return path.basename(String(nombre || 'documento'))
    .replace(/[^\w.\-áéíóúÁÉÍÓÚñÑüÜ ]/g, '_')
    .replace(/\.{2,}/g, '.')
    .substring(0, 200) || 'documento';
}

module.exports = function (mw, uploadMiddleware) {
  const router = express.Router();
  const IDX = RUTAS.EXPEDIENTES_INDEX;
  const DIR = RUTAS.EXPEDIENTES_DIR;

  router.get('/api/legajo/categorias', mw.autenticar, (req, res) => {
    res.json({ ok: true, categorias: legajoMgr.CATEGORIAS });
  });

  // Sincroniza/crea el Legajo de TODO el personal existente (por DNI).
  router.post('/api/legajo/sincronizar', mw.autenticar, mw.permiso('legajo.editar'), async (req, res) => {
    try {
      const legajoSync = require('../../lib/legajoSync');
      const resumen = await legajoSync.sincronizarTodo();
      res.json({ ok: true, resumen });
    } catch (e) {
      logger.error('ModLegajo', 'Error en sincronización masiva', { error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Obtener expediente directamente por DNI (clave de comunicación del sistema).
  router.get('/api/legajo/dni/:dni', mw.autenticar, mw.permiso('legajo.ver'), async (req, res) => {
    try {
      const dni = (req.params.dni || '').replace(/\D/g, '');
      if (!/^\d{8}$/.test(dni)) return res.status(400).json({ ok: false, error: 'DNI inválido' });
      const exp = await legajoMgr.obtenerPorDni(IDX, dni);
      if (!exp) return res.status(404).json({ ok: false, error: 'Sin expediente', dni });
      res.json({ ok: true, expediente: exp });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/api/legajo', mw.autenticar, mw.permiso('legajo.ver'), async (req, res) => {
    try {
      const expedientes = await legajoMgr.listar(IDX, { q: req.query.q, dni: req.query.dni });
      res.json({ ok: true, expedientes });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/api/legajo/:codigo/trayectoria', mw.autenticar, mw.permiso('legajo.ver'), async (req, res) => {
    try {
      const r = await legajoMgr.obtenerTrayectoria(IDX, req.params.codigo);
      if (!r) return res.status(404).json({ ok: false, error: 'Expediente no encontrado' });
      res.json({ ok: true, expediente: r.expediente, timeline: r.timeline });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/api/legajo/:codigo', mw.autenticar, mw.permiso('legajo.ver'), async (req, res) => {
    try {
      const exp = await legajoMgr.obtenerPorCodigo(IDX, req.params.codigo);
      if (!exp) return res.status(404).json({ ok: false, error: 'Expediente no encontrado' });
      res.json({ ok: true, expediente: exp });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/api/legajo', mw.autenticar, mw.permiso('legajo.cargar'), async (req, res) => {
    try {
      // vincularTrabajador abre el expediente si no existe y consolida los
      // datos canónicos (incluye orden Nombres y Apellidos).
      const exp = await legajoMgr.vincularTrabajador(IDX, DIR, req.body);
      res.json({ ok: true, expediente: exp });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.post('/api/legajo/:dni/documento', mw.autenticar, mw.permiso('legajo.cargar'),
    uploadMiddleware.single('archivo'),
    mw.validarArchivo('.pdf', '.docx', '.xlsx', '.jpg', '.jpeg', '.png'),
    async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ ok: false, error: 'No se subió archivo' });
      const dni = (req.params.dni || '').replace(/\D/g, '');
      if (!dni || dni.length !== 8) {
        await fs.remove(req.file.path).catch(() => {});
        return res.status(400).json({ ok: false, error: 'DNI inválido' });
      }
      const r = await legajoMgr.agregarDocumento(IDX, DIR, dni, {
        categoria:      req.body.categoria,
        nombreOriginal: sanitizarNombreArchivo(req.file.originalname),
        descripcion:    req.body.descripcion,
        apellidosNombres: req.body.apellidosNombres,
      }, req.file.path, req.usuario?.email);
      // El rol básico (solo escritura) no recibe datos del expediente.
      if (req.usuario?.rol === 'usuario') {
        return res.json({ ok: true, codigo: r.expediente.codigo, documento: { id: r.documento.id, nombreOriginal: r.documento.nombreOriginal, categoria: r.documento.categoria } });
      }
      res.json({ ok: true, ...r });
    } catch (e) {
      if (req.file) await fs.remove(req.file.path).catch(() => {});
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.get('/api/legajo/:codigo/documento/:docId', mw.autenticar, async (req, res) => {
    try {
      const info = await legajoMgr.rutaDocumento(IDX, DIR, req.params.codigo, req.params.docId);
      if (!info || !(await fs.pathExists(info.ruta))) return res.status(404).json({ ok: false, error: 'Documento no encontrado' });
      res.download(info.ruta, sanitizarNombreArchivo(info.doc.nombreOriginal));
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.delete('/api/legajo/:codigo/documento/:docId', mw.autenticar, mw.permiso('legajo.editar'), async (req, res) => {
    try {
      const r = await legajoMgr.eliminarDocumento(IDX, DIR, req.params.codigo, req.params.docId);
      res.json(r);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
