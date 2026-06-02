/**
 * SISTEMA GIM v3.0 - MÓDULO DE PAGINACIÓN
 * =========================================
 * Paginación reutilizable para tablas del sistema.
 */

const Paginator = (() => {
  function crear({ datos, pagina = 1, porPagina = 20, contenedorId, paginadorId, renderFila, columnas }) {
    const total    = datos.length;
    const totalPag = Math.max(1, Math.ceil(total / porPagina));
    pagina = Math.min(Math.max(1, pagina), totalPag);
    const inicio   = (pagina - 1) * porPagina;
    const fin      = Math.min(inicio + porPagina, total);
    const slice    = datos.slice(inicio, fin);

    // Renderizar tabla
    const tbody = document.querySelector(`#${contenedorId} tbody`);
    if (tbody) {
      if (slice.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${columnas || 99}" style="text-align:center;padding:24px;color:#888">Sin registros</td></tr>`;
      } else {
        tbody.innerHTML = slice.map((item, i) => renderFila(item, inicio + i)).join('');
      }
    }

    // Renderizar paginador
    const paginadorEl = document.getElementById(paginadorId);
    if (!paginadorEl) return { pagina, totalPag };

    if (totalPag <= 1) { paginadorEl.innerHTML = ''; return { pagina, totalPag }; }

    let html = `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;padding:12px 0">`;
    html += `<span style="font-size:12px;color:#666;margin-right:8px">${inicio+1}–${fin} de ${total}</span>`;

    // Prev
    html += `<button onclick="window._paginatorCb('${paginadorId}',${pagina-1})" ${pagina===1?'disabled':''} style="${btnStyle(pagina===1)}">‹</button>`;

    // Páginas
    const pages = calcPages(pagina, totalPag);
    for (const p of pages) {
      if (p === '…') {
        html += `<span style="padding:0 4px;color:#aaa">…</span>`;
      } else {
        html += `<button onclick="window._paginatorCb('${paginadorId}',${p})" style="${btnStyle(false, p===pagina)}">${p}</button>`;
      }
    }

    // Next
    html += `<button onclick="window._paginatorCb('${paginadorId}',${pagina+1})" ${pagina===totalPag?'disabled':''} style="${btnStyle(pagina===totalPag)}">›</button>`;
    html += `</div>`;
    paginadorEl.innerHTML = html;

    return { pagina, totalPag };
  }

  function btnStyle(disabled, active = false) {
    if (disabled) return 'padding:4px 10px;border:1px solid #ddd;border-radius:5px;background:#f5f5f5;color:#aaa;cursor:not-allowed;font-size:13px';
    if (active)   return 'padding:4px 10px;border:1px solid #1a3c6e;border-radius:5px;background:#1a3c6e;color:#fff;cursor:pointer;font-size:13px;font-weight:600';
    return 'padding:4px 10px;border:1px solid #ddd;border-radius:5px;background:#fff;color:#333;cursor:pointer;font-size:13px';
  }

  function calcPages(actual, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [];
    if (actual <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('…'); pages.push(total);
    } else if (actual >= total - 3) {
      pages.push(1); pages.push('…');
      for (let i = total - 4; i <= total; i++) pages.push(i);
    } else {
      pages.push(1); pages.push('…');
      for (let i = actual - 1; i <= actual + 1; i++) pages.push(i);
      pages.push('…'); pages.push(total);
    }
    return pages;
  }

  // Registro global de callbacks
  window._paginatorCallbacks = window._paginatorCallbacks || {};
  window._paginatorCb = (id, pag) => {
    if (window._paginatorCallbacks[id]) window._paginatorCallbacks[id](pag);
  };

  function registrar(id, callback) {
    window._paginatorCallbacks[id] = callback;
  }

  return { crear, registrar };
})();

window.Paginator = Paginator;
