// ============================================================
// Main application shell: toast, modal, router, auth bootstrap
// ============================================================

const AppToast = {
  show(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `toast-enter flex items-start gap-2.5 p-3.5 rounded-xl shadow-lg border text-xs font-medium max-w-sm ${
      type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
      type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
      type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
      'bg-slate-900 border-slate-800 text-white'
    }`;

    const icon = type === 'success' ? 'check-circle-2' :
                 type === 'error' ? 'alert-triangle' :
                 type === 'warning' ? 'alert-circle' : 'info';

    el.innerHTML = `
      <i data-lucide="${icon}" class="w-4 h-4 flex-shrink-0 mt-0.5"></i>
      <span class="flex-1 leading-relaxed">${SandboxUtil.esc(message)}</span>
    `;

    container.appendChild(el);
    SandboxUtil.refreshIcons();

    setTimeout(() => {
      el.classList.remove('toast-enter');
      el.classList.add('toast-exit');
      setTimeout(() => el.remove(), 300);
    }, duration);
  }
};
window.AppToast = AppToast;

// ------------------------------------------------------------
// Modal
// ------------------------------------------------------------
const AppModal = {
  /**
   * @param {string} title
   * @param {string} htmlContent
   * @param {object} opts { wide:boolean }
   */
  open(title, htmlContent, opts = {}) {
    const modal = document.getElementById('app-modal');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const panel = document.getElementById('modal-panel');

    if (!modal || !titleEl || !bodyEl) return;

    titleEl.innerText = title;
    bodyEl.innerHTML = htmlContent;

    if (panel) {
      panel.className = opts.wide
        ? 'bg-white rounded-2xl w-full max-w-4xl p-6 shadow-2xl space-y-4 border border-slate-200'
        : 'bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 border border-slate-200';
    }

    modal.classList.remove('hidden');
    bodyEl.scrollTop = 0;
    SandboxUtil.refreshIcons();
  },

  close() {
    const modal = document.getElementById('app-modal');
    if (modal) modal.classList.add('hidden');
  },

  /** Confirm dialog that resolves to true/false. */
  confirm(title, message, confirmLabel = 'Ya, lanjutkan') {
    return new Promise(resolve => {
      const html = `
        <div class="space-y-4">
          <p class="text-xs text-slate-600 leading-relaxed">${message}</p>
          <div class="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button id="modal-confirm-no" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Batal</button>
            <button id="modal-confirm-yes" class="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold">${SandboxUtil.esc(confirmLabel)}</button>
          </div>
        </div>`;
      this.open(title, html);
      document.getElementById('modal-confirm-no').onclick = () => { this.close(); resolve(false); };
      document.getElementById('modal-confirm-yes').onclick = () => { this.close(); resolve(true); };
    });
  }
};
window.AppModal = AppModal;

