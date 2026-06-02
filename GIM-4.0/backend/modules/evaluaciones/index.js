/**
 * MÓDULO: EVALUACIONES DE DESEMPEÑO
 * ==================================
 *   GET  /api/personal/evaluaciones
 *   POST /api/personal/evaluaciones
 */
'use strict';
const express = require('express');
const personalMgr = require('../../lib/personalManager');
const legajoMgr   = require('../../lib/legajoManager');
const logger      = require('../../lib/logger');
const { RUTAS } = require('../../lib/config');
const RUTA_PERSONAL = RUTAS.PERSONAL_BD;

module.exports = function (mw) {
  const router = express.Router();

  router.get('/api/personal/evaluaciones', mw.autenticar, async (req, res) => {
    try {
      const dni = req.query.dni || null;
      const evaluaciones = await personalMgr.listarEvaluaciones(RUTA_PERSONAL, dni);
      res.json({ ok: true, evaluaciones });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/api/personal/evaluaciones', mw.autenticar, async (req, res) => {
    try {
      const datos = req.body;
      if (!datos.dni || !/^\d{8}$/.test(datos.dni)) return res.status(400).json({ ok: false, error: 'DNI inválido' });
      const puntaje = parseFloat(datos.puntaje);
      if (isNaN(puntaje) || puntaje < 0 || puntaje > 100) return res.status(400).json({ ok: false, error: 'Puntaje debe ser 0–100' });
      const ev = await personalMgr.registrarEvaluacion(RUTA_PERSONAL, datos, req.usuario?.email);

      try {
        await legajoMgr.agregarActuacion(RUTAS.EXPEDIENTES_INDEX, RUTAS.EXPEDIENTES_DIR, datos.dni, {
          tipo: 'EVALUACION',
          titulo: `Evaluación de desempeño${datos.periodo ? ' — ' + datos.periodo : ''}`,
          detalle: `Puntaje: ${datos.puntaje}${datos.calificacion ? ' · ' + datos.calificacion : ''}${datos.comentarios ? ' · ' + datos.comentarios : ''}`,
          referencia: ev?.id ? `EVAL:${ev.id}` : null,
          fecha: ev?.fecha || new Date().toISOString(),
          origen: 'Evaluaciones',
          usuario: req.usuario?.email,
          apellidosNombres: datos.apellidosNombres,
        });
      } catch (eLeg) {
        logger.warn('ModEvaluaciones', 'No se pudo registrar evaluación en Expediente Único', { error: eLeg.message });
      }

      res.json({ ok: true, evaluacion: ev });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
