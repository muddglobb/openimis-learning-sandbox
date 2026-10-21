// ============================================================
// Medical Pricelist (items & services) — read + create
// ============================================================
const PricelistModule = (function () {
  let activeTab = 'items';
  let itemsCache = [];
  let servicesCache = [];

  function switchTab(tab) {
    activeTab = tab;
    ['items', 'services'].forEach(t => {
      const btn = document.getElementById(`pl-tab-${t}`);
      if (!btn) return;
      btn.className = t === activeTab
        ? 'px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 text-white shadow-sm'
        : 'px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white text-slate-600 hover:bg-slate-50 shadow-sm';
    });
    render();
  }

  async function load() {
    const container = document.getElementById('pricelist-content-box');
    if (!container) return;
    container.innerHTML = `<div class="p-8 text-center text-slate-500 text-xs">
      <span class="animate-spin inline-block w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full"></span>
      Memuat pricelist...</div>`;

    try {
      const [itemsConn, servicesConn] = await Promise.all([
        OpenIMISApi.getItemsPricelists(25).catch(() => null),
        OpenIMISApi.getServicesPricelists(25).catch(() => null)
      ]);
      itemsCache = itemsConn ? SandboxUtil.nodes(itemsConn) : [];
      servicesCache = servicesConn ? SandboxUtil.nodes(servicesConn) : [];
      render();
    } catch (e) {
      container.innerHTML = `<div class="p-8 text-center text-red-600 text-xs">Gagal: ${SandboxUtil.esc(e.message)}</div>`;
    }
  }

  function render() {
    const container = document.getElementById('pricelist-content-box');
    if (!container) return;

    const data = activeTab === 'items' ? itemsCache : servicesCache;
    const entityKey = activeTab === 'items' ? 'item' : 'service';

    if (!data.length) {
      container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">
        Belum ada pricelist ${activeTab === 'items' ? 'obat' : 'tindakan'}.
        <button onclick="PricelistModule.openCreate()" class="ml-2 text-sky-600 underline">Buat sekarang</button>
      </div>`;
      return;
    }

    container.innerHTML = `<div class="divide-y divide-slate-100">
      ${data.map(pl => {
        // `details` is a Relay connection; each entry exposes priceOverrule.
        const details = (pl.details && pl.details.edges ? pl.details.edges.map(e => e.node) : []);
        return `<div class="p-3">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="font-semibold text-slate-800 text-[11px]">${SandboxUtil.esc(pl.name)}</div>
              <div class="text-[10px] text-slate-500">
                Tanggal: ${SandboxUtil.dateOnly(pl.pricelistDate)}
                ${pl.location ? ` · Wilayah: ${SandboxUtil.esc(pl.location.name)}` : ' · Global'}
                · ${details.length} entri
              </div>
            </div>
            <span class="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9.5px] font-mono">
              ${SandboxUtil.esc((pl.uuid || '').slice(0, 8))}…
            </span>
          </div>
          ${details.length ? `<div class="mt-2 grid grid-cols-2 md:grid-cols-3 gap-1">
            ${details.slice(0, 9).map(d => {
              const ent = d[entityKey] || {};
              return `<div class="flex justify-between p-1.5 bg-slate-50 rounded text-[10px]">
                <span class="truncate">${SandboxUtil.esc(ent.name || '-')}</span>
                <span class="font-mono text-slate-600 ml-2">${SandboxUtil.money(d.priceOverrule)}</span>
              </div>`;
            }).join('')}
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  }

  function openCreate() {
    const isItems = activeTab === 'items';
    const label = isItems ? 'Obat' : 'Tindakan';
    const mutation = isItems ? 'createItemsPricelist' : 'createServicesPricelist';

    AppModal.open(`Buat Pricelist ${label}`, `
      <form onsubmit="PricelistModule.submitCreate(event)" class="space-y-3 text-[11px]">
        <div class="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-[10.5px] text-sky-900">
          Memanggil <code class="font-mono">${mutation}</code>. Pricelist menentukan harga yang
          dipakai saat klaim dihitung — tanpa pricelist, adjudikasi akan memakai harga default.
        </div>
        ${UiKit.field('Nama Pricelist', UiKit.input('pl-name', {
          value: `PL ${label} ${new Date().getFullYear()}`,
          required: true
        }))}
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Tanggal Berlaku', UiKit.input('pl-date', { type: 'date', value: SandboxUtil.today(), required: true }))}
          ${UiKit.field('Location ID', UiKit.input('pl-location', { type: 'number', value: '1', hint: '' }))}
        </div>
        ${UiKit.formFooter('Simpan Pricelist', 'pl-btn-submit')}
      </form>`);
  }

  async function submitCreate(e) {
    e.preventDefault();
    const input = {
      clientMutationId: 'create-pricelist-' + Date.now(),
      name: SandboxUtil.val('pl-name').trim(),
      pricelistDate: SandboxUtil.val('pl-date'),
      locationId: Number(SandboxUtil.val('pl-location') || 1)
    };

    await UiKit.busy('pl-btn-submit', 'Menyimpan...', async () => {
      try {
        if (activeTab === 'items') await OpenIMISApi.createItemsPricelist(input);
        else await OpenIMISApi.createServicesPricelist(input);
        SandboxUtil.toast('Pricelist dibuat', 'success');
        AppModal.close();
        await load();
      } catch (err) {
        SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
      }
    });
  }

  return { load, switchTab, openCreate, submitCreate };
})();

window.PricelistModule = PricelistModule;