// ------------------------------------------------------------
// Router
// ------------------------------------------------------------
const AppRouter = {
  currentTab: 'simulation',

  navigate(tabName) {
    this.currentTab = tabName;

    document.querySelectorAll('.nav-tab').forEach(el => {
      if (el.getAttribute('data-tab') === tabName) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    document.querySelectorAll('.view-section').forEach(view => {
      if (view.id === `view-${tabName}`) {
        view.classList.remove('hidden');
      } else {
        view.classList.add('hidden');
      }
    });

    const main = document.querySelector('main');
    if (main) main.scrollTop = 0;

    switch (tabName) {
      case 'simulation':      HospitalSimulation.init(); break;
      case 'mobile-jkn':      MobileJknSimulator.init(); break;
      case 'pcare':           PcareSimulator.init(); break;
      case 'patients':        PatientsModule.load(); break;
      case 'families':        FamiliesModule.load(); break;
      case 'claims':          ClaimsModule.load(); break;
      case 'facilities':      FacilitiesModule.load(); break;
      case 'medical':         MedicalModule.load('diagnoses'); break;
      case 'pricelist':       PricelistModule.load(); break;
      case 'policies':        PoliciesModule.load(); break;
      case 'finance':         FinanceModule.load(); break;
      case 'tickets':         TicketsModule.load(); break;
      case 'fhir':            FhirModule.load('Patient'); break;
      case 'api-explorer':    ApiExplorerModule.init(); break;
      case 'api-catalog':     ApiCatalogModule.load(); break;
      default: break;
    }

    setTimeout(() => SandboxUtil.refreshIcons(), 60);
  }
};
window.AppRouter = AppRouter;

// ------------------------------------------------------------
// Bootstrap
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  SandboxUtil.refreshIcons();

  document.querySelectorAll('.nav-tab').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const tab = el.getAttribute('data-tab');
      if (tab) AppRouter.navigate(tab);
    });
  });

  // Close modal on backdrop click / Escape
  const modal = document.getElementById('app-modal');
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) AppModal.close();
    });
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') AppModal.close();
  });

  updateHealthStatus();
  setInterval(updateHealthStatus, 30000);

  OpenIMISApi.on((event, data) => {
    if (event === 'history_updated') renderHistoryItem(data);
    else if (event === 'auth_state_changed') {
      updateUserBadge();
      if (data && data.refreshed) {
        AppToast.show('Sesi diperpanjang otomatis', 'info', 2000);
      } else if (data && data.expired) {
        AppToast.show('Sesi berakhir. Silakan login kembali.', 'warning', 6000);
        showLoginModal();
      }
    }
  });

  // Keep the "token valid for X" readout ticking.
  setInterval(updateUserBadge, 15000);

  // Proactively renew the JWT before it lapses, so a tab left open overnight
  // doesn't fail on the first click. Runs every minute.
  setInterval(async () => {
    if (!OpenIMISApi.isAuthenticated()) return;
    const secs = OpenIMISApi.tokenSecondsLeft();
    if (secs === null) return;
    if (secs < 120) {
      try {
        await OpenIMISApi.reauthenticate();
        updateUserBadge();
      } catch (e) { /* silent — the reactive path will handle it later */ }
    }
  }, 60000);

  await checkAuthAndInit();
});

async function updateHealthStatus() {
  const badge = document.getElementById('health-badge');
  const dot = document.getElementById('health-dot');
  const text = document.getElementById('health-text');
  if (!badge) return;

  const res = await OpenIMISApi.checkHealth();

  if (res.openimis === 'connected') {
    badge.className = 'flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200';
    dot.className = 'w-2 h-2 rounded-full bg-emerald-500';
    text.innerText = 'OpenIMIS Terhubung';
  } else {
    badge.className = 'flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200';
    dot.className = 'w-2 h-2 rounded-full bg-red-500';
    text.innerText = 'OpenIMIS Terputus';
  }
}

async function checkAuthAndInit() {
  if (!OpenIMISApi.isAuthenticated()) {
    // Reuse the last known account, falling back to the demo Admin.
    const saved = OpenIMISApi.getCredentials();
    const username = saved ? saved.username : 'Admin';
    try {
      await OpenIMISApi.login(username, username === 'Admin' ? 'admin123' : undefined);
      AppToast.show(`Login otomatis sebagai ${username} berhasil`, 'success');
    } catch (e) {
      if (saved) {
        // Stored account no longer works — fall back to the demo account once.
        try {
          await OpenIMISApi.login('Admin', 'admin123');
          AppToast.show('Login otomatis sebagai Admin berhasil', 'success');
        } catch (e2) {
          AppToast.show('Gagal login otomatis. Pastikan OpenIMIS berjalan.', 'warning', 6000);
        }
      } else {
        AppToast.show('Gagal login otomatis. Pastikan OpenIMIS berjalan.', 'warning', 6000);
      }
    }
  }
  updateUserBadge();
  AppRouter.navigate('simulation');
}

