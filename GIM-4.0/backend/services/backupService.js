/**
 * SISTEMA GIM v3.0 - SERVICIO DE BACKUP
 * =======================================
 * Backup automático de datos críticos.
 */

'use strict';

const fs   = require('fs-extra');
const path = require('path');
const { RUTAS } = require('../lib/config');
const logger = require('../lib/logger');

const MOD = 'BackupService';

async function crearBackup(tipo = 'manual') {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const dirBackup = path.join(RUTAS.BACKUPS_DIR, `backup-${ts}-${tipo}`);
    await fs.ensureDir(dirBackup);

    const archivos = [
      RUTAS.CARGOS, RUTAS.CONFIG, RUTAS.PROYECTOS,
      RUTAS.USUARIOS, RUTAS.BD_DEFAULT,
    ];

    let copiados = 0;
    for (const archivo of archivos) {
      if (await fs.pathExists(archivo)) {
        await fs.copy(archivo, path.join(dirBackup, path.basename(archivo)));
        copiados++;
      }
    }

    // Limpiar backups viejos (mantener sólo los últimos 10)
    await limpiarBackupsViejos(10);

    logger.info(MOD, `Backup ${tipo} creado`, { archivos: copiados, dir: dirBackup });
    return { ok: true, directorio: dirBackup, archivos: copiados, timestamp: ts };
  } catch (e) {
    logger.error(MOD, 'Error creando backup', { error: e.message });
    return { ok: false, error: e.message };
  }
}

async function listarBackups() {
  try {
    await fs.ensureDir(RUTAS.BACKUPS_DIR);
    const entries = await fs.readdir(RUTAS.BACKUPS_DIR);
    const backups = [];
    for (const entry of entries) {
      const ruta = path.join(RUTAS.BACKUPS_DIR, entry);
      const stat = await fs.stat(ruta).catch(() => null);
      if (stat && stat.isDirectory()) {
        backups.push({ nombre: entry, ruta, fecha: stat.mtime, tamanio: stat.size });
      }
    }
    backups.sort((a, b) => b.fecha - a.fecha);
    return backups;
  } catch (_) { return []; }
}

async function limpiarBackupsViejos(maxBackups = 10) {
  const backups = await listarBackups();
  if (backups.length > maxBackups) {
    const aEliminar = backups.slice(maxBackups);
    for (const b of aEliminar) {
      await fs.remove(b.ruta).catch(() => {});
    }
  }
}

// Backup automático diario
function programarBackupDiario() {
  const ahora = new Date();
  const manana = new Date(ahora);
  manana.setHours(2, 0, 0, 0); // 2 AM
  if (manana <= ahora) manana.setDate(manana.getDate() + 1);

  const msHastaManana = manana - ahora;
  setTimeout(() => {
    crearBackup('automatico');
    setInterval(() => crearBackup('automatico'), 24 * 60 * 60 * 1000);
  }, msHastaManana);

  logger.info(MOD, `Próximo backup automático en ${Math.round(msHastaManana / 3600000)} horas`);
}

module.exports = { crearBackup, listarBackups, programarBackupDiario };
