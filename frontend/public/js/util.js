// ============================================================
// Shared utilities for the OpenIMIS Sandbox
// ============================================================
const SandboxUtil = (function () {
  // ---------- Relay / openIMIS helpers ----------

  /**
   * Decode a Relay global ID ("VHlwZToxMjM=") into its numeric database id.
   * openIMIS mutations expect plain integer IDs, while queries return Relay IDs.
   */
  function relayToId(relayId) {
    if (relayId === null || relayId === undefined || relayId === '') return null;
    if (typeof relayId === 'number') return relayId;
    const asNumber = Number(relayId);
    if (!Number.isNaN(asNumber) && String(asNumber) === String(relayId)) return asNumber;
    try {
      const decoded = atob(relayId);
      const parts = decoded.split(':');
      const last = parts[parts.length - 1];
      const parsed = parseInt(last, 10);
      return Number.isNaN(parsed) ? null : parsed;
    } catch (e) {
      return null;
    }
  }

  /** Encode a numeric id into a Relay global ID, for reference / teaching. */
  function idToRelay(typeName, id) {
    return btoa(`${typeName}:${id}`);
  }

  /** Extract numeric id from an object that may expose `id`, `uuid` or a Relay id. */
  function numericId(obj) {
    if (obj === null || obj === undefined) return null;
    if (typeof obj === 'number') return obj;
    if (typeof obj === 'object') return relayToId(obj.id);
    return relayToId(obj);
  }

  // ---------- Formatting ----------

  function money(value, fallback = '0') {
    const n = Number(value);
    if (value === null || value === undefined || Number.isNaN(n)) return `Rp ${fallback}`;
    return 'Rp ' + n.toLocaleString('id-ID', { maximumFractionDigits: 0 });
  }

  function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isNaN(n) ? fallback : n;
  }

  function today() {
    return new Date().toISOString().split('T')[0];
  }

  function addDays(isoDate, days) {
    const d = isoDate ? new Date(isoDate) : new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  function addYears(isoDate, years) {
    const d = isoDate ? new Date(isoDate) : new Date();
    d.setFullYear(d.getFullYear() + years);
    return d.toISOString().split('T')[0];
  }

  function dateOnly(value) {
    if (!value) return '-';
    return String(value).slice(0, 10);
  }

  function randomDigits(len) {
    let out = '';
    for (let i = 0; i < len; i++) out += Math.floor(Math.random() * 10);
    return out;
  }

  /** Generate a CHFID-like number that does not collide with obvious demo data. */
  function newChfId() {
    return '9' + randomDigits(8);
  }

  // ---------- Safety ----------

  /** Escape untrusted values before injecting into innerHTML. */
  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Escape a value for use inside a single-quoted inline JS string. */
  function jsStr(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
  }

  // ---------- DOM ----------

  function el(id) {
    return document.getElementById(id);
  }

  function val(id, fallback = '') {
    const node = document.getElementById(id);
    return node ? node.value : fallback;
  }

  function checked(id) {
    const node = document.getElementById(id);
    return !!(node && node.checked);
  }

  function setHTML(id, html) {
    const node = document.getElementById(id);
    if (node) node.innerHTML = html;
  }

  function setText(id, text) {
    const node = document.getElementById(id);
    if (node) node.innerText = text;
  }

  function spinnerRow(colspan, message) {
    return `<tr><td colspan="${colspan}" class="p-8 text-center text-slate-500">
      <span class="inline-flex items-center gap-2">
        <span class="animate-spin w-3.5 h-3.5 border-2 border-sky-600 border-t-transparent rounded-full"></span>
        ${esc(message)}
      </span></td></tr>`;
  }

  function errorRow(colspan, message) {
    return `<tr><td colspan="${colspan}" class="p-8 text-center text-red-600">${esc(message)}</td></tr>`;
  }

  function emptyRow(colspan, message) {
    return `<tr><td colspan="${colspan}" class="p-8 text-center text-slate-400">${esc(message)}</td></tr>`;
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try { window.lucide.createIcons(); } catch (e) { /* noop */ }
    }
  }

  function toast(message, type = 'info', duration) {
    if (window.AppToast) window.AppToast.show(message, type, duration);
  }

  // ---------- Data helpers ----------

  /** Unwrap a Relay connection into a plain array of nodes. */
  function nodes(connection) {
    if (!connection || !connection.edges) return [];
    return connection.edges.map(e => e && e.node).filter(Boolean);
  }

  function totalCount(connection) {
    return (connection && connection.totalCount) || 0;
  }

  /** Options markup for a <select>, used across modules. */
  function options(items, valueFn, labelFn, selectedValue) {
    return items.map(item => {
      const value = valueFn(item);
      const selected = String(value) === String(selectedValue) ? ' selected' : '';
      return `<option value="${esc(value)}"${selected}>${esc(labelFn(item))}</option>`;
    }).join('');
  }

  // ---------- Claim / policy status vocabulary (verified against 26.04 models) ----------

  const CLAIM_STATUS = {
    1:  { label: 'Rejected',  id: 'rejected',  color: 'bg-red-100 text-red-800',        help: 'Ditolak oleh penjamin' },
    2:  { label: 'Entered',   id: 'entered',   color: 'bg-amber-100 text-amber-800',    help: 'Baru dimasukkan petugas faskes' },
    4:  { label: 'Checked',   id: 'checked',   color: 'bg-blue-100 text-blue-800',      help: 'Lolos verifikasi administratif' },
    8:  { label: 'Processed', id: 'processed', color: 'bg-purple-100 text-purple-800',  help: 'Sudah diadjudikasi sistem' },
    16: { label: 'Valuated',  id: 'valuated',  color: 'bg-emerald-100 text-emerald-800', help: 'Nilai penggantian final ditetapkan' }
  };

  const POLICY_STATUS = {
    1: { label: 'Idle',      color: 'bg-slate-100 text-slate-700' },
    2: { label: 'Active',    color: 'bg-emerald-100 text-emerald-800' },
    4: { label: 'Suspended', color: 'bg-amber-100 text-amber-800' },
    8: { label: 'Expired',   color: 'bg-red-100 text-red-800' },
    16:{ label: 'Ready',     color: 'bg-sky-100 text-sky-800' }
  };

  function claimStatusBadge(status) {
    const s = CLAIM_STATUS[Number(status)];
    if (!s) return `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">Status ${esc(status)}</span>`;
    return `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.color}" title="${esc(s.help)}">${esc(status)}: ${esc(s.label)}</span>`;
  }

  function policyStatusBadge(status) {
    const s = POLICY_STATUS[Number(status)];
    if (!s) return `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">Status ${esc(status)}</span>`;
    return `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.color}">${esc(s.label)}</span>`;
  }

  const PAY_TYPE = { C: 'Tunai (Cash)', B: 'Bank / Transfer', M: 'Mobile', O: 'Online Gateway' };

  function payTypeLabel(code) {
    return PAY_TYPE[code] || code || '-';
  }

  // ---------- Tabs / sections helper ----------

  /** Render a horizontal sub-tab bar and toggle sections by id. */
  function subTabs(buttons) {
    return `<div class="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">${buttons
      .map(b => `<button onclick="${b.onclick}" class="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white text-slate-600 hover:bg-slate-50 shadow-sm">${esc(b.label)}</button>`)
      .join('')}</div>`;
  }

  return {
    relayToId,
    idToRelay,
    numericId,
    money,
    num,
    today,
    addDays,
    addYears,
    dateOnly,
    randomDigits,
    newChfId,
    esc,
    jsStr,
    el,
    val,
    checked,
    setHTML,
    setText,
    spinnerRow,
    errorRow,
    emptyRow,
    refreshIcons,
    toast,
    nodes,
    totalCount,
    options,
    CLAIM_STATUS,
    POLICY_STATUS,
    claimStatusBadge,
    policyStatusBadge,
    payTypeLabel,
    subTabs
  };
})();

window.SandboxUtil = SandboxUtil;