function updateUserBadge() {
  const user = OpenIMISApi.getCurrentUser();
  const nameEl = document.getElementById('user-display-name');
  const tokenEl = document.getElementById('inspect-token-text');
  const sessionEl = document.getElementById('inspect-session-status');

  if (nameEl) {
    const label = user
      ? (user.otherNames || user.lastName
          ? `${user.otherNames || ''} ${user.lastName || ''}`.trim()
          : user.username)
      : 'Belum Login';
    nameEl.innerText = label || 'Admin';
  }
  if (tokenEl) {
    tokenEl.value = OpenIMISApi.getToken() || 'Tidak ada token JWT';
  }
  if (sessionEl) {
    const secs = OpenIMISApi.tokenSecondsLeft();
    if (secs === null) {
      sessionEl.className = 'text-[10px] font-mono text-slate-500';
      sessionEl.innerText = 'Masa berlaku token: tidak diketahui';
    } else if (secs <= 0) {
      sessionEl.className = 'text-[10px] font-mono text-red-400';
      sessionEl.innerText = 'Token kedaluwarsa — akan diperbarui otomatis';
    } else {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      sessionEl.className = secs < 60
        ? 'text-[10px] font-mono text-amber-400'
        : 'text-[10px] font-mono text-emerald-400';
      sessionEl.innerText = `Token berlaku ${m}m ${s}s lagi (auto-refresh)`;
    }
  }
}

function showLoginModal() {
  const content = `
    <form id="modal-login-form" onsubmit="handleModalLogin(event)" class="space-y-4 text-xs">
      <div class="p-3 bg-sky-50 border border-sky-200 rounded-lg text-[11px] text-sky-900 leading-relaxed">
        Login memakai mutation <code class="font-mono">tokenAuth</code>. Token JWT yang dikembalikan
        disisipkan ke setiap request berikutnya sebagai
        <code class="font-mono">Authorization: Bearer &lt;token&gt;</code>.
      </div>
      <div>
        <label class="block font-semibold text-slate-700 mb-1">Username</label>
        <input type="text" id="login-username" value="Admin" required
          class="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:outline-none">
      </div>
      <div>
        <label class="block font-semibold text-slate-700 mb-1">Password</label>
        <input type="password" id="login-password" value="admin123" required
          class="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:outline-none">
      </div>
      <p class="text-slate-500">Akun demo: <code>Admin / admin123</code></p>
      <div class="flex justify-between items-center pt-2 border-t border-slate-100">
        <button type="button" onclick="GraphQLHelp.open('auth')" class="text-[11px] text-sky-600 hover:underline">
          Bagaimana autentikasi bekerja?
        </button>
        <button type="submit" class="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold shadow">
          Masuk
        </button>
      </div>
    </form>
  `;
  AppModal.open('Login OpenIMIS', content);
}

async function handleModalLogin(e) {
  e.preventDefault();
  const u = document.getElementById('login-username').value;
  const p = document.getElementById('login-password').value;

  try {
    await OpenIMISApi.login(u, p);
    AppToast.show(`Selamat datang, ${u}`, 'success');
    AppModal.close();
    AppRouter.navigate(AppRouter.currentTab);
  } catch (err) {
    AppToast.show(`Login gagal: ${err.message}`, 'error', 6000);
  }
}

async function logoutSandbox() {
  const ok = await AppModal.confirm(
    'Keluar dari Sandbox',
    'Token JWT akan dihapus dari browser. Kamu bisa login kembali kapan saja.',
    'Keluar'
  );
  if (!ok) return;
  OpenIMISApi.logout();
  AppToast.show('Berhasil keluar', 'info');
  showLoginModal();
}

// ------------------------------------------------------------
// Inspector drawer
// ------------------------------------------------------------
function toggleInspectorDrawer() {
  const drawer = document.getElementById('inspector-drawer');
  if (drawer) drawer.classList.toggle('translate-x-full');
}

