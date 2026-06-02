/**
 * SISTEMA GIM v4.0 - CONFIGURACIÓN CENTRAL
 * =========================================
 * Arquitectura Modular Empresarial.
 * Centraliza todas las constantes y rutas del sistema.
 */

'use strict';

const path = require('path');

const ROOT_DIR    = path.join(__dirname, '..', '..');
const DATA_DIR    = path.join(ROOT_DIR, 'data');
const DATABASE_DIR = path.join(ROOT_DIR, 'database');
const PUBLIC_DIR  = path.join(ROOT_DIR, 'public');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const LOGS_DIR    = path.join(ROOT_DIR, 'logs');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');
const PLANTILLAS_DIR = path.join(ROOT_DIR, 'plantillas');
const STORAGE_DIR    = path.join(ROOT_DIR, 'storage');
const EXPEDIENTES_DIR = path.join(STORAGE_DIR, 'expedientes');

const RUTAS = {
  ROOT_DIR, DATA_DIR, DATABASE_DIR, PUBLIC_DIR, UPLOADS_DIR, LOGS_DIR,
  BACKUPS_DIR, PLANTILLAS_DIR, STORAGE_DIR, EXPEDIENTES_DIR,
  CARGOS:    path.join(DATA_DIR, 'cargos.json'),
  CONFIG:    path.join(DATA_DIR, 'config.json'),
  MODULOS:   path.join(DATA_DIR, 'modulos.json'),
  PROYECTOS: path.join(DATA_DIR, 'proyectos.json'),
  BD_DEFAULT: path.join(DATA_DIR, 'base_de_datos.xlsx'),
  PERSONAL_BD: path.join(DATA_DIR, 'personal.xlsx'),
  ASISTENCIA: path.join(DATA_DIR, 'asistencia.json'),
  EXPEDIENTES_INDEX: path.join(DATA_DIR, 'expedientes.json'),
  VACACIONES:        path.join(DATA_DIR, 'vacaciones.json'),
  ACTIVOS:           path.join(DATA_DIR, 'activos.json'),
  CAPACITACIONES:    path.join(DATA_DIR, 'capacitaciones.json'),
  SANCIONES:         path.join(DATA_DIR, 'sanciones.json'),
  NOTIFICACIONES:    path.join(DATA_DIR, 'notificaciones.json'),
  ORGANIGRAMA:       path.join(DATA_DIR, 'organigrama.json'),
  USUARIOS:  path.join(DATA_DIR, 'usuarios.json'),
  SESIONES:  path.join(DATA_DIR, 'sesiones.json'),
  LOGS:      path.join(LOGS_DIR, 'audit.json'),
  LOGS_SISTEMA: path.join(LOGS_DIR, 'sistema.log'),
};

const SECURITY = {
  RATE_LIMIT_WINDOW_MS: 60 * 1000,
  RATE_LIMIT_MAX:       100,
  LOGIN_RATE_LIMIT_MAX: 10,
  SESSION_EXPIRY_MS:    24 * 60 * 60 * 1000,
  MAX_FAILED_ATTEMPTS:  5,
  LOCKOUT_DURATION_MS:  15 * 60 * 1000,
  BODY_LIMIT:           '10mb',
  BCRYPT_ROUNDS:        10,
};

const UPLOAD = {
  MAX_FILE_SIZE: 20 * 1024 * 1024,
  ALLOWED_MIME: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf', 'image/jpeg', 'image/png',
  ],
  ALLOWED_EXTENSIONS: ['.docx', '.xlsx', '.xls', '.pdf', '.jpg', '.jpeg', '.png'],
};

const VERSION = '4.2.0';
const VERSION_NOMBRE = 'Arquitectura Modular Empresarial';

module.exports = { RUTAS, SECURITY, UPLOAD, VERSION, VERSION_NOMBRE };
