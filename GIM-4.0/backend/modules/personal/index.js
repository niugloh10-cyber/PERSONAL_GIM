/**
 * MÓDULO: RECURSOS HUMANOS - PERSONAL
 * ====================================
 * Contratos, alertas de vencimiento, historial laboral,
 * dashboard gerencial, fichas de trabajador e integración
 * con el módulo de Gestión Documental.
 */

'use strict';

const express = require('express');
const personalMgr = require('../../lib/personalManager');
const excelMgr    = require('../../lib/excelManager');
const legajoMgr   = require('../../lib/legajoManager');
const logger      = require('../../lib/logger');
const { RUTAS }   = require('../../lib/config');
const { obtenerRutaBD } = require('../../lib/dbPath');
const {
  buscarTrabajadorPorDni, registrarTrabajador, actualizarTrabajador, listarTrabajadores,
} = require('../../lib/excelManager');

const MOD = 'ModPersonal';
const RUTA_PERSONAL = RUTAS.PERSONAL_BD;

module.exports = function (mw) {
  const router = express.Router();

  // ── CONTRATOS ────────────────────────────────────────────────
  router.get('/api/personal/contratos', mw.autenticar, async (req, res) => {
    try {
      const { dni, estado, cui } = req.query;
      let contratos = await personalMgr.listarContratos(RUTA_PERSONAL);
      if (dni)    contratos = contratos.filter(c => c.dni === dni);
      if (estado) contratos = contratos.filter(c => c.estadoCalc === estado || c.estado === estado);
      if (cui)    contratos = contratos.filter(c => c.cui === cui);
      res.json({ ok: true, contratos });
    } catch (e) { logger.error(MOD, 'Error listando contratos', { error: e.message }); res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/api/personal/contratos', mw.autenticar, async (req, res) => {
    try {
      const datos = req.body;
      if (!datos.dni || !/^\d{8}$/.test(datos.dni)) return res.status(400).json({ ok: false, error: 'DNI inválido (8 dígitos)' });
      if (!datos.apellidosNombres) return res.status(400).json({ ok: false, error: 'Apellidos y Nombres requeridos' });
      if (!datos.fechaInicio)      return res.status(400).json({ ok: false, error: 'Fecha de inicio requerida' });
      if (!datos.proyecto)         return res.status(400).json({ ok: false, error: 'Proyecto requerido' });
      if (!datos.cargoCodigo)      return res.status(400).json({ ok: false, error: 'Cargo requerido' });
      const contrato = await personalMgr.registrarContrato(RUTA_PERSONAL, datos, req.usuario?.email);
      logger.info(MOD, 'Contrato registrado', { id: contrato.id, dni: datos.dni });

      // Integración con el Expediente Único (comunicación por DNI)
      try {
        await legajoMgr.vincularTrabajador(RUTAS.EXPEDIENTES_INDEX, RUTAS.EXPEDIENTES_DIR, {
          dni: datos.dni, apellidosNombres: datos.apellidosNombres,
          cargo: datos.cargoNombre || datos.cargo, cargoCodigo: datos.cargoCodigo,
        });
        await legajoMgr.agregarActuacion(RUTAS.EXPEDIENTES_INDEX, RUTAS.EXPEDIENTES_DIR, datos.dni, {
          tipo: 'CONTRATO',
          titulo: `Contrato — ${datos.cargoNombre || datos.cargo || ''}`.trim(),
          detalle: `CUI ${datos.cui || '—'} · ${datos.proyecto || ''}`.trim(),
          referencia: `CONTRATO:${String(datos.dni).replace(/\D/g,'')}:${contrato.id}`,
          fecha: datos.fechaInicio || new Date().toISOString(),
          origen: 'Personal', usuario: req.usuario?.email,
          apellidosNombres: datos.apellidosNombres,
        });
      } catch (eLeg) { logger.warn(MOD, 'No se pudo vincular contrato al Legajo', { error: eLeg.message }); }

      res.json({ ok: true, contrato });
    } catch (e) { logger.error(MOD, 'Error registrando contrato', { error: e.message }); res.status(500).json({ ok: false, error: e.message }); }
  });

  router.put('/api/personal/contratos/:id', mw.autenticar, async (req, res) => {
    try {
      const contrato = await personalMgr.actualizarContrato(RUTA_PERSONAL, req.params.id, req.body);
      res.json({ ok: true, contrato });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.put('/api/personal/contratos/:id/estado', mw.autenticar, async (req, res) => {
    try {
      const { estado, observacion } = req.body;
      const estadosValidos = ['ACTIVO', 'CONCLUIDO', 'RESCINDIDO', 'SUSPENDIDO'];
      if (!estadosValidos.includes(estado)) return res.status(400).json({ ok: false, error: `Estado inválido. Use: ${estadosValidos.join(', ')}` });
      const contrato = await personalMgr.cambiarEstadoContrato(RUTA_PERSONAL, req.params.id, estado, observacion);
      res.json({ ok: true, contrato });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── ALERTAS ──────────────────────────────────────────────────
  router.get('/api/personal/alertas', mw.autenticar, async (req, res) => {
    try {
      const dias = parseInt(req.query.dias) || 30;
      const alertas = await personalMgr.obtenerAlertasVencimiento(RUTA_PERSONAL, dias);
      res.json({ ok: true, alertas, total: alertas.length });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── HISTORIAL ────────────────────────────────────────────────
  router.get('/api/personal/historial/:dni', mw.autenticar, async (req, res) => {
    try {
      const dni = (req.params.dni || '').replace(/\D/g, '');
      if (!dni || dni.length !== 8) return res.status(400).json({ ok: false, error: 'DNI inválido' });
      const historial = await personalMgr.historialTrabajador(RUTA_PERSONAL, dni);
      const evaluaciones = await personalMgr.listarEvaluaciones(RUTA_PERSONAL, dni);
      const rutaBD = await obtenerRutaBD();
      const trabajador = await excelMgr.buscarTrabajadorPorDni(rutaBD, dni);
      res.json({
        ok: true,
        trabajador: trabajador || { dni },
        historial: {
          contratos:  historial.contratos,
          obras:      historial.obras,
          cargos:     historial.cargos,
          diasTotales:historial.diasTotales,
          mesesTotales: Math.floor(historial.diasTotales / 30),
          evaluaciones,
          promedioEvaluacion: evaluaciones.length
            ? (evaluaciones.reduce((s, e) => s + (parseFloat(e.puntaje) || 0), 0) / evaluaciones.length).toFixed(1)
            : null,
        },
      });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── DASHBOARD GERENCIAL ──────────────────────────────────────
  router.get('/api/personal/dashboard', mw.autenticar, async (req, res) => {
    try {
      const stats = await personalMgr.obtenerEstadisticas(RUTA_PERSONAL);
      res.json({ ok: true, ...stats });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/api/personal/exportar', mw.autenticar, async (req, res) => {
    try {
      await personalMgr.listarContratos(RUTA_PERSONAL);
      res.download(RUTA_PERSONAL, 'gestion_personal_gim.xlsx');
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── FICHAS DE TRABAJADOR ─────────────────────────────────────
  router.get('/api/trabajadores/buscar', async (req, res) => {
    try {
      const q = (req.query.q || '').toLowerCase().trim();
      if (!q || q.length < 2) return res.json({ ok: true, trabajadores: [] });
      const rutaBD = await obtenerRutaBD();
      const todos = await listarTrabajadores(rutaBD);
      const coincidencias = todos.filter(t =>
        (t.apellidosNombres || '').toLowerCase().includes(q) || (t.dni || '').includes(q)
      ).slice(0, 8);
      res.json({ ok: true, trabajadores: coincidencias });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/api/trabajadores/:dni', async (req, res) => {
    try {
      const dni = (req.params.dni || '').replace(/\D/g, '');
      if (!dni || dni.length !== 8) return res.status(400).json({ ok: false, error: 'DNI inválido. Debe tener 8 dígitos.' });
      const rutaBD = await obtenerRutaBD();
      const trabajador = await buscarTrabajadorPorDni(rutaBD, dni);
      if (!trabajador) return res.json({ ok: true, trabajador: null });
      const { _rowNumber, ...safe } = trabajador;
      res.json({ ok: true, trabajador: safe });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/api/trabajadores', async (req, res) => {
    try {
      const datos = req.body;
      const dni = (datos.dni || '').replace(/\D/g, '');
      if (!dni || dni.length !== 8) return res.status(400).json({ ok: false, error: 'DNI inválido' });
      if (!datos.apellidosNombres || datos.apellidosNombres.trim().length < 3) {
        return res.status(400).json({ ok: false, error: 'Apellidos y Nombres son obligatorios' });
      }
      datos.dni = dni;
      const ahora = new Date().toLocaleString('es-PE');
      const token = (req.headers.authorization || '').replace('Bearer ', '');
      let registradoPor = 'AUTOREGISTRO PÚBLICO';
      if (token) registradoPor = req.body._registradoPor || 'USUARIO AUTENTICADO';
      datos._registradoPor      = registradoPor;
      datos._fechaRegistro       = ahora;
      datos._ultimaActualizacion = ahora;
      const rutaBD = await obtenerRutaBD();
      const resultado = await registrarTrabajador(rutaBD, datos);
      try {
        await legajoMgr.vincularTrabajador(RUTAS.EXPEDIENTES_INDEX, RUTAS.EXPEDIENTES_DIR, {
          dni, apellidosNombres: datos.apellidosNombres, nombres: datos.nombres, apellidos: datos.apellidos,
          cip: datos.cip, estadoCivil: datos.estadoCivil, telefono1: datos.telefono1,
          telefono2: datos.telefono2, telefonoFijo: datos.telefonoFijo, correo: datos.correo,
          barrio: datos.barrio, distrito: datos.distrito, provincia: datos.provincia, departamento: datos.departamento,
        });
      } catch (_) {}
      if (req.rolBasico) return res.json({ ok: true, dni });
      res.json({ ok: true, trabajador: resultado });
    } catch (e) {
      const isDuplicate = e.message && e.message.includes('Ya existe');
      res.status(isDuplicate ? 409 : 500).json({ ok: false, error: e.message });
    }
  });

  router.put('/api/trabajadores/:dni', mw.autenticar, mw.permiso('registros.editar'), async (req, res) => {
    try {
      const dni = (req.params.dni || '').replace(/\D/g, '');
      if (!dni || dni.length !== 8) return res.status(400).json({ ok: false, error: 'DNI inválido' });
      const datos = req.body;
      datos._ultimaActualizacion = new Date().toLocaleString('es-PE');
      const rutaBD = await obtenerRutaBD();
      const resultado = await actualizarTrabajador(rutaBD, dni, datos);
      res.json({ ok: true, trabajador: resultado });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── INTEGRACIÓN PERSONAL ↔ DOCUMENTOS ────────────────────────
  router.get('/api/integracion/contrato-activo/:dni', mw.autenticar, async (req, res) => {
    try {
      const dni = (req.params.dni || '').replace(/\D/g, '');
      if (!dni || dni.length !== 8) return res.status(400).json({ ok: false, error: 'DNI inválido' });
      const contratos = await personalMgr.listarContratos(RUTA_PERSONAL);
      const delTrabajador = contratos
        .filter(c => c.dni === dni && ['ACTIVO','POR_VENCER','PROXIMO_VENCER'].includes(c.estadoCalc || c.estado))
        .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || ''));
      res.json({ ok: true, contrato: delTrabajador[0] || null, total: delTrabajador.length });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/api/integracion/resumen-trabajador/:dni', mw.autenticar, async (req, res) => {
    try {
      const dni = (req.params.dni || '').replace(/\D/g, '');
      if (!dni || dni.length !== 8) return res.status(400).json({ ok: false, error: 'DNI inválido' });
      const rutaBD = await obtenerRutaBD();
      const [trabajador, registros, contratos] = await Promise.all([
        excelMgr.buscarTrabajadorPorDni(rutaBD, dni).catch(() => null),
        excelMgr.leerRegistros(rutaBD).catch(() => []),
        personalMgr.listarContratos(RUTA_PERSONAL).catch(() => []),
      ]);
      const memosDni = registros.filter(r => r.dni === dni)
        .sort((a, b) => (b.numeroMemorandum || '').localeCompare(a.numeroMemorandum || '')).slice(0, 5);
      const contratosActivos = contratos
        .filter(c => c.dni === dni && ['ACTIVO','POR_VENCER','PROXIMO_VENCER'].includes(c.estadoCalc || c.estado))
        .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || ''));
      res.json({
        ok: true,
        trabajador: trabajador || null,
        contratoActivo: contratosActivos[0] || null,
        todosContratos: contratos.filter(c => c.dni === dni),
        ultimosMemos: memosDni,
      });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.put('/api/integracion/actualizar-contrato-memo', mw.autenticar, async (req, res) => {
    try {
      const { numeroMemorandum, ...campos } = req.body;
      if (!numeroMemorandum) return res.status(400).json({ ok: false, error: 'numeroMemorandum requerido' });
      const contratos = await personalMgr.listarContratos(RUTA_PERSONAL);
      const contrato  = contratos.find(c => c.numeroMemo === String(numeroMemorandum));
      if (!contrato) return res.json({ ok: true, sincronizado: false, mensaje: 'No hay contrato asociado a este memo' });
      const actualizados = {};
      ['proyecto','cui','cargoCodigo','cargoNombre','fechaInicio','fechaTermino','funciones','observaciones','numeroResolucion']
        .forEach(k => { if (campos[k]) actualizados[k] = campos[k]; });
      await personalMgr.actualizarContrato(RUTA_PERSONAL, contrato.id, actualizados);
      res.json({ ok: true, sincronizado: true, contratoId: contrato.id });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