function renderHistoryItem(item) {
  const list = document.getElementById('inspector-history-list');
  if (!list) return;

  const el = document.createElement('div');
  el.className = `p-3 rounded-lg border text-xs space-y-1 ${
    item.status === 'success'
      ? 'bg-slate-800 border-slate-700 text-slate-200'
      : 'bg-red-950/40 border-red-800 text-red-200'
  }`;

  el.innerHTML = `
    <div class="flex justify-between items-center text-[10px] text-slate-400 font-mono">
      <span>${SandboxUtil.esc(item.type)} | ${SandboxUtil.esc(item.time)}</span>
      <span class="${item.status === 'success' ? 'text-emerald-400' : 'text-red-400'}">${item.status.toUpperCase()}</span>
    </div>
    <div class="font-semibold text-white text-[11px]">${SandboxUtil.esc(item.title)}</div>
    <details class="text-[10px] font-mono text-slate-300">
      <summary class="cursor-pointer text-sky-400 hover:underline">Payload &amp; Respons</summary>
      <div class="mt-2 p-2 bg-slate-950 rounded text-slate-300 max-h-48 overflow-y-auto">
        <div class="text-[9px] text-slate-500 font-bold">REQUEST</div>
        <pre class="text-[9px] whitespace-pre-wrap">${SandboxUtil.esc(JSON.stringify(item.payload, null, 2))}</pre>
        <div class="text-[9px] text-slate-500 font-bold mt-2">RESPONSE</div>
        <pre class="text-[9px] whitespace-pre-wrap">${SandboxUtil.esc(JSON.stringify(item.response || item.error, null, 2))}</pre>
      </div>
    </details>
  `;

  list.insertBefore(el, list.firstChild);
}

function copyJwtToken() {
  const token = OpenIMISApi.getToken();
  if (token) {
    navigator.clipboard.writeText(token);
    AppToast.show('Token JWT disalin', 'success');
  }
}

/** Manually renew the JWT from the inspector drawer. */
async function forceRefreshToken() {
  try {
    await OpenIMISApi.reauthenticate();
    updateUserBadge();
    AppToast.show('Token berhasil diperpanjang', 'success', 2500);
  } catch (e) {
    AppToast.show(`Gagal memperpanjang token: ${e.message}`, 'error', 6000);
    showLoginModal();
  }
}

