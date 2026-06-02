/**
 * MÓDULO: GESTIÓN DOCUMENTAL
 * ===========================
 * Generación de Memorandos y Declaraciones Juradas, vista previa,
 * plantillas y el historial de Registros.
 *
 * Rutas:
 *   POST   /api/generar
 *   POST   /api/preview
 *   GET    /api/plantillas
 *   POST   /api/plantillas
 *   DELETE /api/plantillas/:nombre
 *   GET    /api/registros
 *   DELETE /api/registros/:rowNumber
 *   GET    /api/registros/exportar
 *   POST   /api/registros/importar
 */

'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs-extra');

const docGen      = require('../../lib/docGenerator');
const excelMgr    = require('../../lib/excelManager');
const cargosMgr   = require('../../lib/cargosManager');
const configMgr   = require('../../lib/configManager');
const personalMgr = require('../../lib/personalManager');
const legajoMgr   = require('../../lib/legajoManager');
const logger      = require('../../lib/logger');
const { validarDatosGenerar, sanitizarParaRuta } = require('../../lib/validator');
const { RUTAS }   = require('../../lib/config');
const { obtenerRutaBD } = require('../../lib/dbPath');

const MOD = 'ModDocumentos';

module.exports = function (mw, uploadMiddleware) {
  const router = express.Router();

  // ── PLANTILLAS ───────────────────────────────────────────────
  router.get('/api/plantillas', mw.autenticar, async (req, res) => {
    try {
      const archivos = await fs.readdir(RUTAS.PLANTILLAS_DIR);
      const plantillas = archivos.filter(a => a.endsWith('.docx')).map(a => ({ nombre: a }));
      res.json({ ok: true, plantillas });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/api/plantillas', mw.autenticar, uploadMiddleware.single('plantilla'), mw.validarArchivo('.docx'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ ok: false, error: 'No se subió archivo' });
      const nombreOriginal = req.file.originalname || 'plantilla.docx';
      if (!nombreOriginal.endsWith('.docx')) {
        await fs.remove(req.file.path).catch(() => {});
        return res.status(400).json({ ok: false, error: 'Solo se permiten archivos .docx' });
      }
      const nombreFinal = req.body.nombre || nombreOriginal;
      const destino = path.join(RUTAS.PLANTILLAS_DIR, path.basename(nombreFinal));
      await fs.move(req.file.path, destino, { overwrite: true });
      res.json({ ok: true, nombre: path.basename(nombreFinal) });
    } catch (e) {
      if (req.file) await fs.remove(req.file.path).catch(() => {});
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.delete('/api/plantillas/:nombre', mw.autenticar, async (req, res) => {
    try {
      const nombre = path.basename(req.params.nombre);
      const ruta = path.join(RUTAS.PLANTILLAS_DIR, nombre);
      if (await fs.pathExists(ruta)) await fs.remove(ruta);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── REGISTROS ────────────────────────────────────────────────
  router.get('/api/registros', mw.autenticar, mw.permiso('registros.ver'), async (req, res) => {
    try {
      const rutaBD = await obtenerRutaBD();
      const registros = await excelMgr.leerRegistros(rutaBD);
      res.json({ ok: true, registros });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.delete('/api/registros/:rowNumber', mw.autenticar, mw.permiso('registros.eliminar'), async (req, res) => {
    try {
      const rowNum = parseInt(req.params.rowNumber, 10);
      if (isNaN(rowNum)) return res.status(400).json({ ok: false, error: 'Número de fila inválido' });
      const rutaBD = await obtenerRutaBD();
      await excelMgr.eliminarRegistro(rutaBD, rowNum);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/api/registros/exportar', mw.autenticar, mw.permiso('registros.exportar'), async (req, res) => {
    try {
      const rutaBD = await obtenerRutaBD();
      await excelMgr.asegurarBaseDeDatos(rutaBD);
      res.download(rutaBD, 'base_de_datos_gim.xlsx');
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/api/registros/importar', mw.autenticar, mw.permiso('registros.editar'),
    uploadMiddleware.single('archivo'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió archivo' });
      const { registros: leidos, errores: erroresLectura } = await excelMgr.importarHistorialExcel(req.file.path);
      await fs.remove(req.file.path).catch(() => {});
      if (leidos.length === 0) {
        return res.status(400).json({ ok: false, error: 'No se encontraron registros válidos.', errores: erroresLectura });
      }
      const rutaBD = await obtenerRutaBD();
      const existentes = await excelMgr.leerRegistros(rutaBD);
      const claves = new Set(existentes.map(r => `${r.dni}_${String(r.numeroMemorandum).trim()}`));
      let importados = 0, duplicados = 0;
      const erroresGuardado = [];
      for (const reg of leidos) {
        const clave = `${reg.dni}_${String(reg.numeroMemorandum || '').trim()}`;
        if (claves.has(clave)) { duplicados++; continue; }
        try {
          const { _rowNumber, ...limpio } = reg;
          await excelMgr.guardarRegistro(rutaBD, limpio);
          claves.add(clave); importados++;
        } catch (e) { erroresGuardado.push({ dni: reg.dni, mensaje: e.message }); }
      }
      const actualizados = await excelMgr.leerRegistros(rutaBD);
      res.json({ ok: true, importados, duplicados, totalLeidos: leidos.length, errores: [...erroresLectura, ...erroresGuardado], registros: actualizados });
    } catch (e) {
      if (req.file) await fs.remove(req.file.path).catch(() => {});
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── GENERAR DOCUMENTOS ───────────────────────────────────────
  router.post('/api/generar', mw.autenticar, mw.permiso('generar.crear'), async (req, res) => {
    try {
      const datos = req.body;
      const errores = validarDatosGenerar(datos);
      if (errores.length > 0) return res.status(400).json({ ok: false, errores });

      const cargos = await cargosMgr.cargarCargos(RUTAS.CARGOS);
      const cargo = cargos.find(c => c.codigo === datos.cargoCodigo);
      if (!cargo) return res.status(400).json({ ok: false, error: 'Cargo no encontrado' });

      const plantillaMemo = path.join(RUTAS.PLANTILLAS_DIR, cargo.plantilla || `${cargo.codigo}.docx`);
      if (!(await fs.pathExists(plantillaMemo))) {
        return res.status(400).json({ ok: false, error: `Plantilla no encontrada: ${path.basename(plantillaMemo)}` });
      }

      const rutaBD = await obtenerRutaBD();

      if (!datos.permitirDuplicado) {
        const existe = await excelMgr.existeMemorandum(rutaBD, datos.numeroMemorandum);
        if (existe) {
          return res.status(409).json({ ok: false, error: `Ya existe memorándum N° ${datos.numeroMemorandum}`, requiereConfirmacion: true });
        }
      }

      const registroCompleto = {
        ...datos,
        cargoNombre: cargo.nombre,
        creadoPor: req.usuario.email,
        fechaCreacion: new Date().toISOString(),
      };

      const dataMemo = docGen.construirDataMemo(registroCompleto);
      const bufferMemo = docGen.generarDocumento(plantillaMemo, dataMemo);

      let bufferDJ = null;
      const plantillaDJ = path.join(RUTAS.PLANTILLAS_DIR, 'DJ.docx');
      if (await fs.pathExists(plantillaDJ)) {
        bufferDJ = docGen.generarDocumento(plantillaDJ, docGen.construirDataDJ(registroCompleto));
      }

      const apellidosLimpio = sanitizarParaRuta(datos.apellidosNombres).substring(0, 40);
      const cargoLimpio     = sanitizarParaRuta(cargo.nombre).substring(0, 30);
      const nombreMemo = `MEMO-${datos.numeroMemorandum}-${apellidosLimpio}-${cargoLimpio}.docx`;
      const nombreDJ   = `DJ-${apellidosLimpio}-DNI${datos.dni}.docx`;

      const config = await configMgr.cargarConfig(RUTAS.CONFIG);
      let rutaGuardada = '';
      if (config.carpetaSalida && config.carpetaSalida.trim()) {
        try {
          await fs.ensureDir(config.carpetaSalida);
          rutaGuardada = path.join(config.carpetaSalida, nombreMemo);
          await fs.writeFile(rutaGuardada, bufferMemo);
        } catch (e) {
          logger.warn(MOD, 'Error guardando en carpeta de salida', { error: e.message });
          rutaGuardada = '';
        }
      }

      registroCompleto.archivoMemo = rutaGuardada;
      await excelMgr.guardarRegistro(rutaBD, registroCompleto);

      // Sincronización automática con ficha de trabajador
      try {
        const camposTrab = ['dni','cip','apellidosNombres','estadoCivil','telefono1',
          'telefono2','telefonoFijo','correo','barrio','distrito','provincia','departamento'];
        const datosTrab = {};
        camposTrab.forEach(k => { if (registroCompleto[k]) datosTrab[k] = registroCompleto[k]; });
        datosTrab._registradoPor       = req.usuario.email;
        datosTrab._ultimaActualizacion = new Date().toLocaleString('es-PE');
        const existe = await excelMgr.buscarTrabajadorPorDni(rutaBD, registroCompleto.dni);
        if (existe) {
          await excelMgr.actualizarTrabajador(rutaBD, registroCompleto.dni, datosTrab);
        } else {
          datosTrab._fechaRegistro = new Date().toLocaleString('es-PE');
          await excelMgr.registrarTrabajador(rutaBD, datosTrab);
        }
      } catch (eTrab) {
        logger.warn(MOD, 'No se pudo sincronizar ficha trabajador', { error: eTrab.message });
      }

      // Contrato automático en Personal
      try {
        const contratos = await personalMgr.listarContratos(RUTAS.PERSONAL_BD);
        const yaExiste  = contratos.some(c => c.numeroMemo === String(registroCompleto.numeroMemorandum));
        if (!yaExiste) {
          await personalMgr.registrarContrato(RUTAS.PERSONAL_BD, {
            dni:              registroCompleto.dni,
            apellidosNombres: registroCompleto.apellidosNombres,
            cargoCodigo:      registroCompleto.cargoCodigo,
            cargoNombre:      cargo.nombre,
            cui:              registroCompleto.cui,
            proyecto:         registroCompleto.proyecto,
            componente:       registroCompleto.componente || '',
            fechaInicio:      registroCompleto.fechaInicio || registroCompleto.fechaMemorandum,
            fechaTermino:     registroCompleto.fechaTermino || '',
            estado:           'ACTIVO',
            numeroMemo:       registroCompleto.numeroMemorandum,
            numeroResolucion: registroCompleto.numeroResolucion || registroCompleto.resolucionProyecto || '',
            monto:            cargo.monto ? String(cargo.monto) : '',
            funciones:        registroCompleto.funciones || '',
            observaciones:    registroCompleto.observaciones || '',
          }, req.usuario.email);
        }
      } catch (ePers) {
        logger.warn(MOD, 'No se pudo crear contrato en Personal', { error: ePers.message });
      }

      // ── Expediente Único Digital (Legajo) — repositorio central ──
      // Consolida datos canónicos y registra el memorando y el contrato
      // en la trayectoria del trabajador, sin duplicar bases de datos.
      try {
        await legajoMgr.vincularTrabajador(RUTAS.EXPEDIENTES_INDEX, RUTAS.EXPEDIENTES_DIR, {
          dni:              registroCompleto.dni,
          apellidosNombres: registroCompleto.apellidosNombres,
          cargo:            cargo.nombre,
          cargoCodigo:      registroCompleto.cargoCodigo,
          cip:              registroCompleto.cip,
          estadoCivil:      registroCompleto.estadoCivil,
          telefono1:        registroCompleto.telefono1,
          telefono2:        registroCompleto.telefono2,
          telefonoFijo:     registroCompleto.telefonoFijo,
          correo:           registroCompleto.correo,
          barrio:           registroCompleto.barrio,
          distrito:         registroCompleto.distrito,
          provincia:        registroCompleto.provincia,
          departamento:     registroCompleto.departamento,
        });

        await legajoMgr.agregarActuacion(RUTAS.EXPEDIENTES_INDEX, RUTAS.EXPEDIENTES_DIR, registroCompleto.dni, {
          tipo: 'MEMORANDO',
          titulo: `Memorándum N° ${registroCompleto.numeroMemorandum}`,
          detalle: `${cargo.nombre} — ${registroCompleto.proyecto || ''}`.trim(),
          referencia: `MEMO:${registroCompleto.dni}:${registroCompleto.numeroMemorandum}`,
          fecha: registroCompleto.fechaMemorandum || new Date().toISOString(),
          origen: 'Gestión Documental',
          usuario: req.usuario.email,
          apellidosNombres: registroCompleto.apellidosNombres,
        });

        await legajoMgr.agregarActuacion(RUTAS.EXPEDIENTES_INDEX, RUTAS.EXPEDIENTES_DIR, registroCompleto.dni, {
          tipo: 'CONTRATO',
          titulo: `Contrato — ${cargo.nombre}`,
          detalle: `CUI ${registroCompleto.cui || '—'} · ${registroCompleto.proyecto || ''}`.trim(),
          referencia: `CONTRATO:${registroCompleto.dni}:${registroCompleto.numeroMemorandum}`,
          fecha: registroCompleto.fechaInicio || registroCompleto.fechaMemorandum || new Date().toISOString(),
          origen: 'Personal',
          usuario: req.usuario.email,
          apellidosNombres: registroCompleto.apellidosNombres,
        });
      } catch (eLeg) {
        logger.warn(MOD, 'No se pudo sincronizar con Expediente Único', { error: eLeg.message });
      }

      logger.info(MOD, 'Documento generado', { memo: nombreMemo, usuario: req.usuario.email });

      res.json({
        ok: true,
        memo: { nombre: nombreMemo, contenido: bufferMemo.toString('base64'), rutaGuardada },
        dj: bufferDJ ? { nombre: nombreDJ, contenido: bufferDJ.toString('base64') } : null,
      });
    } catch (e) {
      logger.error(MOD, 'Error generando documento', { error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── VISTA PREVIA ─────────────────────────────────────────────
  router.post('/api/preview', mw.autenticar, mw.permiso('generar.ver'), async (req, res) => {
    try {
      const datos  = req.body;
      const cargos = await cargosMgr.cargarCargos(RUTAS.CARGOS);
      const cargo  = cargos.find(c => c.codigo === datos.cargoCodigo);
      if (!cargo) return res.status(400).json({ ok: false, error: 'Cargo no encontrado' });

      const plantilla = path.join(RUTAS.PLANTILLAS_DIR, cargo.plantilla || `${cargo.codigo}.docx`);
      if (!(await fs.pathExists(plantilla))) {
        return res.status(400).json({ ok: false, error: 'Plantilla no encontrada' });
      }

      const buffer = docGen.generarDocumento(plantilla, docGen.construirDataMemo(datos));
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="preview.docx"',
      });
      res.send(buffer);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
