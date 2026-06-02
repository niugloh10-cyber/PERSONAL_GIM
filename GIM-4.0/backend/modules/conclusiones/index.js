/**
 * MÓDULO: CONCLUSIONES (CARTA DE CONCLUSIÓN DE FUNCIONES)
 * =======================================================
 *   POST /api/personal/carta-conclusion/:id
 */
'use strict';
const express = require('express');
const path    = require('path');
const fs      = require('fs-extra');
const personalMgr = require('../../lib/personalManager');
const cartaMgr    = require('../../lib/cartaManager');
const excelMgr    = require('../../lib/excelManager');
const legajoMgr   = require('../../lib/legajoManager');
const logger      = require('../../lib/logger');
const { RUTAS }   = require('../../lib/config');
const { obtenerRutaBD } = require('../../lib/dbPath');

const MOD = 'ModConclusiones';
const RUTA_PERSONAL = RUTAS.PERSONAL_BD;
const PLANTILLA_CARTA = path.join(RUTAS.PLANTILLAS_DIR, 'CARTA_CONCLUSION.docx');

module.exports = function (mw) {
  const router = express.Router();

  router.post('/api/personal/carta-conclusion/:id', mw.autenticar, async (req, res) => {
    try {
      const idContrato = req.params.id;
      const contratos  = await personalMgr.listarContratos(RUTA_PERSONAL);
      const contrato   = contratos.find(c => c.id === idContrato);
      if (!contrato) return res.status(404).json({ ok: false, error: 'Contrato no encontrado' });

      const rutaBD    = await obtenerRutaBD();
      const trabajador = await excelMgr.buscarTrabajadorPorDni(rutaBD, contrato.dni) || {};

      if (!(await fs.pathExists(PLANTILLA_CARTA))) {
        return res.status(404).json({ ok: false, error: 'Plantilla CARTA_CONCLUSION.docx no encontrada en /plantillas. Súbala primero.' });
      }

      const codigoQR  = cartaMgr.generarCodigoVerificacion(contrato);
      const contratoConCarta = { ...contrato, numeroCarta: req.body?.numeroCarta || contrato.numeroCarta || '' };
      const buffer = cartaMgr.generarCartaConclusionFunciones(PLANTILLA_CARTA, contratoConCarta, trabajador, codigoQR);
      const nombre = `CARTA-CONCLUSION-${contrato.apellidosNombres.replace(/\s+/g,'-').substring(0,30)}-${contrato.id}.docx`;

      logger.info(MOD, 'Carta de conclusión generada', { id: idContrato, codigoQR });

      if (req.body?.marcarConcluido) {
        await personalMgr.cambiarEstadoContrato(RUTA_PERSONAL, idContrato, 'CONCLUIDO', 'Carta generada');
      }

      // Registrar la conclusión de funciones en el Expediente Único.
      try {
        await legajoMgr.agregarActuacion(RUTAS.EXPEDIENTES_INDEX, RUTAS.EXPEDIENTES_DIR, contrato.dni, {
          tipo: 'CONCLUSION',
          titulo: 'Carta de Conclusión de Funciones',
          detalle: `${contrato.cargoNombre || ''} · ${contrato.proyecto || ''} · Verif.: ${codigoQR}`.trim(),
          referencia: `CONCLUSION:${contrato.id}`,
          fecha: new Date().toISOString(),
          origen: 'Conclusiones',
          usuario: req.usuario?.email,
          apellidosNombres: contrato.apellidosNombres,
        });
      } catch (eLeg) {
        logger.warn(MOD, 'No se pudo registrar conclusión en Expediente Único', { error: eLeg.message });
      }

      res.json({ ok: true, nombre, contenido: buffer.toString('base64'), codigoQR });
    } catch (e) {
      logger.error(MOD, 'Error generando carta', { error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
};