// ------------------------------------------------------------
// Small shared UI helpers used by several modules
// ------------------------------------------------------------
const UiKit = {
  /** Standard page header with optional actions and a help button. */
  header(title, subtitle, actionsHtml = '', helpTab = null) {
    return `<div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div class="flex items-start gap-2">
        <div>
          <h2 class="text-base font-bold text-slate-900">${title}</h2>
          <p class="text-xs text-slate-500">${subtitle}</p>
        </div>
        ${helpTab ? `<button onclick="GraphQLHelp.open('${helpTab}')" title="Cara kerja GraphQL"
          class="w-6 h-6 rounded-full bg-slate-100 hover:bg-sky-100 text-slate-500 hover:text-sky-700 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">?</button>` : ''}
      </div>
      <div class="flex flex-wrap items-center gap-2">${actionsHtml}</div>
    </div>`;
  },

  /** "Lihat GraphQL" button that replays the last operation. */
  graphqlButton(label = 'Lihat GraphQL', notes = '') {
    return `<button onclick="GraphQLHelp.previewLast('Operasi GraphQL Terakhir', ${JSON.stringify(notes)})"
      class="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-300 rounded-lg text-[11px] font-mono font-semibold flex items-center gap-1.5">
      <i data-lucide="code-2" class="w-3.5 h-3.5"></i>${label}
    </button>`;
  },

  /** Table wrapper. */
  table(headers, bodyId, widths = []) {
    return `<div class="overflow-x-auto rounded-xl border border-slate-200">
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
          <tr>${headers.map((h, i) => `<th class="p-3 ${widths[i] || ''}">${h}</th>`).join('')}</tr>
        </thead>
        <tbody id="${bodyId}"></tbody>
      </table>
    </div>`;
  },

  /** Badge. */
  badge(text, tone = 'slate') {
    const tones = {
      slate: 'bg-slate-100 text-slate-700',
      sky: 'bg-sky-100 text-sky-800',
      emerald: 'bg-emerald-100 text-emerald-800',
      amber: 'bg-amber-100 text-amber-800',
      red: 'bg-red-100 text-red-800',
      purple: 'bg-purple-100 text-purple-800',
      blue: 'bg-blue-100 text-blue-800',
      rose: 'bg-rose-100 text-rose-800'
    };
    return `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${tones[tone] || tones.slate}">${SandboxUtil.esc(text)}</span>`;
  },

  /** Small ghost action button. */
  action(label, onclick, tone = 'slate') {
    const tones = {
      slate: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
      sky: 'bg-sky-50 hover:bg-sky-100 text-sky-700',
      emerald: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700',
      amber: 'bg-amber-50 hover:bg-amber-100 text-amber-800',
      red: 'bg-red-50 hover:bg-red-100 text-red-700'
    };
    return `<button onclick="${onclick}" class="px-2.5 py-1 rounded-md text-[11px] font-medium ${tones[tone] || tones.slate}">${SandboxUtil.esc(label)}</button>`;
  },

  /** Form field wrapper. */
  field(label, innerHtml, hint = '') {
    return `<div>
      <label class="block font-semibold text-slate-700 mb-1 text-[11px]">${label}</label>
      ${innerHtml}
      ${hint ? `<p class="text-[10px] text-slate-400 mt-0.5">${hint}</p>` : ''}
    </div>`;
  },

  input(id, opts = {}) {
    const attrs = [
      `id="${id}"`,
      `type="${opts.type || 'text'}"`,
      opts.value !== undefined ? `value="${SandboxUtil.esc(opts.value)}"` : '',
      opts.placeholder ? `placeholder="${SandboxUtil.esc(opts.placeholder)}"` : '',
      opts.required ? 'required' : '',
      opts.maxlength ? `maxlength="${opts.maxlength}"` : '',
      opts.readonly ? 'readonly' : '',
      opts.disabled ? 'disabled' : '',
      opts.min !== undefined ? `min="${opts.min}"` : '',
      opts.step !== undefined ? `step="${opts.step}"` : ''
    ].filter(Boolean).join(' ');
    return `<input ${attrs} class="w-full p-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none ${opts.extraClass || ''}">`;
  },

  select(id, optionsHtml, opts = {}) {
    return `<select id="${id}" ${opts.required ? 'required' : ''}
      class="w-full p-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none">
      ${optionsHtml}
    </select>`;
  },

  textarea(id, opts = {}) {
    return `<textarea id="${id}" rows="${opts.rows || 3}"
      placeholder="${SandboxUtil.esc(opts.placeholder || '')}"
      class="w-full p-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none">${SandboxUtil.esc(opts.value || '')}</textarea>`;
  },

  /** Modal footer with cancel + submit. */
  formFooter(submitLabel, submitId, onSubmitAttr) {
    return `<div class="pt-3 border-t border-slate-100 flex justify-between items-center gap-2">
      <button type="button" onclick="GraphQLHelp.previewLast('GraphQL untuk Form Ini')"
        class="text-[11px] text-slate-500 hover:text-sky-600 underline">Lihat GraphQL</button>
      <div class="flex gap-2">
        <button type="button" onclick="AppModal.close()" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium">Batal</button>
        <button type="submit" id="${submitId}" class="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold shadow">
          ${SandboxUtil.esc(submitLabel)}
        </button>
      </div>
    </div>`;
  },

  /** Disable a button while an async action runs. */
  async busy(buttonId, busyLabel, fn) {
    const btn = document.getElementById(buttonId);
    const original = btn ? btn.innerHTML : null;
    if (btn) { btn.disabled = true; btn.innerHTML = busyLabel; }
    try {
      return await fn();
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = original; }
    }
  }
};

window.UiKit = UiKit;
