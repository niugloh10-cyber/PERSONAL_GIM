# Sistema GIM v4.0 — Arquitectura Modular Empresarial

**Gerencia de Ingeniería Municipal · Municipalidad Provincial de Puno**

Sistema integral de gestión de personal, contratos, documentos, proyectos y
expedientes digitales para la GIM. Esta versión 4.0 reorganiza por completo el
backend en **módulos de dominio** independientes y unifica el frontend en una
**SPA con navegación lateral jerárquica**, conservando intacta toda la
funcionalidad probada de las versiones anteriores.

---

## 1. Novedades de la v4.0

- **Backend modular** (`backend/modules/`): cada dominio (personal, documentos,
  proyectos, asistencia, legajo, reportes, usuarios, auditoría, etc.) es un
  módulo Express independiente que se monta en `server.js`. Los gestores de
  datos probados (`backend/lib/`) se conservan como capa de servicios.
- **Nueva interfaz con menú lateral** organizada en 6 grupos: Inicio,
  Recursos Humanos, Gestión Documental, Proyectos, Reportes y Administración.
- **Legajo Digital — Expediente Único** (`GIM-RH-2026-NNNNNN`): cada trabajador
  tiene un expediente con documentos categorizados (DNI, CV, Título, Contratos,
  Memorandos, Evaluaciones, Carta de Conclusión, etc.), almacenados en
  `storage/expedientes/`.
- **Control de Asistencia**: registro diario por trabajador con estados
  (Presente, Tardanza, Falta, Permiso, Vacaciones, Descanso).
- **Reportes**: indicadores consolidados, estadísticas por cargo/proyecto/estado
  y exportaciones a Excel/CSV.
- **Administración completa por interfaz**: usuarios (CRUD + bloqueo), roles y
  permisos (RBAC), auditoría y respaldos.

---

## 2. Requisitos

- **Node.js 14 o superior** — https://nodejs.org
- Windows, Linux o macOS.

## 3. Instalación y arranque

### Windows (recomendado)

1. Ejecute **`INSTALAR.bat`** (solo la primera vez).
2. Ejecute **`INICIAR.bat`**. El navegador abrirá `http://localhost:3000`.

### Cualquier sistema (línea de comandos)

```bash
npm install      # solo la primera vez
npm start        # arranca el servidor en http://localhost:3000
```

### Credenciales iniciales

```
Email:    admin@gim.local
Password: Admin123456
```

> **Importante:** cambie la contraseña tras el primer ingreso
> (Administración → Usuarios, o el cambio de contraseña del perfil).

---

## 4. Estructura del proyecto

```
GIM-4.0/
├── backend/
│   ├── server.js              # Servidor: monta los 12 módulos
│   ├── lib/                   # Gestores de datos (capa de servicios)
│   │   ├── config.js          # Rutas y constantes centrales
│   │   ├── usersManager.js    # Usuarios + RBAC
│   │   ├── personalManager.js # Contratos, evaluaciones, historial
│   │   ├── excelManager.js    # Lectura/escritura de la BD .xlsx
│   │   ├── asistenciaManager.js  # (NUEVO) Control de asistencia
│   │   ├── legajoManager.js      # (NUEVO) Expediente Único
│   │   ├── reportesManager.js    # (NUEVO) Agregación de indicadores
│   │   └── ...
│   ├── middleware/            # Autenticación, permisos, rate-limit, etc.
│   ├── services/              # backupService (respaldo diario)
│   └── modules/              # MÓDULOS DE DOMINIO (rutas API)
│       ├── documentos/   contratos/    personal/    evaluaciones/
│       ├── conclusiones/ proyectos/    asistencia/  legajo/
│       ├── reportes/     usuarios/     auditoria/   sistema/
├── public/                    # Frontend (SPA)
│   ├── index.html             # Interfaz única con sidebar
│   ├── login.html
│   ├── css/style.css
│   └── js/
│       ├── auth.js  app.js  personal.js
│       └── modules/  nav.js (router)  views.js (vistas nuevas)
│                     notif.js  paginator.js
├── data/                      # Bases de datos (.xlsx, .json)
├── plantillas/                # Plantillas .docx por cargo
├── storage/expedientes/       # Documentos del Legajo Digital
├── backups/                   # Respaldos automáticos y manuales
├── logs/                      # Bitácora de auditoría
├── INICIAR.bat  INSTALAR.bat  IMPORTAR_BD.bat
└── package.json
```

---

## 5. Menú principal

| Grupo | Módulos |
|-------|---------|
| 🏠 **Inicio** | Panel de indicadores y accesos rápidos |
| 👥 **Recursos Humanos** | Personal · Contratos · Legajo Digital · Asistencia · Evaluaciones · Conclusiones |
| 📄 **Gestión Documental** | Memorandos · Registros · Cargos y Plantillas |
| 🏗️ **Proyectos** | Proyectos · Personal Asignado |
| 📊 **Reportes** | Indicadores · Estadísticas · Exportaciones |
| ⚙️ **Administración** | Usuarios · Roles · Auditoría · Backups · Configuración |

---

## 6. Roles del sistema (RBAC)

| Rol | Acceso |
|-----|--------|
| **super_admin** | Acceso total, incluida administración de usuarios y sistema |
| **admin** | Gestión documental y de personal, ver usuarios y auditoría |
| **editor** | Generar documentos, editar registros y cargos |
| **usuario** | Consulta de documentos, registros y cargos |

Los elementos del menú se ocultan automáticamente según los permisos del rol.

---

## 7. Importar la base de datos histórica

```bash
node importar_bd.js "ruta/al/archivo.xlsx"
```

o, en Windows, arrastre el archivo sobre **`IMPORTAR_BD.bat`**.

---

## 8. Respaldos

- Se genera un respaldo automático cada 24 horas en `backups/`.
- Respaldo manual desde **Administración → Backups → Generar Backup Manual**.

---

## 9. Notas técnicas

- Datos almacenados en archivos (`.xlsx` y `.json`); no requiere servidor de BD.
- Autenticación por token de sesión (cabecera `Authorization: Bearer`).
- Subida de archivos admitida: `.docx`, `.xlsx`, `.pdf`, `.jpg`, `.png`
  (máx. 20 MB).
- Para empaquetar como ejecutable Windows: `npm run build:exe` (requiere `pkg`).

---

© Municipalidad Provincial de Puno — Gerencia de Ingeniería Municipal.
