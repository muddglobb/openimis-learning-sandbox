// ============================================================
// GraphQL Playground v2
// - query editor + variables editor + response panel
// - template library grouped by module
// - live schema browser (introspection)
// - history + saved queries (localStorage)
// ============================================================
const ApiExplorerModule = (function () {
  const SAVED_KEY = 'openimis_saved_queries';
  let schemaCache = null;
  let schemaFilter = '';
  let activeTemplateGroup = 'core';
  let lastResult = null;
  let lastVariables = null;

  // ---------------------------------------------------------
  // Templates: derived from the static API catalog
  // ---------------------------------------------------------
  function templateGroups() {
    const groups = {};
    ApiCatalog.OPERATIONS.forEach(op => {
      if (!groups[op.module]) groups[op.module] = [];
      groups[op.module].push(op);
    });
    return groups;
  }

  function renderTemplateBar() {
    const groups = templateGroups();
    const keys = Object.keys(groups);
    const bar = document.getElementById('gql-template-bar');
    const list = document.getElementById('gql-template-list');
    if (!bar || !list) return;

    bar.innerHTML = keys.map(k => `
      <button onclick="ApiExplorerModule.selectTemplateGroup('${k}')"
        class="px-2.5 py-1 text-[10.5px] rounded-md font-mono whitespace-nowrap ${k === activeTemplateGroup
          ? 'bg-sky-600 text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
        ${SandboxUtil.esc(ApiCatalog.moduleLabel(k))}
      </button>`).join('');

    const ops = groups[activeTemplateGroup] || [];
    list.innerHTML = ops.map((op, idx) => `
      <button onclick="ApiExplorerModule.useTemplate('${op.module}','${SandboxUtil.jsStr(op.name)}')"
        class="w-full text-left px-2.5 py-1.5 rounded-md text-[10.5px] font-mono flex items-center gap-2 ${idx % 2 ? 'bg-slate-50' : ''} hover:bg-sky-50">
        <span class="px-1 py-0.5 rounded text-[9px] font-bold ${op.kind === 'mutation'
          ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
          ${op.kind === 'mutation' ? 'MUT' : 'QRY'}
        </span>
        <span class="text-slate-700 truncate">${SandboxUtil.esc(op.name)}</span>
        ${op.status === 'ui' ? '<span class="ml-auto text-[9px] text-emerald-600">dipakai</span>' : ''}
      </button>`).join('');
  }

  function selectTemplateGroup(key) {
    activeTemplateGroup = key;
    renderTemplateBar();
  }

  function useTemplate(moduleKey, name) {
    const op = ApiCatalog.OPERATIONS.find(o => o.module === moduleKey && o.name === name);
    if (!op) return;
    setQuery(op.example, op.variables || {});
    SandboxUtil.toast(`Template "${op.name}" dimuat`, 'info', 1800);
  }

  function setQuery(query, variables) {
    const editor = document.getElementById('gql-editor');
    const vars = document.getElementById('gql-variables');
    if (editor) editor.value = query;
    if (vars) vars.value = JSON.stringify(variables || {}, null, 2);
  }

  // ---------------------------------------------------------
  // Execute
  // ---------------------------------------------------------
  async function execute() {
    const editor = document.getElementById('gql-editor');
    const varsEditor = document.getElementById('gql-variables');
    const output = document.getElementById('gql-output');
    const status = document.getElementById('gql-status');
    const btn = document.getElementById('gql-btn-run');

    if (!editor || !output) return;

    const query = editor.value.trim();
    if (!query) {
      SandboxUtil.toast('Query GraphQL tidak boleh kosong', 'error');
      return;
    }

    let variables = {};
    const rawVars = varsEditor ? varsEditor.value.trim() : '';
    if (rawVars) {
      try {
        variables = JSON.parse(rawVars);
      } catch (e) {
        output.innerHTML = `<span class="text-red-400">Variables bukan JSON yang valid:\n${SandboxUtil.esc(e.message)}</span>`;
        if (status) {
          status.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-red-100 text-red-700';
          status.innerText = 'VARIABLES INVALID';
        }
        return;
      }
    }

    lastVariables = variables;
    if (btn) { btn.disabled = true; btn.innerText = 'Menjalankan...'; }
    output.innerHTML = `<span class="text-slate-400">Mengirim request ke /api/graphql ...</span>`;
    if (status) {
      status.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600';
      status.innerText = 'RUNNING';
    }

    const started = performance.now();
    try {
      const data = await OpenIMISApi.graphql(query, variables, 'Playground Query');
      lastResult = data;
      const ms = Math.round(performance.now() - started);
      output.innerText = JSON.stringify(data, null, 2);
      if (status) {
        status.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-700';
        status.innerText = `200 OK · ${ms} ms`;
      }
      SandboxUtil.toast('Query berhasil', 'success', 1600);
    } catch (err) {
      lastResult = null;
      const payload = err.graphqlErrors
        ? JSON.stringify({ errors: err.graphqlErrors }, null, 2)
        : `Error:\n${err.message}`;
      output.innerText = payload;
      if (status) {
        status.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-red-100 text-red-700';
        status.innerText = 'ERROR';
      }
      SandboxUtil.toast('Query menghasilkan error', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = 'Jalankan (Ctrl+Enter)'; }
    }
  }

  // ---------------------------------------------------------
  // Schema browser
  // ---------------------------------------------------------
  async function loadSchema(force = false) {
    const panel = document.getElementById('gql-schema-panel');
    if (!panel) return;

    if (schemaCache && !force) {
      renderSchema();
      return;
    }

    panel.innerHTML = `<div class="p-4 text-center text-slate-500 text-[11px]">
      <span class="inline-flex items-center gap-2">
        <span class="animate-spin w-3 h-3 border-2 border-sky-600 border-t-transparent rounded-full"></span>
        Mengambil skema via introspection...
      </span>
    </div>`;

    try {
      schemaCache = await OpenIMISApi.introspectSchema();
      renderSchema();
      SandboxUtil.toast('Skema berhasil dimuat', 'success', 1800);
    } catch (e) {
      panel.innerHTML = `<div class="p-4 text-[11px] text-red-600">
        Gagal memuat skema: ${SandboxUtil.esc(e.message)}
        <button onclick="ApiExplorerModule.loadSchema(true)" class="block mt-2 text-sky-600 underline">Coba lagi</button>
      </div>`;
    }
  }

  function renderSchema() {
    const panel = document.getElementById('gql-schema-panel');
    if (!panel || !schemaCache) return;

    const rootQuery = schemaCache.queryType ? schemaCache.queryType.name : 'Query';
    const rootMutation = schemaCache.mutationType ? schemaCache.mutationType.name : 'Mutation';

    const rootTypes = schemaCache.types.filter(t => t.name === rootQuery || t.name === rootMutation);
    const otherTypes = schemaCache.types
      .filter(t => !t.name.startsWith('__') && t.name !== rootQuery && t.name !== rootMutation)
      .filter(t => !schemaFilter || t.name.toLowerCase().includes(schemaFilter.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));

    panel.innerHTML = `
      <div class="p-2 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
        <input type="text" value="${SandboxUtil.esc(schemaFilter)}"
          oninput="ApiExplorerModule.filterSchema(this.value)"
          placeholder="Cari tipe..."
          class="w-full p-1.5 border border-slate-300 rounded-md text-[11px] focus:ring-2 focus:ring-sky-500 focus:outline-none">
      </div>
      <div class="p-2 space-y-1">
        ${rootTypes.map(t => renderType(t, true)).join('')}
        ${otherTypes.slice(0, 300).map(t => renderType(t, false)).join('')}
        ${otherTypes.length > 300 ? `<div class="p-2 text-[10px] text-slate-400">Menampilkan 300 dari ${otherTypes.length} tipe. Gunakan pencarian untuk mempersempit.</div>` : ''}
      </div>
    `;
  }

  function typeLabel(type) {
    if (!type) return '?';
    if (type.kind === 'NON_NULL') return `${typeLabel(type.ofType)}!`;
    if (type.kind === 'LIST') return `[${typeLabel(type.ofType)}]`;
    return type.name || '?';
  }

  function renderType(type, expanded) {
    const fields = type.fields || [];
    const inputFields = type.inputFields || [];
    const enumValues = type.enumValues || [];
    const count = fields.length || inputFields.length || enumValues.length;

    return `<details class="border border-slate-200 rounded-md overflow-hidden" ${expanded ? 'open' : ''}>
      <summary class="px-2 py-1.5 cursor-pointer bg-slate-50 hover:bg-slate-100 text-[11px] font-mono font-semibold text-slate-700 flex items-center gap-2">
        <span class="text-sky-700">${SandboxUtil.esc(type.name)}</span>
        <span class="text-[9px] text-slate-400 font-sans">${type.kind}</span>
        <span class="ml-auto text-[9px] text-slate-400">${count}</span>
      </summary>
      <div class="divide-y divide-slate-100 max-h-64 overflow-y-auto">
        ${fields.map(f => `
          <div class="px-2 py-1 text-[10px] font-mono flex items-start gap-1.5 hover:bg-sky-50 cursor-pointer"
               onclick="ApiExplorerModule.insertField('${SandboxUtil.jsStr(f.name)}')">
            <span class="text-slate-800">${SandboxUtil.esc(f.name)}</span>
            ${f.args && f.args.length ? `<span class="text-slate-400">(${f.args.map(a => SandboxUtil.esc(a.name)).join(', ')})</span>` : ''}
            <span class="ml-auto text-purple-600 text-[9px]">${SandboxUtil.esc(typeLabel(f.type))}</span>
          </div>`).join('')}
        ${inputFields.map(f => `
          <div class="px-2 py-1 text-[10px] font-mono flex items-start gap-1.5">
            <span class="text-slate-800">${SandboxUtil.esc(f.name)}</span>
            <span class="ml-auto text-amber-600 text-[9px]">${SandboxUtil.esc(typeLabel(f.type))}</span>
          </div>`).join('')}
        ${enumValues.map(v => `
          <div class="px-2 py-1 text-[10px] font-mono text-slate-600">${SandboxUtil.esc(v.name)}</div>`).join('')}
      </div>
    </details>`;
  }

  function filterSchema(value) {
    schemaFilter = value;
    renderSchema();
  }

  function insertField(fieldName) {
    const editor = document.getElementById('gql-editor');
    if (!editor) return;
    const pos = editor.selectionStart || editor.value.length;
    editor.value = editor.value.slice(0, pos) + fieldName + editor.value.slice(pos);
    editor.focus();
    editor.selectionStart = editor.selectionEnd = pos + fieldName.length;
    SandboxUtil.toast(`"${fieldName}" disisipkan`, 'info', 1400);
  }

  // ---------------------------------------------------------
  // Saved queries
  // ---------------------------------------------------------
  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    } catch (e) { return []; }
  }

  function saveCurrent() {
    const editor = document.getElementById('gql-editor');
    const vars = document.getElementById('gql-variables');
    if (!editor || !editor.value.trim()) {
      SandboxUtil.toast('Tidak ada query untuk disimpan', 'warning');
      return;
    }
    const name = prompt('Nama query yang disimpan:', 'Query ' + new Date().toLocaleString('id-ID'));
    if (!name) return;

    const saved = loadSaved();
    saved.unshift({
      id: Date.now(),
      name,
      query: editor.value,
      variables: vars ? vars.value : '{}'
    });
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved.slice(0, 30)));
    renderSaved();
    SandboxUtil.toast('Query disimpan', 'success', 1800);
  }

  function renderSaved() {
    const box = document.getElementById('gql-saved-list');
    if (!box) return;
    const saved = loadSaved();
    if (!saved.length) {
      box.innerHTML = `<div class="text-[10px] text-slate-400 p-2">Belum ada query tersimpan.</div>`;
      return;
    }
    box.innerHTML = saved.map(s => `
      <div class="flex items-center gap-1 p-1.5 rounded hover:bg-slate-100">
        <button onclick="ApiExplorerModule.loadSavedItem(${s.id})"
          class="flex-1 text-left text-[10.5px] font-mono text-slate-700 truncate">${SandboxUtil.esc(s.name)}</button>
        <button onclick="ApiExplorerModule.deleteSavedItem(${s.id})" class="text-red-400 hover:text-red-600 text-[10px]">✕</button>
      </div>`).join('');
  }

  function loadSavedItem(id) {
    const item = loadSaved().find(s => s.id === id);
    if (!item) return;
    const editor = document.getElementById('gql-editor');
    const vars = document.getElementById('gql-variables');
    if (editor) editor.value = item.query;
    if (vars) vars.value = item.variables || '{}';
    SandboxUtil.toast(`"${item.name}" dimuat`, 'info', 1600);
  }

  function deleteSavedItem(id) {
    const saved = loadSaved().filter(s => s.id !== id);
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    renderSaved();
  }

  // ---------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------
  function formatQuery() {
    const editor = document.getElementById('gql-editor');
    if (!editor) return;
    editor.value = prettyGraphQL(editor.value);
    SandboxUtil.toast('Query diformat', 'info', 1400);
  }

  function prettyGraphQL(src) {
    // Light indenter: tracks brace depth, ignores braces inside strings.
    let out = '';
    let depth = 0;
    let inString = false;
    let prevChar = '';
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === '"' && prevChar !== '\\') inString = !inString;

      if (!inString && ch === '{') {
        depth++;
        out += ' {\n' + '  '.repeat(depth);
        prevChar = ch;
        continue;
      }
      if (!inString && ch === '}') {
        depth = Math.max(0, depth - 1);
        out = out.replace(/[ \t]+$/, '');
        out += '\n' + '  '.repeat(depth) + '}';
        prevChar = ch;
        continue;
      }
      if (!inString && ch === '\n') {
        out = out.replace(/[ \t]+$/, '');
        out += '\n' + '  '.repeat(depth);
        prevChar = ch;
        continue;
      }
      if (!inString && /\s/.test(ch) && /\s/.test(prevChar)) {
        prevChar = ch;
        continue;
      }
      out += ch;
      prevChar = ch;
    }
    return out.trim();
  }

  function copyQuery() {
    const editor = document.getElementById('gql-editor');
    if (editor) {
      navigator.clipboard.writeText(editor.value);
      SandboxUtil.toast('Query disalin', 'success', 1600);
    }
  }

  function copyVariables() {
    const vars = document.getElementById('gql-variables');
    if (vars) {
      navigator.clipboard.writeText(vars.value);
      SandboxUtil.toast('Variables disalin', 'success', 1600);
    }
  }

  function copyAsCurl() {
    const editor = document.getElementById('gql-editor');
    const vars = document.getElementById('gql-variables');
    if (!editor) return;
    let variables = {};
    try { variables = JSON.parse(vars.value || '{}'); } catch (e) { variables = {}; }
    const body = JSON.stringify({ query: editor.value, variables });
    const curl = `curl -X POST "${window.location.origin}/api/graphql" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $OPENIMIS_TOKEN" \\
  -d '${body.replace(/'/g, "'\\''")}'`;
    navigator.clipboard.writeText(curl);
    SandboxUtil.toast('cURL disalin', 'success', 1600);
  }

  function clearAll() {
    const editor = document.getElementById('gql-editor');
    const vars = document.getElementById('gql-variables');
    const output = document.getElementById('gql-output');
    if (editor) editor.value = '';
    if (vars) vars.value = '{}';
    if (output) output.innerHTML = '<span class="text-slate-400">Hasil query akan ditampilkan di sini...</span>';
  }

  // ---------------------------------------------------------
  // Init
  // ---------------------------------------------------------
  function init() {
    const editor = document.getElementById('gql-editor');
    if (editor && !editor.value) {
      const first = ApiCatalog.OPERATIONS.find(o => o.name === 'insurees');
      editor.value = first ? first.example : '{ __typename }';
    }
    const vars = document.getElementById('gql-variables');
    if (vars && !vars.value) {
      vars.value = JSON.stringify({ first: 10 }, null, 2);
    }
    renderTemplateBar();
    renderSaved();

    // Ctrl+Enter to run
    if (editor && !editor.dataset.bound) {
      editor.dataset.bound = '1';
      editor.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          execute();
        }
        // Tab inserts two spaces instead of moving focus
        if (e.key === 'Tab') {
          e.preventDefault();
          const s = editor.selectionStart;
          editor.value = editor.value.slice(0, s) + '  ' + editor.value.slice(editor.selectionEnd);
          editor.selectionStart = editor.selectionEnd = s + 2;
        }
      });
    }
  }

  /** Called by GraphQLHelp when the user clicks "Buka di Playground". */
  function loadQuery(query, variables) {
    setQuery(query, variables);
    SandboxUtil.toast('Query dimuat ke Playground', 'success', 1800);
  }

  return {
    init,
    execute,
    loadQuery,
    setQuery,
    selectTemplateGroup,
    useTemplate,
    loadSchema,
    filterSchema,
    insertField,
    saveCurrent,
    loadSavedItem,
    deleteSavedItem,
    formatQuery,
    copyQuery,
    copyVariables,
    copyAsCurl,
    clearAll
  };
})();

window.ApiExplorerModule = ApiExplorerModule;
