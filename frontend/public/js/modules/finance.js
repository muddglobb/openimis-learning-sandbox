// ============================================================
// Premiums / Contributions — CRUD
// ============================================================
const FinanceModule = (function () {
  let cache = [];
  let policiesCache = [];

  async function load() {
    const container = document.getElementById('premiums-table-body');
    if (!container) return;
    container.innerHTML = SandboxUtil.spinnerRow(7, 'Memuat premi...');

    try {
      const conn = await OpenIMISApi.getPremiums(50);
      cache = SandboxUtil.nodes(conn);
      renderTable(cache, SandboxUtil.totalCount(conn));
    } catch (e) {
      container.innerHTML = SandboxUtil.errorRow(7, `Gagal: ${e.message}`);
    }
  }

  function renderTable(data, total) {
    const container = document.getElementById('premiums-table-body');
    if (!container) return;

    const counter = document.getElementById('premiums-count');
    if (counter) counter.innerText = `${data.length} dari ${total !== undefined ? total : data.length} transaksi`;

    if (!data.length) {
      container.innerHTML = SandboxUtil.emptyRow(7, 'Belum ada pembayaran premi.');
      return;
    }

    const totalAmount = data.reduce((s, p) => s + SandboxUtil.num(p.amount), 0);
    const summary = document.getElementById('premiums-summary');
    if (summary) {
      summary.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
          <div class="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div class="text-[9.5px] text-emerald-700 uppercase">Total Ditampilkan</div>
            <div class="font-mono font-bold text-emerald-800">${SandboxUtil.money(totalAmount)}</div>
          </div>
          <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div class="text-[9.5px] text-slate-500 uppercase">Jumlah Transaksi</div>
            <div class="font-mono font-bold text-slate-800">${data.length}</div>
          </div>
          <div class="p-2.5 bg-sky-50 border border-sky-200 rounded-lg">
            <div class="text-[9.5px] text-sky-700 uppercase">Rata-rata</div>
            <div class="font-mono font-bold text-sky-800">${SandboxUtil.money(data.length ? totalAmount / data.length : 0)}</div>
          </div>
        </div>`;
    }

    container.innerHTML = data.map(p => {
      const prod = p.policy && p.policy.product ? p.policy.product.name : '-';
      const head = p.policy && p.policy.family && p.policy.family.headInsuree
        ? p.policy.family.headInsuree : {};
      return `<tr class="hover:bg-slate-50 border-b border-slate-100">
        <td class="p-2.5 font-mono text-[10px] text-slate-500">${SandboxUtil.esc((p.uuid || '').slice(0, 8))}…</td>
        <td class="p-2.5 text-[11px]">
          <div class="font-semibold text-slate-800">${SandboxUtil.esc(prod)}</div>
          <div class="text-[10px] text-slate-400">${SandboxUtil.esc(head.lastName || '')} ${SandboxUtil.esc(head.chfId ? `(${head.chfId})` : '')}</div>
        </td>
        <td class="p-2.5 text-right font-mono font-bold text-emerald-700 text-[11px]">${SandboxUtil.money(p.amount)}</td>
        <td class="p-2.5 text-[10.5px]">${SandboxUtil.dateOnly(p.payDate)}</td>
        <td class="p-2.5 text-[10.5px]">${SandboxUtil.esc(SandboxUtil.payTypeLabel(p.payType))}</td>
        <td class="p-2.5 font-mono text-[10px] text-slate-500">${SandboxUtil.esc(p.receipt || '-')}</td>
        <td class="p-2.5 text-right whitespace-nowrap">
          <button onclick="FinanceModule.edit('${SandboxUtil.jsStr(p.uuid)}')"
            class="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded text-[10.5px]">Edit</button>
          <button onclick="FinanceModule.remove('${SandboxUtil.jsStr(p.uuid)}','${SandboxUtil.jsStr(p.receipt || '')}')"
            class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded text-[10.5px]">Hapus</button>
        </td>
      </tr>`;
    }).join('');
  }

  function search(keyword) {
    const q = (keyword || '').toLowerCase().trim();
    if (!q) { renderTable(cache); return; }
    renderTable(cache.filter(p =>
      (p.receipt || '').toLowerCase().includes(q) ||
      (p.policy?.product?.name || '').toLowerCase().includes(q) ||
      (p.policy?.family?.headInsuree?.lastName || '').toLowerCase().includes(q)
    ));
  }

  async function ensurePolicies() {
    if (policiesCache.length) return policiesCache;
    try {
      const conn = await OpenIMISApi.getPolicies(60);
      policiesCache = SandboxUtil.nodes(conn);
    } catch (e) {
      policiesCache = [];
    }
    return policiesCache;
  }

  function policyOptions(selectedUuid) {
    return policiesCache.map(p => {
      const head = p.family && p.family.headInsuree ? p.family.headInsuree : {};
      const sel = p.uuid === selectedUuid ? ' selected' : '';
      return `<option value="${SandboxUtil.esc(p.uuid)}"${sel}>${SandboxUtil.esc(p.product ? p.product.name : 'Polis')} — ${SandboxUtil.esc(head.lastName || '')} (${SandboxUtil.esc(head.chfId || '-')})</option>`;
    }).join('');
  }

  async function openCreate() {
    await ensurePolicies();
    if (!policiesCache.length) {
      SandboxUtil.toast('Belum ada polis. Terbitkan polis terlebih dahulu.', 'warning', 5000);
      return;
    }

    AppModal.open('Catat Pembayaran Premi', `
      <form onsubmit="FinanceModule.submitCreate(event)" class="space-y-3 text-[11px]">
        <div class="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-[10.5px] text-sky-900">
          Memanggil <code class="font-mono">createPremium</code>. Field wajib:
          <code>policyUuid</code>, <code>amount</code>, <code>receipt</code>,
          <code>payDate</code>, <code>payType</code>.
        </div>
        ${UiKit.field('Polis', UiKit.select('prem-policy', policyOptions()))}
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Nominal', UiKit.input('prem-amount', { type: 'number', value: '150000', required: true }))}
          ${UiKit.field('No. Kwitansi', UiKit.input('prem-receipt', { value: 'RCPT-' + Date.now().toString().slice(-6), required: true, extraClass: 'font-mono' }))}
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Tanggal Bayar', UiKit.input('prem-date', { type: 'date', value: SandboxUtil.today(), required: true }))}
          ${UiKit.field('Metode', UiKit.select('prem-type',
            `<option value="B">Bank / Transfer</option>
             <option value="C">Tunai</option>
             <option value="M">Mobile</option>
             <option value="O">Online Gateway</option>`))}
        </div>
        ${UiKit.formFooter('Simpan Premi', 'prem-btn-submit')}
      </form>`, { wide: true });
  }

  async function submitCreate(e) {
    e.preventDefault();
    const input = {
      clientMutationId: 'create-premium-' + Date.now(),
      policyUuid: SandboxUtil.val('prem-policy'),
      amount: String(SandboxUtil.val('prem-amount')),
      receipt: SandboxUtil.val('prem-receipt').trim(),
      payDate: SandboxUtil.val('prem-date'),
      payType: SandboxUtil.val('prem-type')
    };

    await UiKit.busy('prem-btn-submit', 'Menyimpan...', async () => {
      try {
        await OpenIMISApi.createPremium(input);
        SandboxUtil.toast('Premi dicatat', 'success');
        AppModal.close();
        await load();
      } catch (err) {
        SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
      }
    });
  }

  async function edit(uuid) {
    const p = cache.find(x => x.uuid === uuid);
    if (!p) return;
    await ensurePolicies();

    AppModal.open('Edit Premi', `
      <form onsubmit="FinanceModule.submitEdit(event,'${SandboxUtil.jsStr(uuid)}')" class="space-y-3 text-[11px]">
        <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10.5px] text-amber-900">
          Memanggil <code class="font-mono">updatePremium</code>.
        </div>
        ${UiKit.field('Polis', UiKit.select('prem-e-policy', policyOptions(p.policy ? p.policy.uuid : null)))}
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Nominal', UiKit.input('prem-e-amount', { type: 'number', value: p.amount, required: true }))}
          ${UiKit.field('No. Kwitansi', UiKit.input('prem-e-receipt', { value: p.receipt || '', required: true, extraClass: 'font-mono' }))}
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Tanggal Bayar', UiKit.input('prem-e-date', { type: 'date', value: SandboxUtil.dateOnly(p.payDate), required: true }))}
          ${UiKit.field('Metode', UiKit.select('prem-e-type',
            `<option value="B" ${p.payType === 'B' ? 'selected' : ''}>Bank / Transfer</option>
             <option value="C" ${p.payType === 'C' ? 'selected' : ''}>Tunai</option>
             <option value="M" ${p.payType === 'M' ? 'selected' : ''}>Mobile</option>
             <option value="O" ${p.payType === 'O' ? 'selected' : ''}>Online Gateway</option>`))}
        </div>
        ${UiKit.formFooter('Simpan Perubahan', 'prem-e-submit')}
      </form>`, { wide: true });
  }

  async function submitEdit(e, uuid) {
    e.preventDefault();
    const input = {
      clientMutationId: 'update-premium-' + Date.now(),
      uuid,
      policyUuid: SandboxUtil.val('prem-e-policy'),
      amount: String(SandboxUtil.val('prem-e-amount')),
      receipt: SandboxUtil.val('prem-e-receipt').trim(),
      payDate: SandboxUtil.val('prem-e-date'),
      payType: SandboxUtil.val('prem-e-type')
    };
    await UiKit.busy('prem-e-submit', 'Menyimpan...', async () => {
      try {
        await OpenIMISApi.updatePremium(input);
        SandboxUtil.toast('Premi diperbarui', 'success');
        AppModal.close();
        await load();
      } catch (err) {
        SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
      }
    });
  }

  async function remove(uuid, receipt) {
    const ok = await AppModal.confirm('Hapus Premi',
      `Premi <strong>${SandboxUtil.esc(receipt || uuid)}</strong> akan di-soft-delete lewat
       <code class="font-mono">deletePremium</code>.`, 'Hapus');
    if (!ok) return;
    try {
      await OpenIMISApi.deletePremiums([uuid]);
      SandboxUtil.toast('Premi dihapus', 'success');
      await load();
    } catch (err) {
      SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
    }
  }

  return { load, search, openCreate, submitCreate, edit, submitEdit, remove };
})();

window.FinanceModule = FinanceModule;
