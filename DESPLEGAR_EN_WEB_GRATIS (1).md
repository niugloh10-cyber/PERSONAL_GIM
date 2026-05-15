# 🌐 GUÍA: DESPLEGAR SISTEMA GIM EN LA WEB (GRATIS)

## 🎯 OPCIONES DISPONIBLES

Hay varias formas de poner tu Sistema GIM en internet sin pagar:

---

## 1️⃣ RENDER.COM (⭐ RECOMENDADO - MÁS FÁCIL)

### ✅ VENTAJAS
- Completamente gratuito
- Muy fácil de usar
- Incluye base de datos gratuita
- Perfecto para Node.js/Express
- Sin necesidad de tarjeta de crédito

### 📋 PASOS

#### PASO 1: Preparar el código para Render

Abre tu `package.json` y asegúrate que tenga:

```json
{
  "engines": {
    "node": "18.x"
  },
  "scripts": {
    "start": "node backend/server-auth.js"
  }
}
```

#### PASO 2: Crear archivo `.gitignore`

Crea archivo `.gitignore` en la raíz del proyecto:

```
node_modules/
.env
.DS_Store
npm-debug.log
data/sesiones.json
data/logs.json
```

#### PASO 3: Subir a GitHub

```bash
# 1. Crear cuenta en GitHub (si no tienes)
# https://github.com

# 2. Crear nuevo repositorio
# Nombre: sistema-gim-v2.1
# Público (importante)

# 3. Desde la carpeta de tu proyecto
git init
git add .
git commit -m "Sistema GIM v2.1 inicial"
git remote add origin https://github.com/TU_USUARIO/sistema-gim-v2.1.git
git push -u origin main
```

#### PASO 4: Conectar con Render

1. Entra a https://render.com
2. Click en "Sign Up" → Elige "GitHub"
3. Autoriza Render con tu GitHub
4. Click en "New +" → "Web Service"
5. Selecciona tu repositorio `sistema-gim-v2.1`
6. Llenar configuración:
   - **Name**: sistema-gim-v2-1
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node backend/server-auth.js`
   - **Instance Type**: Free (gratuito)

7. Click en "Create Web Service"
8. Espera 3-5 minutos a que se deploy

#### RESULTADO
Tu sistema estará en:
```
https://sistema-gim-v2-1.onrender.com
```

✅ Completamente gratuito y funcional

---

## 2️⃣ RAILWAY.APP (⭐ TAMBIÉN RECOMENDADO)

### ✅ VENTAJAS
- Gratuito con $5 crédito mensual
- Muy fácil de desplegar
- Buen rendimiento
- Soporte a Node.js

### 📋 PASOS

#### PASO 1: Preparar código (igual a Render)

#### PASO 2: Subir a GitHub (igual a Render)

#### PASO 3: Conectar con Railway

1. Entra a https://railway.app
2. Click en "Start Project"
3. Selecciona "Deploy from GitHub repo"
4. Autoriza y selecciona `sistema-gim-v2.1`
5. Railway auto-detectará Node.js
6. Configura variables de entorno si necesitas
7. Click en "Deploy"

#### RESULTADO
Tu sistema estará en:
```
https://sistema-gim-v2-1.railway.app
```

✅ $5 crédito gratuito cada mes

---

## 3️⃣ HEROKU (ALTERNATIVA)

### ⚠️ NOTA
Heroku eliminó su plan gratuito, pero pueden usar créditos de estudiante.

### 📋 PASOS (si tienes créditos)

```bash
# 1. Instalar Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# 2. Login
heroku login

# 3. Crear app
heroku create sistema-gim-v2-1

# 4. Subir código
git push heroku main

# 5. Ver logs
heroku logs --tail
```

---

## 4️⃣ VERCEL (Para Frontend + Backend)

### ✅ VENTAJAS
- Gratuito
- Muy rápido
- Bueno para Node.js
- Fácil integración

### 📋 PASOS

1. Entra a https://vercel.com
2. Click en "Sign Up"
3. Selecciona "GitHub"
4. Autoriza Vercel
5. Click en "Import Project"
6. Selecciona tu repositorio
7. Configurar:
   - **Framework**: Other
   - **Build Command**: `npm install`
   - **Output Directory**: (dejar vacío)
   - **Environment**: Node

8. Click en "Deploy"

#### RESULTADO
```
https://sistema-gim-v2-1.vercel.app
```

---

## 5️⃣ REPLIT (MÁS SIMPLE - PARA PROBAR)

### ✅ VENTAJAS
- Sin necesidad de GitHub
- Muy fácil de usar
- Perfecto para probar
- Directo desde el navegador

### 📋 PASOS

1. Entra a https://replit.com
2. Click en "Create" → "New Repl"
3. Selecciona "Node.js"
4. Copia tu código en el editor
5. Click en "Run"
6. Te dará un URL público

#### RESULTADO
```
https://sistema-gim-v2-1.replit.dev
```

---

## 6️⃣ GOOGLE CLOUD RUN (GRATUITO)

### ✅ VENTAJAS
- Muy gratuito
- Bueno para producción
- Escalable

### 📋 PASOS

#### PASO 1: Crear Dockerfile

Crea archivo `Dockerfile` en la raíz:

```dockerfile
FROM node:18

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

