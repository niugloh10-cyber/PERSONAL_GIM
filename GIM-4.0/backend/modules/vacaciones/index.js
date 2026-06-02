/**
 * MÓDULO: VACACIONES Y LICENCIAS (v4.1)
 * ======================================
 *   GET  /api/vacaciones                  — listar con filtros
 *   POST /api/vacaciones                  — crear solicitud
 *   PUT  /api/vacaciones/:id/aprobar      — aprobar
 *   PUT  /api/vacaciones/:id/rechazar     — rechazar (body: {motivo})
 *   PUT  /api/vacaciones/:id/anular       — anular
 *   GET  /api/vacaciones/resumen/:dni     — resumen de días por tipo
 *   GET  /api/vacaciones/tipos            — catálogo de tipos
 *   GET  /api/vacaciones/estadisticas     — estadísticas globales
 */
'use strict';

const express      = require('express');
const vacMgr       = require('../../lib/vacacionesManager');
const legajoMgr    = require('../../lib/legajoManager');
const logger       = require('../../lib/logger');
const { RUTAS }    = require('../../lib/config');

const MOD = 'ModVacaciones';

module.exports = function (mw) {
  const router = express.Router();
  const RUTA   = RUTAS.VACACIONES;

  // ── Catálogo de tipos ─────────────────────────────────────────
  router.get('/api/vacaciones/tipos', mw.autenticar, (req, res) => {
    res.json({ ok: true, tipos: vacMgr.TIPOS });
  });

  // ── Estadísticas globales ─────────────────────────────────────
  router.get('/api/vacaciones/estadisticas', mw.autenticar, async (req, res) => {
    try {
      const stats = await vacMgr.estadisticas(RUTA);
      res.json({ ok: true, ...stats });
    } catch (e) {
      logger.error(MOD, 'Error en estadísticas', { error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Resumen por DNI ───────────────────────────────────────────
  router.get('/api/vacaciones/resumen/:dni', mw.autenticar, async (req, res) => {
    try {
      const dni = (req.params.dni || '').replace(/\D/g, '');
      if (!dni || dni.length !== 8)
        return res.status(400).json({ ok: false, error: 'DNI inválido (8 dígitos)' });
      const resumen = await vacMgr.resumenDni(RUTA, dni);
      res.json({ ok: true, ...resumen });
    } catch (e) {
      logger.error(MOD, 'Error resumen DNI', { error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Listar solicitudes ────────────────────────────────────────
  router.get('/api/vacaciones', mw.autenticar, async (req, res) => {
    try {
      const { dni, tipo, estado, desde, hasta } = req.query;
      const registros = await vacMgr.listar(RUTA, { dni, tipo, estado, desde, hasta });
      res.json({ ok: true, total: registros.length, registros });
    } catch (e) {
      logger.error(MOD, 'Error listando', { error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Crear solicitud ───────────────────────────────────────────
  router.post('/api/vacaciones', mw.autenticar, async (req, res) => {
    try {
      const nuevo = await vacMgr.crear(RUTA, req.body, req.usuario?.email);
      res.status(201).json({ ok: true, registro: nuevo });
    } catch (e) {
      logger.error(MOD, 'Error creando solicitud', { error: e.message });
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  // ── Aprobar ───────────────────────────────────────────────────
  router.put('/api/vacaciones/:id/aprobar', mw.autenticar, mw.permiso('registros.editar'), async (req, res) => {
    try {
      const aprobado = await vacMgr.aprobar(RUTA, req.params.id, req.usuario?.email);

      // Integración con legajo: registrar actuación
      try {
        await legajoMgr.agregarActuacion(
          RUTAS.EXPEDIENTES_INDEX,
          RUTAS.EXPEDIENTES_DIR,
          aprobado.dni,
          {
            tipo: 'OTRO',
            titulo: `${aprobado.tipo} aprobada`,
            detalle: `Del ${aprobado.fechaInicio} al ${aprobado.fechaFin} (${aprobado.diasSolicitados} días)`,
            referencia: 'vacacion:' + aprobado.id,
            origen: 'vacaciones',
            usuario: req.usuario?.email || ''
          }
        );
      } catch (legErr) {
        logger.warn(MOD, 'No se pudo registrar actuación en legajo', { error: legErr.message });
      }

      res.json({ ok: true, registro: aprobado });
    } catch (e) {
      logger.error(MOD, 'Error aprobando', { error: e.message });
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  // ── Rechazar ──────────────────────────────────────────────────
  router.put('/api/vacaciones/:id/rechazar', mw.autenticar, mw.permiso('registros.editar'), async (req, res) => {
    try {
      const { motivo } = req.body || {};
      const rechazado = await vacMgr.rechazar(RUTA, req.params.id, motivo, req.usuario?.email);
      res.json({ ok: true, registro: rechazado });
    } catch (e) {
      logger.error(MOD, 'Error rechazando', { error: e.message });
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  // ── Anular ────────────────────────────────────────────────────
  router.put('/api/vacaciones/:id/anular', mw.autenticar, async (req, res) => {
    try {
      // Verificar: solo el propio o con permiso registros.editar
      const lista = await vacMgr.listar(RUTA, { /* sin filtros */ });
      const reg   = lista.find(r => r.id === req.params.id);
      if (!reg) return res.status(404).json({ ok: false, error: 'Solicitud no encontrada' });

      const esPropietario = reg.creadoPor === req.usuario?.email ||
                            reg.dni       === req.usuario?.dni;
      const tienePermiso  = req.usuario?.permisos?.includes('registros.editar') ||
                            req.usuario?.rol === 'admin' ||
                            req.usuario?.rol === 'super_admin';

      if (!esPropietario && !tienePermiso)
        return res.status(403).json({ ok: false, error: 'Sin permiso para anular esta solicitud' });

      const anulado = await vacMgr.anular(RUTA, req.params.id, req.usuario?.email);
      res.json({ ok: true, registro: anulado });
    } catch (e) {
      logger.error(MOD, 'Error anulando', { error: e.message });
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  return router;
};
