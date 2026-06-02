/**
 * MÓDULO: SANCIONES DISCIPLINARIAS (v4.1)
 * =========================================
 *   GET    /api/sanciones                — listar con filtros
 *   POST   /api/sanciones                — crear
 *   PUT    /api/sanciones/:id            — actualizar
 *   PUT    /api/sanciones/:id/estado     — cambiar estado
 *   DELETE /api/sanciones/:id            — eliminar
 *   GET    /api/sanciones/trabajador/:dni — historial de un trabajador
 *   GET    /api/sanciones/tipos          — catálogo
 *   GET    /api/sanciones/estadisticas   — estadísticas globales
 */
'use strict';

const express      = require('express');
const sancionesMgr = require('../../lib/sancionesManager');
const legajoMgr    = require('../../lib/legajoManager');
const logger       = require('../../lib/logger');
const { RUTAS }    = require('../../lib/config');

const MOD = 'ModSanciones';

module.exports = function (mw) {
  const router = express.Router();
  const RUTA   = RUTAS.SANCIONES;

  // ── Catálogo de tipos ──────────────────────────────────────────
  router.get('/api/sanciones/tipos', mw.autenticar, (req, res) => {
    res.json({ ok: true, tipos: sancionesMgr.TIPOS, estados: sancionesMgr.ESTADOS });
  });

  // ── Estadísticas globales ──────────────────────────────────────
  router.get('/api/sanciones/estadisticas', mw.autenticar, async (req, res) => {
    try {
      const stats = await sancionesMgr.estadisticas(RUTA);
      res.json({ ok: true, ...stats });
    } catch (e) {
      logger.error(MOD, 'Error en estadísticas', { error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Historial de un trabajador ─────────────────────────────────
  router.get('/api/sanciones/trabajador/:dni', mw.autenticar, async (req, res) => {
    try {
      const resumen = await sancionesMgr.resumenDni(RUTA, req.params.dni);
      res.json({ ok: true, ...resumen });
    } catch (e) {
      logger.error(MOD, 'Error resumen DNI', { error: e.message });
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  // ── Listar sanciones ───────────────────────────────────────────
  router.get('/api/sanciones', mw.autenticar, async (req, res) => {
    try {
      const { dni, tipo, estado, desde, hasta } = req.query;
      const registros = await sancionesMgr.listar(RUTA, { dni, tipo, estado, desde, hasta });
      res.json({ ok: true, total: registros.length, registros });
    } catch (e) {
      logger.error(MOD, 'Error listando sanciones', { error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Crear sanción ──────────────────────────────────────────────
  router.post('/api/sanciones', mw.autenticar, mw.permiso('registros.editar'), async (req, res) => {
    try {
      const nueva = await sancionesMgr.crear(RUTA, req.body, req.usuario?.email);

      // Integración con legajo: registrar actuación
      try {
        await legajoMgr.agregarActuacion(
          RUTAS.EXPEDIENTES_INDEX,
          RUTAS.EXPEDIENTES_DIR,
          nueva.dni,
          {
            tipo: 'OTRO',
            titulo: `Sanción registrada: ${nueva.tipo}`,
            detalle: nueva.motivo,
            referencia: 'sancion:' + nueva.id,
            origen: 'sanciones',
            usuario: req.usuario?.email || ''
          }
        );
      } catch (legErr) {
        logger.warn(MOD, 'No se pudo registrar actuación en legajo', { error: legErr.message });
      }

      res.status(201).json({ ok: true, registro: nueva });
    } catch (e) {
      logger.error(MOD, 'Error creando sanción', { error: e.message });
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  // ── Cambiar estado ─────────────────────────────────────────────
  router.put('/api/sanciones/:id/estado', mw.autenticar, mw.permiso('registros.editar'), async (req, res) => {
    try {
      const { estado } = req.body || {};
      if (!estado) return res.status(400).json({ ok: false, error: 'estado es obligatorio' });
      const actualizado = await sancionesMgr.cambiarEstado(RUTA, req.params.id, estado, req.usuario?.email);
      res.json({ ok: true, registro: actualizado });
    } catch (e) {
      logger.error(MOD, 'Error cambiando estado', { error: e.message });
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  // ── Actualizar sanción ─────────────────────────────────────────
  router.put('/api/sanciones/:id', mw.autenticar, mw.permiso('registros.editar'), async (req, res) => {
    try {
      const actualizado = await sancionesMgr.actualizar(RUTA, req.params.id, req.body);
      res.json({ ok: true, registro: actualizado });
    } catch (e) {
      logger.error(MOD, 'Error actualizando sanción', { error: e.message });
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  // ── Eliminar sanción ───────────────────────────────────────────
  router.delete('/api/sanciones/:id', mw.autenticar, mw.permiso('registros.eliminar'), async (req, res) => {
    try {
      await sancionesMgr.eliminar(RUTA, req.params.id);
      logger.info(MOD, 'Sanción eliminada', { id: req.params.id });
      res.json({ ok: true, mensaje: 'Sanción eliminada' });
    } catch (e) {
      logger.error(MOD, 'Error eliminando sanción', { error: e.message });
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  return router;
};