#### PASO 2: Crear archivo `.dockerignore`

```
node_modules
npm-debug.log
.git
.gitignore
```

#### PASO 3: Subir a GitHub (igual a Render)

#### PASO 4: Desplegar en Cloud Run

1. Entra a https://console.cloud.google.com
2. Crea nuevo proyecto (gratis)
3. Habilita "Cloud Run API"
4. Click en "Create Service"
5. Selecciona "Deploy one revision from an image source"
6. Conecta con GitHub
7. Selecciona tu repositorio
8. Configura build
9. Deploy

---

## 🏆 COMPARACIÓN DE OPCIONES

| Plataforma | Costo | Facilidad | Velocidad | Recomendación |
|-----------|-------|-----------|-----------|--------------|
| **Render** | Gratis | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Railway** | Gratis $5/mes | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Vercel** | Gratis | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Replit** | Gratis | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Cloud Run** | Gratis | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Heroku** | $7/mes | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ |

---

## 📝 SOLUCIÓN RECOMENDADA PASO A PASO

### Mi Recomendación: RENDER.COM

#### PASO 1: Instalar Git (si no tienes)

Descarga desde: https://git-scm.com/download

#### PASO 2: Preparar tu proyecto

```bash
# Entra a la carpeta del proyecto
cd sistema-gim-v2.1

# Inicializar Git
git init

# Crear .gitignore
echo "node_modules/" > .gitignore
echo ".env" >> .gitignore
echo "data/sesiones.json" >> .gitignore
echo "data/logs.json" >> .gitignore

# Confirmar cambios
git add .
git commit -m "Sistema GIM v2.1 para Render"
```

#### PASO 3: Crear cuenta GitHub

1. Ve a https://github.com
2. Click en "Sign up"
3. Completa el formulario
4. Verifica tu email

#### PASO 4: Crear repositorio

1. Click en "+" (esquina superior derecha)
2. "New repository"
3. Nombre: `sistema-gim-v2-1`
4. Descripción: "Sistema GIM con autenticación RBAC"
5. Selecciona "Public"
6. Click "Create repository"

#### PASO 5: Subir código a GitHub

```bash
# Desde tu proyecto
git remote add origin https://github.com/TU_USUARIO/sistema-gim-v2-1.git
git branch -M main
git push -u origin main
```

#### PASO 6: Desplegar en Render

1. Ve a https://render.com
2. Click "Sign up"
3. Elige "Continue with GitHub"
4. Autoriza Render
5. Click "New +" → "Web Service"
6. Selecciona tu repositorio
7. Configurar:

```
Name:              sistema-gim-v2-1
Environment:       Node
Region:            Choose closest to you
Branch:            main
Build Command:     npm install
Start Command:     node backend/server-auth.js
Instance Type:     Free
```

8. Click "Create Web Service"
9. Espera 3-5 minutos
10. ¡Tu sistema está en línea!

#### RESULTADO
```
URL: https://sistema-gim-v2-1.onrender.com

Email:      admin@gim.local
Contraseña: Admin123456
```

---

## 🔗 LINKS DE DESCARGA/REGISTRO

```
GitHub:        https://github.com
Render:        https://render.com
Railway:       https://railway.app
Vercel:        https://vercel.com
Replit:        https://replit.com
Google Cloud:  https://console.cloud.google.com
Heroku:        https://heroku.com (pago)
```

---

## ⚠️ IMPORTANTE - CONFIGURACIÓN DE PRODUCCIÓN

### Variables de entorno

Crea archivo `.env` (no subir a GitHub):

```
NODE_ENV=production
PORT=3000
```

### Seguridad en producción

Antes de ir a producción:

1. ✅ Cambiar credenciales por defecto
2. ✅ Usar HTTPS (Render/Railway lo hacen automático)
3. ✅ Configurar backup de datos
4. ✅ Establecer límites de rate limiting
5. ✅ Monitorear logs

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### "Build failed"
```
Solución:
- Verificar que package.json existe
- Verificar que no hay errores de sintaxis
- Revisar los logs de build
```

### "Application crash"
```
Solución:
- Revisar logs de la aplicación
- Verificar puertos (usar PORT variable)
- Verificar que start command es correcto
```

### "Cannot find module"
```
Solución:
npm install debe ejecutarse automático
Si no: agregar npm install en build command
```

