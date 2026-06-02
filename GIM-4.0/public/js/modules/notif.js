/**
 * SISTEMA GIM v3.0 - MÓDULO DE NOTIFICACIONES
 * =============================================
 * Sistema de notificaciones toast moderno para el frontend.
 */

const Notif = (() => {
  let _contenedor = null;

  function _init() {
    if (!_contenedor) {
      _contenedor = document.createElement('div');
      _contenedor.id = 'notif-container';
      _contenedor.style.cssText = `
        position:fixed;top:16px;right:16px;z-index:99999;
        display:flex;flex-direction:column;gap:8px;max-width:360px;
      `;
      document.body.appendChild(_contenedor);
    }
  }

  function _mostrar(mensaje, tipo, duracion) {
    _init();
    const colores = {
      success: { bg:'#27ae60', icon:'✓' },
      error:   { bg:'#c0392b', icon:'✕' },
      warning: { bg:'#e67e22', icon:'⚠' },
      info:    { bg:'#2980b9', icon:'ℹ' },
    };
    const c = colores[tipo] || colores.info;

    const el = document.createElement('div');
    el.style.cssText = `
      background:${c.bg};color:#fff;padding:12px 16px;border-radius:8px;
      box-shadow:0 4px 16px rgba(0,0,0,.2);display:flex;align-items:flex-start;
      gap:10px;font-size:13px;line-height:1.4;min-width:260px;
      animation:notifIn .25s ease-out;opacity:1;
      transition:opacity .3s,transform .3s;
    `;
    el.innerHTML = `
      <span style="font-size:16px;flex-shrink:0;margin-top:1px">${c.icon}</span>
      <span style="flex:1">${_escape(mensaje)}</span>
      <button onclick="this.parentElement.remove()" style="
        background:none;border:none;color:rgba(255,255,255,.8);
        cursor:pointer;font-size:16px;padding:0;flex-shrink:0;line-height:1
      ">×</button>
    `;

    if (!document.querySelector('#notif-style')) {
      const s = document.createElement('style');
      s.id = 'notif-style';
      s.textContent = `@keyframes notifIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}`;
      document.head.appendChild(s);
    }

    _contenedor.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      setTimeout(() => el.remove(), 300);
    }, duracion);
  }

  function _escape(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return {
    success: (msg, dur=4000) => _mostrar(msg, 'success', dur),
    error:   (msg, dur=6000) => _mostrar(msg, 'error',   dur),
    warning: (msg, dur=5000) => _mostrar(msg, 'warning', dur),
    info:    (msg, dur=4000) => _mostrar(msg, 'info',    dur),
  };
})();

window.Notif = Notif;
