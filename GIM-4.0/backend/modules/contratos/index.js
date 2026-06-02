/**
 * MÓDULO: CONTRATOS (v4.1)
 * ========================
 * Submódulo de contratos con rutas propias bajo /api/contratos.
 * Complementa al módulo Personal (que expone /api/personal/contratos).
 * Este módulo agrega:
 *   GET  /api/contratos/alertas      contratos próximos a vencer (≤ 30 días)
 *   GET  /api/contratos/estadisticas distribución por estado/cargo/proyecto
 *   GET  /api/contratos/exportar     exportación CSV de todos los contratos
 */
'use strict';

const express     = require('express');
const personalMgr = require('../../lib/personalManager');
const logger      = require('../../lib/logger');
const { RUTAS }   = require('../../lib/config');

const MOD = 'ModContratos';

module.exports = function (mw) {
  const router = express.Router();
  const RUTA   = RUTAS.PERSONAL_BD;

  // ── Alertas de vencimiento ────────────────────────────────────
  router.get('/api/contratos/alertas', mw.autenticar, mw.permiso('registros.ver'), async (req, res) => {
    try {
      const diasLimite = parseInt(req.query.dias) || 30;
      const contratos  = await personalMgr.listarContratos(RUTA);
      const hoy        = new Date();

      const alertas = contratos
        .filter(c => {
          if (!['ACTIVO', 'POR_VENCER', 'PROXIMO_VENCER'].includes(c.estadoCalc || c.estado)) return false;
          if (!c.fechaFin) return false;
          const fin  = new Date(c.fechaFin);
          const dias = Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24));
          c._diasRestantes = dias;
          return dias >= 0 && dias <= diasLimite;
        })
        .sort((a, b) => a._diasRestantes - b._diasRestantes);

      res.json({ ok: true, total: alertas.length, diasLimite, alertas });
    } catch (e) {
      logger.error(MOD, 'Error obteniendo alertas', { error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Estadísticas de contratos ─────────────────────────────────
  router.get('/api/contratos/estadisticas', mw.autenticar, mw.permiso('registros.ver'), async (req, res) => {
    try {
      const contratos = await personalMgr.listarContratos(RUTA);

      const porEstado   = {};
      const porCargo    = {};
      const porProyecto = {};
      const hoy         = new Date();
      let vencenEn7 = 0, vencenEn30 = 0;

      contratos.forEach(c => {
        const estado = c.estadoCalc || c.estado || 'DESCONOCIDO';
        const cargo  = c.cargoNombre || c.cargoCodigo || 'SIN CARGO';
        const proy   = c.proyecto || 'SIN PROYECTO';
        porEstado[estado]    = (porEstado[estado] || 0) + 1;
        porCargo[cargo]      = (porCargo[cargo] || 0) + 1;
        porProyecto[proy]    = (porProyecto[proy] || 0) + 1;

        if (c.fechaFin && ['ACTIVO', 'POR_VENCER', 'PROXIMO_VENCER'].includes(estado)) {
          const dias = Math.ceil((new Date(c.fechaFin) - hoy) / 86400000);
          if (dias >= 0 && dias <= 7)  vencenEn7++;
          if (dias >= 0 && dias <= 30) vencenEn30++;
        }
      });

      res.json({
        ok: true,
        total: contratos.length,
        vencenEn7,
        vencenEn30,
        porEstado:   Object.entries(porEstado).map(([k, v]) => ({ etiqueta: k, valor: v })).sort((a, b) => b.valor - a.valor),
        porCargo:    Object.entries(porCargo).map(([k, v]) => ({ etiqueta: k, valor: v })).sort((a, b) => b.valor - a.valor),
        porProyecto: Object.entries(porProyecto).map(([k, v]) => ({ etiqueta: k, valor: v })).sort((a, b) => b.valor - a.valor),
      });
    } catch (e) {
      logger.error(MOD, 'Error en estadísticas', { error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Exportar contratos a CSV ──────────────────────────────────
  router.get('/api/contratos/exportar', mw.autenticar, mw.permiso('registros.exportar'), async (req, res) => {
    try {
      const contratos = await personalMgr.listarContratos(RUTA);

      const escaparCSV = v => {
        const s = String(v ?? '').replace(/"/g, '""');
        return /[,"\n\r]/.test(s) ? `"${s}"` : s;
      };

      const cabecera = ['DNI','Apellidos y Nombres','Cargo','Proyecto','Fecha Inicio','Fecha Fin','Estado','Días Restantes'];
      const hoy = new Date();
      const filas = contratos.map(c => {
        const dias = c.fechaFin ? Math.ceil((new Date(c.fechaFin) - hoy) / 86400000) : '';
        return [
          c.dni, c.apellidosNombres, c.cargoNombre || c.cargoCodigo,
          c.proyecto, c.fechaInicio, c.fechaFin,
          c.estadoCalc || c.estado, dias,
        ].map(escaparCSV).join(',');
      });

      const csv = [cabecera.join(','), ...filas].join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="contratos_${new Date().toISOString().slice(0,10)}.csv"`);
      res.send('﻿' + csv); // BOM para Excel
    } catch (e) {
      logger.error(MOD, 'Error exportando contratos', { error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
};
