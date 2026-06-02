/**
 * SISTEMA GIM v3.0 - GESTOR DE AUDITORÍA
 * ========================================
 * MEJORAS v3.0:
 * - Escritura asíncrona con buffer para no bloquear requests
 * - Rotación automática de logs (máx 10000 entradas, backup automático)
 * - IDs únicos garantizados
 */

'use strict';

const fs   = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { RUTAS } = require('./config');

const MAX_LOGS = 10000;

const TIPOS = {
  LOGIN: 'LOGIN', LOGOUT: 'LOGOUT', LOGIN_FALLIDO: 'LOGIN_FALLIDO',
  CREAR_USUARIO: 'CREAR_USUARIO', EDITAR_USUARIO: 'EDITAR_USUARIO',
  ELIMINAR_USUARIO: 'ELIMINAR_USUARIO', BLOQUEAR_USUARIO: 'BLOQUEAR_USUARIO',
  DESBLOQUEAR_USUARIO: 'DESBLOQUEAR_USUARIO',
  CAMBIAR_CONTRASENA: 'CAMBIAR_CONTRASENA', CAMBIAR_ROL: 'CAMBIAR_ROL',
  GENERAR_DOCUMENTO: 'GENERAR_DOCUMENTO', DESCARGAR_DOCUMENTO: 'DESCARGAR_DOCUMENTO',
  ELIMINAR_DOCUMENTO: 'ELIMINAR_DOCUMENTO',
  CREAR_CARGO: 'CREAR_CARGO', EDITAR_CARGO: 'EDITAR_CARGO', ELIMINAR_CARGO: 'ELIMINAR_CARGO',
  CAMBIAR_CONFIG: 'CAMBIAR_CONFIG', ACCESO_DENEGADO: 'ACCESO_DENEGADO',
  ERROR_SISTEMA: 'ERROR_SISTEMA', BACKUP: 'BACKUP',
};

const NIVELES = { INFO: 'INFO', ADVERTENCIA: 'ADVERTENCIA', ERROR: 'ERROR', CRITICO: 'CRITICO' };

class AuditManager {
  constructor(rutaArchivo) {
    this.rutaArchivo = rutaArchivo;
    this._pendientes = [];
    this._flush = false;
  }

  async registrarEvento(tipoEvento, usuarioId = null, detalles = {}, nivel = NIVELES.INFO) {
    const evento = {
      id: 'evt_' + crypto.randomBytes(8).toString('hex') + '_' + Date.now().toString(36),
      timestamp: new Date().toISOString(),
      tipo: tipoEvento,
      usuarioId: usuarioId || null,
      nivel,
      detalles: {
        ...detalles,
        ipAddress: detalles.ipAddress || null,
        userAgent: detalles.userAgent ? String(detalles.userAgent).substring(0, 200) : null,
      },
    };

    // Escritura asíncrona con buffer
    this._pendientes.push(evento);
    if (!this._flush) {
      this._flush = true;
      setImmediate(() => this._flushPendientes());
    }

    return evento;
  }

  async _flushPendientes() {
    this._flush = false;
    if (!this._pendientes.length) return;
    const eventos = [...this._pendientes];
    this._pendientes = [];

    try {
      await fs.ensureDir(path.dirname(this.rutaArchivo));
      let logs = await this._cargar();
      logs.push(...eventos);

      // Rotar si supera el máximo
      if (logs.length > MAX_LOGS) {
        await this._rotarLogs(logs.slice(0, logs.length - MAX_LOGS));
        logs = logs.slice(logs.length - MAX_LOGS);
      }

      await fs.writeFile(this.rutaArchivo, JSON.stringify(logs, null, 2), 'utf-8');
    } catch (_) {}
  }

  async _rotarLogs(logsViejos) {
    try {
      const fechaStr = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const backupRuta = path.join(RUTAS.LOGS_DIR, `audit-${fechaStr}.json`);
      await fs.writeFile(backupRuta, JSON.stringify(logsViejos, null, 2), 'utf-8');
    } catch (_) {}
  }

  async obtenerLogs(filtros = {}) {
    let logs = await this._cargar();

    if (filtros.tipo) logs = logs.filter(l => l.tipo === filtros.tipo);
    if (filtros.usuarioId) logs = logs.filter(l => l.usuarioId === filtros.usuarioId);
    if (filtros.nivel) logs = logs.filter(l => l.nivel === filtros.nivel);
    if (filtros.desde) {
      const d = new Date(filtros.desde);
      logs = logs.filter(l => new Date(l.timestamp) >= d);
    }
    if (filtros.hasta) {
      const h = new Date(filtros.hasta);
      logs = logs.filter(l => new Date(l.timestamp) <= h);
    }

    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return logs.slice(0, filtros.limite || 200);
  }

  async limpiarLogsAntiguos(diasRetener = 90) {
    const logs = await this._cargar();
    const corte = new Date();
    corte.setDate(corte.getDate() - diasRetener);
    const recientes = logs.filter(l => new Date(l.timestamp) >= corte);
    await fs.writeFile(this.rutaArchivo, JSON.stringify(recientes, null, 2), 'utf-8');
    return { eliminados: logs.length - recientes.length, retenidos: recientes.length };
  }

  async exportarCSV(filtros = {}) {
    const logs = await this.obtenerLogs(filtros);
    let csv = 'ID,TIMESTAMP,TIPO,USUARIO_ID,NIVEL,IP,DETALLES\n';
    for (const l of logs) {
      const det = JSON.stringify(l.detalles || {}).replace(/"/g, '""');
      csv += `"${l.id}","${l.timestamp}","${l.tipo}","${l.usuarioId || ''}","${l.nivel}","${l.detalles?.ipAddress || ''}","${det}"\n`;
    }
    return csv;
  }

  async _cargar() {
    try {
      if (await fs.pathExists(this.rutaArchivo)) {
        return JSON.parse(await fs.readFile(this.rutaArchivo, 'utf-8'));
      }
      return [];
    } catch (_) { return []; }
  }
}

module.exports = AuditManager;
module.exports.TIPOS = TIPOS;
module.exports.NIVELES = NIVELES;