---

## 📊 RENDIMIENTO ESPERADO

### Render (Gratis)
- Velocidad: Buena
- Uptime: 99.99%
- Recursos: 0.5 CPU, 512 MB RAM
- Perfectamente funcional para tu caso

### Railway (Gratis + $5)
- Velocidad: Excelente
- Uptime: 99.99%
- Recursos: 512 MB RAM
- Mejor relación precio/rendimiento

---

## 💡 RECOMENDACIÓN FINAL

### Para Producción → **RAILWAY.APP**
- $5 crédito gratuito cada mes
- Excelente rendimiento
- Muy confiable
- Fácil de usar

### Para Desarrollo/Pruebas → **RENDER.COM**
- Completamente gratis
- Sin límites de time
- Perfecto para empezar
- Fácil de cambiar después

### Para Prototipado Rápido → **REPLIT**
- Sin necesidad de Git/GitHub
- Más fácil aún
- Bueno para demostrar
- Pero con limitaciones

---

## 🎯 MI PLAN SUGERIDO

```
Fase 1: Prueba rápida
└─ Usar REPLIT (5 minutos de setup)

Fase 2: Desarrollo
└─ Usar RENDER.COM (gratis, sin límites)

Fase 3: Producción
└─ Migrar a RAILWAY.APP (pequeño costo, mejor rendimiento)
```

---

## 📱 ACCEDER DESDE MÓVIL

Una vez deployado:

```
1. Abrir navegador en móvil
2. Ir a: https://sistema-gim-v2-1.onrender.com
   (o la URL que te dé Render/Railway)
3. Se abrirá automáticamente login.html
4. Login con admin@gim.local
5. ¡Accesible desde cualquier dispositivo!
```

---

## 🔒 SEGURIDAD EN LA WEB

### ✅ IMPORTANTE HACER

1. **Cambiar credenciales por defecto**
   - No uses admin@gim.local en producción
   - Crea usuario nuevo con contraseña fuerte

2. **Usar HTTPS** (automático en Render/Railway)

3. **Backup de datos**
   - Los datos se guardan en `data/` carpeta
   - Descargar regularmente

4. **Rate limiting** (ya implementado)
   - 100 req/min por defecto
   - Configurable en código

5. **Firewall** (Render/Railway lo hacen)

---

## 📞 PRÓXIMOS PASOS

Después de desplegar:

1. ✅ Verificar que funciona
2. ✅ Cambiar credenciales del admin
3. ✅ Crear usuarios nuevos
4. ✅ Configurar permisos
5. ✅ Hacer backup de datos
6. ✅ Monitorear logs
7. ✅ Configurar dominios personalizados (opcional)

---

## 🎁 DOMINIO PERSONALIZADO (GRATIS)

### Opción 1: Freenom (Dominio gratis por 1 año)
```
https://www.freenom.com
Dominios: .tk, .ml, .ga
Gratuito pero con limitaciones
```

### Opción 2: Namecheap ($1.88/año primer año)
```
https://www.namecheap.com
Dominios: .xyz, .site, etc
Muy económico
```

### Opción 3: Dominio de Render/Railway
```
Ambas plataformas dan dominio gratis:
sistema-gim-v2-1.onrender.com
sistema-gim-v2-1.railway.app
```

---

## ✅ CHECKLIST FINAL

- [ ] Código listo en GitHub
- [ ] Cuenta en Render/Railway creada
- [ ] Repositorio conectado
- [ ] Deploy ejecutado
- [ ] URL funciona
- [ ] Login funciona
- [ ] Dashboard accesible
- [ ] Credenciales cambiadas
- [ ] Usuarios creados
- [ ] Datos respaldados

---

## 📚 RECURSOS

```
Git Tutorial: https://git-scm.com/doc
GitHub Help: https://docs.github.com
Render Docs: https://render.com/docs
Railway Docs: https://docs.railway.app
Node.js Deploy: https://nodejs.org/en/docs/guides/nodejs-docker-webapp/
```

---

## 🎉 RESUMEN

```
┌─────────────────────────────────────────┐
│   DESPLEGAR EN LA WEB (GRATIS)          │
├─────────────────────────────────────────┤
│ 1. Preparar código (agregar .gitignore) │
│ 2. Subir a GitHub                       │
│ 3. Conectar con Render/Railway          │
│ 4. Esperar deploy (5-10 min)            │
│ 5. ¡Sistema en línea!                   │
└─────────────────────────────────────────┘

Tiempo total: 20-30 minutos
Costo: $0.00 (gratis)
Dificultad: Fácil
Resultado: Sistema web accesible 24/7
```

---

**¡Tu Sistema GIM estará en la web completamente gratis!** 🚀

Municipalidad Provincial de Puno
Gerencia de Ingeniería Municipal
2024
