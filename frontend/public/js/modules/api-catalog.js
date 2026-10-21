// ============================================================
// API Catalog page
// Lists every GraphQL operation + FHIR resource known to the
// sandbox, marks which ones the UI exercises, and lets the user
// jump straight into the Playground.
// ============================================================
const ApiCatalogModule = (function () {
  let filterModule = 'all';
  let filterKind = 'all';
  let filterText = '';

  function statsBar() {
    const s = ApiCatalog.stats();
    return `<div class="grid grid-cols-2 md:grid-cols-6 gap-2">
      ${statCard('Modul', s.modules, 'slate')}
      ${statCard('Query', s.queries, 'emerald')}
      ${statCard('Mutation', s.mutations, 'amber')}
      ${statCard('Total GraphQL', s.totalGraphQL, 'sky')}
      ${statCard('Dipakai UI', s.exercised, 'emerald')}
      ${statCard('Resource FHIR', s.fhir, 'orange')}
    </div>`;
  }

  function statCard(label, value, tone) {
    const tones = {
      slate: 'bg-slate-50 border-slate-200 text-slate-900',
      emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      amber: 'bg-amber-50 border-amber-200 text-amber-900',
      sky: 'bg-sky-50 border-sky-200 text-sky-900',
      orange: 'bg-orange-50 border-orange-200 text-orange-900'
    };
    return `<div class="p-3 rounded-xl border ${tones[tone] || tones.slate}">
      <div class="text-[10px] font-semibold uppercase tracking-wide opacity-70">${label}</div>
      <div class="text-lg font-bold">${value}</div>
    </div>`;
  }

  function renderFilters() {
    const modules = [{ key: 'all', label: 'Semua Modul' }].concat(ApiCatalog.MODULES);
    return `<div class="flex flex-wrap items-center gap-2">
      <select onchange="ApiCatalogModule.setModule(this.value)"
        class="p-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none">
        ${modules.map(m => `<option value="${m.key}" ${m.key === filterModule ? 'selected' : ''}>${SandboxUtil.esc(m.label)}</option>`).join('')}
      </select>
      <select onchange="ApiCatalogModule.setKind(this.value)"
        class="p-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none">
        <option value="all" ${filterKind === 'all' ? 'selected' : ''}>Semua Tipe</option>
        <option value="query" ${filterKind === 'query' ? 'selected' : ''}>Query</option>
        <option value="mutation" ${filterKind === 'mutation' ? 'selected' : ''}>Mutation</option>
      </select>
      <input type="text" value="${SandboxUtil.esc(filterText)}"
        oninput="ApiCatalogModule.setText(this.value)"
        placeholder="Cari nama operasi..."
        class="p-2 border border-slate-300 rounded-lg text-xs w-56 focus:ring-2 focus:ring-sky-500 focus:outline-none">
      <button onclick="GraphQLHelp.open('concept')"
        class="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-emerald-300 rounded-lg text-xs font-semibold">
        ? Cara Kerja GraphQL
      </button>
    </div>`;
  }

  function filtered() {
    return ApiCatalog.OPERATIONS.filter(op => {
      if (filterModule !== 'all' && op.module !== filterModule) return false;
      if (filterKind !== 'all' && op.kind !== filterKind) return false;
      if (filterText) {
        const q = filterText.toLowerCase();
        if (!op.name.toLowerCase().includes(q) &&
            !op.signature.toLowerCase().includes(q) &&
            !op.module.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  function renderOperations() {
    const body = document.getElementById('catalog-table-body');
    if (!body) return;

    const ops = filtered();
    if (!ops.length) {
      body.innerHTML = SandboxUtil.emptyRow(6, 'Tidak ada operasi yang cocok dengan filter.');
      return;
    }

    body.innerHTML = ops.map(op => `
      <tr class="border-b border-slate-100 hover:bg-slate-50/70 align-top">
        <td class="p-2.5">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${op.kind === 'mutation'
            ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
            ${op.kind === 'mutation' ? 'MUT' : 'QRY'}
          </span>
        </td>
        <td class="p-2.5">
          <div class="font-mono font-bold text-sky-700 text-[11px]">${SandboxUtil.esc(op.name)}</div>
          <div class="text-[10px] text-slate-400">${SandboxUtil.esc(ApiCatalog.moduleLabel(op.module))}</div>
        </td>
        <td class="p-2.5">
          <code class="text-[10px] text-slate-600 break-all">${SandboxUtil.esc(op.signature)}</code>
        </td>
        <td class="p-2.5 text-[10.5px] text-slate-600 max-w-xs">${SandboxUtil.esc(op.note)}</td>
        <td class="p-2.5">
          ${op.status === 'ui'
            ? '<span class="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">dipakai UI</span>'
            : '<span class="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">katalog</span>'}
        </td>
        <td class="p-2.5 text-right whitespace-nowrap">
          <button onclick="ApiCatalogModule.tryInPlayground('${op.module}','${SandboxUtil.jsStr(op.name)}')"
            class="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded text-[10.5px] font-medium">Coba</button>
          <button onclick="ApiCatalogModule.showExample('${op.module}','${SandboxUtil.jsStr(op.name)}')"
            class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10.5px] font-medium">Contoh</button>
        </td>
      </tr>`).join('');
  }

  function renderFhir() {
    const body = document.getElementById('catalog-fhir-body');
    if (!body) return;
    body.innerHTML = ApiCatalog.FHIR_RESOURCES.map(r => `
      <tr class="border-b border-slate-100 hover:bg-slate-50/70">
        <td class="p-2.5 font-mono font-bold text-orange-700 text-[11px]">${SandboxUtil.esc(r.name)}</td>
        <td class="p-2.5 text-[10px] text-slate-500">${SandboxUtil.esc(ApiCatalog.moduleLabel(r.module))}</td>
        <td class="p-2.5 text-[10.5px] text-slate-600">${SandboxUtil.esc(r.note)}</td>
        <td class="p-2.5 text-right">
          <button onclick="FhirModule.load('${SandboxUtil.jsStr(r.name)}'); AppRouter.navigate('fhir')"
            class="px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded text-[10.5px] font-medium">Buka</button>
        </td>
      </tr>`).join('');
  }

  function tryInPlayground(moduleKey, name) {
    const op = ApiCatalog.OPERATIONS.find(o => o.module === moduleKey && o.name === name);
    if (!op) return;
    AppRouter.navigate('api-explorer');
    setTimeout(() => ApiExplorerModule.loadQuery(op.example, op.variables || {}), 120);
  }

  function showExample(moduleKey, name) {
    const op = ApiCatalog.OPERATIONS.find(o => o.module === moduleKey && o.name === name);
    if (!op) return;
    GraphQLHelp.preview({
      title: `${op.kind === 'mutation' ? 'Mutation' : 'Query'}: ${op.name}`,
      query: op.example,
      variables: op.variables || {},
      notes: `<strong>${SandboxUtil.esc(ApiCatalog.moduleLabel(op.module))}</strong> — ${SandboxUtil.esc(op.note)}`
    });
  }

  function setModule(v) { filterModule = v; renderOperations(); }
  function setKind(v) { filterKind = v; renderOperations(); }
  function setText(v) { filterText = v; renderOperations(); }

  function load() {
    SandboxUtil.setHTML('catalog-stats', statsBar());
    SandboxUtil.setHTML('catalog-filters', renderFilters());
    renderOperations();
    renderFhir();
    SandboxUtil.refreshIcons();
  }

  return { load, setModule, setKind, setText, tryInPlayground, showExample };
})();

window.ApiCatalogModule = ApiCatalogModule;
