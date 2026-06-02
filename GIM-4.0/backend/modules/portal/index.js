/**
 * MÓDULO: PORTAL DEL TRABAJADOR (v4.1)
 * ======================================
 * Vista de solo-lectura autenticada por DNI + fecha de nacimiento.
 * No usa el sistema de sesiones principal — genera su propio token temporal.
 *
 *   POST /api/portal/login             — autenticar con {dni, fechaNacimiento}
 *   GET  /api/portal/mi-legajo         — expediente del trabajador autenticado
 *   GET  /api/portal/mis-contratos     — contratos del trabajador
 *   GET  /api/portal/mi-asistencia     — asistencia del mes
 *   GET  /api/portal/mis-capacitaciones — capacitaciones en las que participó
 *   GET  /api/portal/mis-vacaciones    — solicitudes de vacaciones
 *   POST /api/portal/logout            — cerrar sesión portal
 */
'use strict';

const express       = require('express');
const crypto        = require('crypto');
const fs            = require('fs-extra');
const path          = require('path');
const excelMgr      = require('../../lib/excelManager');
const personalMgr   = require('../../lib/personalManager');
const legajoMgr     = require('../../lib/legajoManager');
const asistenciaMgr = require('../../lib/asistenciaManager');
const capMgr        = require('../../lib/capacitacionesManager');
const vacMgr        = require('../../lib/vacacionesManager');
const logger        = require('../../lib/logger');
const { RUTAS }     = require('../../lib/config');

const MOD = 'ModPortal';

// ── Sesiones del portal (en memoria, TTL 8h) ─────────────────
const _sesionesPortal = new Map();
const PORTAL_TTL_MS   = 8 * 60 * 60 * 1000;

function _crearTokenPortal(dni) {
  const token = 'portal_' + crypto.randomBytes(24).toString('hex');
  _sesionesPortal.set(token, { dni, expiraEn: Date.now() + PORTAL_TTL_MS });
  return token;
}

function _validarTokenPortal(req, res) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) { res.status(401).json({ ok: false, error: 'No autenticado en el portal' }); return null; }
  const sesion = _sesionesPortal.get(token);
  if (!sesion || Date.now() > sesion.expiraEn) {
    _sesionesPortal.delete(token);
    res.status(401).json({ ok: false, error: 'Sesión del portal expirada' });
    return null;
  }
  return sesion.dni;
}

// Limpiar sesiones expiradas cada hora
setInterval(() => {
  const ahora = Date.now();
  for (const [t, s] of _sesionesPortal) {
    if (ahora > s.expiraEn) _sesionesPortal.delete(t);
  }
}, 60 * 60 * 1000).unref();

module.exports = function (mw) {
  const router = express.Router();

  // ── Login del portal ─────────────────────────────────────────
  router.post('/api/portal/login', async (req, res) => {
    try {
      const { dni, fechaNacimiento } = req.body;
      if (!dni || !/^\d{8}$/.test(dni)) return res.status(400).json({ ok: false, error: 'DNI inválido' });
      if (!fechaNacimiento) return res.status(400).json({ ok: false, error: 'Fecha de nacimiento requerida' });

      // Buscar trabajador en el Excel
      const rutaBD = RUTAS.BD_DEFAULT;
      const trabajadores = await excelMgr.leerTrabajadores(rutaBD).catch(() => []);
      const trabajador = trabajadores.find(t => String(t.dni || t.DNI || '').replace(/\D/g, '') === dni);

      if (!trabajador) return res.status(401).json({ ok: false, error: 'Trabajador no encontrado' });

      // Validar fecha de nacimiento (campo FECHA_NACIMIENTO o fechaNacimiento)
      const fnBD = String(trabajador.FECHA_NACIMIENTO || trabajador.fechaNacimiento || '').slice(0, 10);
      const fnReq = String(fechaNacimiento).slice(0, 10);
      if (!fnBD || fnBD !== fnReq) {
        return res.status(401).json({ ok: false, error: 'Datos incorrectos' });
      }

      const token = _crearTokenPortal(dni);
      logger.info(MOD, 'Login portal', { dni, ip: req.ip });
      res.json({ ok: true, token, dni, nombre: trabajador.NOMBRES || trabajador.nombres || '' });
    } catch (e) {
      logger.error(MOD, 'Error en login portal', { error: e.message });
      res.status(500).json({ ok: false, error: 'Error de autenticación' });
    }
  });

  router.post('/api/portal/logout', (req, res) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (token) _sesionesPortal.delete(token);
    res.json({ ok: true });
  });

  // ── Mi Legajo ─────────────────────────────────────────────────
  router.get('/api/portal/mi-legajo', async (req, res) => {
    try {
      const dni = _validarTokenPortal(req, res);
      if (!dni) return;
      const exp = await legajoMgr.obtenerPorDni(RUTAS.EXPEDIENTES_INDEX, dni);
      res.json({ ok: true, expediente: exp || null });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── Mis Contratos ─────────────────────────────────────────────
  router.get('/api/portal/mis-contratos', async (req, res) => {
    try {
      const dni = _validarTokenPortal(req, res);
      if (!dni) return;
      const todos = await personalMgr.listarContratos(RUTAS.PERSONAL_BD).catch(() => []);
      const contratos = todos.filter(c => String(c.dni || '').replace(/\D/g, '') === dni);
      // Ocultar campos sensibles de administración
      const seguros = contratos.map(({ id, dni: d, apellidosNombres, cargoNombre, proyecto,
        fechaInicio, fechaFin, estado, estadoCalc, modalidad }) =>
        ({ id, dni: d, apellidosNombres, cargoNombre, proyecto, fechaInicio, fechaFin, estado: estadoCalc || estado, modalidad })
      );
      res.json({ ok: true, contratos: seguros });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── Mi Asistencia ─────────────────────────────────────────────
  router.get('/api/portal/mi-asistencia', async (req, res) => {
    try {
      const dni = _validarTokenPortal(req, res);
      if (!dni) return;
      const anioMes = req.query.mes || new Date().toISOString().slice(0, 7);
      const resumen = await asistenciaMgr.resumenMensual(RUTAS.ASISTENCIA, dni, anioMes);
      res.json({ ok: true, ...resumen });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── Mis Capacitaciones ────────────────────────────────────────
  router.get('/api/portal/mis-capacitaciones', async (req, res) => {
    try {
      const dni = _validarTokenPortal(req, res);
      if (!dni) return;
      const resumen = await capMgr.resumenDni(RUTAS.CAPACITACIONES, dni);
      res.json({ ok: true, ...resumen });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── Mis Vacaciones ────────────────────────────────────────────
  router.get('/api/portal/mis-vacaciones', async (req, res) => {
    try {
      const dni = _validarTokenPortal(req, res);
      if (!dni) return;
      const registros = await vacMgr.listar(RUTAS.VACACIONES, { dni });
      res.json({ ok: true, registros });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
