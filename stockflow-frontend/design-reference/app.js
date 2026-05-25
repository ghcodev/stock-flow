/* ============================================================
   StockFlow App — shared interactions
   ============================================================ */

/* ---------- THEME (DARK MODE) ---------- */
const SF = window.SF = {};
SF.theme = {
  get: () => localStorage.getItem('sf-theme') || 'light',
  set(t) { localStorage.setItem('sf-theme', t); document.documentElement.dataset.theme = t; this.updateBtn(); },
  toggle() { this.set(this.get() === 'dark' ? 'light' : 'dark'); SF.toast.show({ kind:'info', title:'Tema atualizado', msg:'Tema '+(this.get()==='dark'?'escuro':'claro')+' aplicado.' }); },
  updateBtn() {
    document.querySelectorAll('[data-theme-toggle]').forEach(b => {
      b.innerHTML = this.get()==='dark'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
        : '<svg><use href="#i-sun"/></svg>';
    });
  },
  init() { this.set(this.get()); }
};

/* ---------- TOAST ---------- */
SF.toast = {
  container: null,
  ensure() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
    return this.container;
  },
  show({ kind='info', title='', msg='', timeout=4200 }) {
    const c = this.ensure();
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    const icon = { success:'i-circle-check', danger:'i-alert-triangle', warning:'i-alert-triangle', info:'i-bell' }[kind] || 'i-bell';
    el.innerHTML = `
      <div class="toast-icon"><svg><use href="#${icon}"/></svg></div>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="Fechar"><svg><use href="#i-x"/></svg></button>`;
    c.appendChild(el);
    const dismiss = () => { el.classList.add('removing'); setTimeout(()=>el.remove(), 200); };
    el.querySelector('.toast-close').onclick = dismiss;
    if (timeout) setTimeout(dismiss, timeout);
  }
};

/* ---------- MODAL ---------- */
SF.modal = {
  open(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('visible');
    document.body.style.overflow = 'hidden';
  },
  close(id) {
    const el = id ? document.getElementById(id) : document.querySelector('.modal-overlay.visible');
    if (!el) return;
    el.classList.remove('visible');
    document.body.style.overflow = '';
  },
  init() {
    document.addEventListener('click', e => {
      const o = e.target.closest('[data-modal-open]');
      if (o) { e.preventDefault(); this.open(o.dataset.modalOpen); return; }
      const c = e.target.closest('[data-modal-close]');
      if (c) { e.preventDefault(); this.close(); return; }
      if (e.target.classList && e.target.classList.contains('modal-overlay')) this.close();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });
  }
};

/* ---------- DRAWER ---------- */
SF.drawer = {
  open(id) {
    const d = document.getElementById(id);
    if (!d) return;
    let ov = document.querySelector('.drawer-overlay');
    if (!ov) {
      ov = document.createElement('div'); ov.className = 'drawer-overlay';
      ov.onclick = () => this.close();
      document.body.appendChild(ov);
    }
    requestAnimationFrame(()=>{ ov.classList.add('visible'); d.classList.add('visible'); });
  },
  close() {
    document.querySelectorAll('.drawer.visible').forEach(d=>d.classList.remove('visible'));
    document.querySelectorAll('.drawer-overlay.visible').forEach(d=>d.classList.remove('visible'));
  },
  init() {
    document.addEventListener('click', e => {
      const o = e.target.closest('[data-drawer-open]');
      if (o) { e.preventDefault(); this.open(o.dataset.drawerOpen); }
      const c = e.target.closest('[data-drawer-close]');
      if (c) { e.preventDefault(); this.close(); }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });
  }
};

/* ---------- UTIL: format numbers / dates ---------- */
SF.fmt = {
  n: v => Number(v).toLocaleString('pt-BR'),
  date: d => new Date(d).toLocaleDateString('pt-BR'),
  shortDate: d => new Date(d).toLocaleDateString('pt-BR', {day:'2-digit', month:'short'}),
  time: d => new Date(d).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})
};

/* ---------- ACCORDION TABLE ---------- */
SF.accordion = {
  init(scope=document) {
    scope.querySelectorAll('table.enterprise tbody tr.accordion-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button,a,input')) return;
        row.classList.toggle('open');
        const next = row.nextElementSibling;
        if (next && next.classList.contains('accordion-detail')) {
          next.style.display = row.classList.contains('open') ? 'table-row' : 'none';
        }
      });
    });
  }
};

/* ---------- CHIPS / FILTERS (visual only — toggleable) ---------- */
SF.chips = {
  init() {
    document.addEventListener('click', e => {
      const ch = e.target.closest('.filter-chip[data-toggle]');
      if (ch) {
        ch.classList.toggle('active');
      }
      const x = e.target.closest('.applied-chip button');
      if (x) {
        x.closest('.applied-chip').remove();
      }
    });
  }
};

/* ---------- PASSWORD STRENGTH ---------- */
SF.strength = function(pwd) {
  let s = 0;
  if (pwd.length >= 8) s++;
  if (/[A-Z]/.test(pwd)) s++;
  if (/[a-z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  if (s <= 2) return { score: 1, level: 'weak', label: 'Fraca' };
  if (s <= 4) return { score: 2, level: 'medium', label: 'Média' };
  return { score: 3, level: 'strong', label: 'Forte' };
};

/* ---------- JSON syntax highlight ---------- */
SF.highlightJson = function(obj) {
  const json = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      m => {
        let cls = 'json-number';
        if (/^"/.test(m)) cls = /:$/.test(m) ? 'json-key' : 'json-string';
        else if (/true|false/.test(m)) cls = 'json-bool';
        else if (/null/.test(m)) cls = 'json-null';
        return `<span class="${cls}">${m}</span>`;
      });
};

/* ---------- INIT ON LOAD ---------- */
document.addEventListener('DOMContentLoaded', () => {
  SF.theme.init();
  SF.modal.init();
  SF.drawer.init();
  SF.chips.init();
  SF.accordion.init();
  // theme toggle delegation
  document.addEventListener('click', e => {
    if (e.target.closest('[data-theme-toggle]')) { e.preventDefault(); SF.theme.toggle(); }
  });
});
