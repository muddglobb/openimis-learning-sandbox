// ============================================================
// Claims — full lifecycle
//   2 Entered -> 4 Checked -> 8 Processed -> 16 Valuated
//   (1 Rejected at any verification step)
// ============================================================
const ClaimsModule = (function () {
  let cache = [];
  let activeStatus = '';
  let activeFilter = {};

  // ---------------------------------------------------------
  // List
  // ---------------------------------------------------------
  async function load(status = null, filters = {}) {
    const container = document.getElementById('claims-table-body');
    if (!container) return;

    activeStatus = status === null || status === undefined ? '' : String(status);
    activeFilter = filters;

    container.innerHTML = SandboxUtil.spinnerRow(8, 'Memuat klaim dari OpenIMIS...');

    try {
      const conn = await OpenIMISApi.getClaims(100, Object.assign(
        { status: activeStatus === '' ? undefined : activeStatus },
        filters
      ));
      cache = SandboxUtil.nodes(conn);
      renderTable(cache, SandboxUtil.totalCount(conn));
    } catch (err) {
      container.innerHTML = SandboxUtil.errorRow(8, `Gagal memuat klaim: ${err.message}`);
    }
  }

  function statusCounts() {
    const counts = { '': cache.length, 1: 0, 2: 0, 4: 0, 8: 0, 16: 0 };
    cache.forEach(c => {
      const s = Number(c.status);
      if (counts[s] !== undefined) counts[s]++;
    });
    return counts;
  }

  function renderTable(data, total) {
    const container = document.getElementById('claims-table-body');
    if (!container) return;

    const counter = document.getElementById('claims-count');
    if (counter) counter.innerText = `${data.length} dari ${total !== undefined ? total : data.length} klaim`;

    if (!data.length) {
      container.innerHTML = SandboxUtil.emptyRow(8, 'Tidak ada klaim pada kategori ini.');
      return;
    }

    container.innerHTML = data.map(c => `
      <tr class="hover:bg-slate-50/80 border-b border-slate-100">
        <td class="p-2.5 font-mono font-bold text-sky-700 text-[11px]">${SandboxUtil.esc(c.code)}</td>
        <td class="p-2.5 text-[11px]">
          <div class="font-semibold text-slate-800">${SandboxUtil.esc(c.healthFacility ? c.healthFacility.name : '-')}</div>
          <div class="text-[10px] text-slate-400 font-mono">${SandboxUtil.esc(c.healthFacility ? c.healthFacility.code : '')}</div>
        </td>
        <td class="p-2.5 text-[11px]">
          <div class="font-medium">${SandboxUtil.esc(c.insuree ? c.insuree.lastName : '-')}</div>
          <div class="text-[10px] text-slate-400 font-mono">${SandboxUtil.esc(c.insuree ? c.insuree.chfId : '')}</div>
        </td>
        <td class="p-2.5 text-[10.5px]">
          <div>${SandboxUtil.dateOnly(c.dateClaimed)}</div>
          <div class="text-[10px] text-slate-400">${SandboxUtil.esc(c.icd ? c.icd.code : '-')}</div>
        </td>
        <td class="p-2.5">${SandboxUtil.claimStatusBadge(c.status)}</td>
        <td class="p-2.5 text-right font-mono text-[10.5px]">${SandboxUtil.money(c.claimed)}</td>
        <td class="p-2.5 text-right font-mono text-[10.5px] ${Number(c.approved) > 0 ? 'text-emerald-700' : 'text-slate-400'}">
          ${Number(c.approved) > 0 ? SandboxUtil.money(c.approved) : '-'}
        </td>
        <td class="p-2.5 text-right whitespace-nowrap">
          <button onclick="ClaimsModule.detail('${SandboxUtil.jsStr(c.id)}')"
            class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10.5px]">Detail</button>
          ${Number(c.status) === 2 ? `<button onclick="ClaimsModule.actSubmit('${SandboxUtil.jsStr(c.uuid)}','${SandboxUtil.jsStr(c.code)}')"
            class="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10.5px]">Verifikasi</button>` : ''}
          ${Number(c.status) === 4 ? `<button onclick="ClaimsModule.actProcess('${SandboxUtil.jsStr(c.uuid)}','${SandboxUtil.jsStr(c.code)}')"
            class="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded text-[10.5px]">Proses</button>` : ''}
        </td>
      </tr>`).join('');
  }

  function search(keyword) {
    const q = (keyword || '').toLowerCase().trim();
    if (!q) { renderTable(cache); return; }
    renderTable(cache.filter(c =>
      (c.code || '').toLowerCase().includes(q) ||
      (c.insuree?.lastName || '').toLowerCase().includes(q) ||
      (c.insuree?.chfId || '').toLowerCase().includes(q) ||
      (c.healthFacility?.name || '').toLowerCase().includes(q)
    ));
  }

  async function applyFilter() {
    const status = SandboxUtil.val('claims-filter-status');
    const chfId = SandboxUtil.val('claims-filter-chfid').trim();
    const dateFrom = SandboxUtil.val('claims-filter-date');
    await load(status === '' ? null : status, {
      chfId: chfId || undefined,
      dateFrom: dateFrom || undefined
    });
  }

  // ---------------------------------------------------------
  // Detail
  // ---------------------------------------------------------
  async function detail(id) {
    const claim = cache.find(c => c.id === id);
    if (!claim) return;

    AppModal.open(`Klaim ${claim.code}`, `
      <div class="p-6 text-center text-slate-500 text-[11px]">
        <span class="animate-spin inline-block w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full"></span>
        Memuat detail klaim...
      </div>`);

    let history = [];
    try {
      const conn = await OpenIMISApi.getClaimHistory(claim.uuid);
      history = SandboxUtil.nodes(conn);
    } catch (e) { /* ignore */ }

    const services = claim.services || [];
    const items = claim.items || [];
    const totalServices = services.reduce((s, x) => s + SandboxUtil.num(x.priceAsked), 0);
    const totalItems = items.reduce((s, x) => s + SandboxUtil.num(x.priceAsked), 0);

    const html = `
      <div class="space-y-3 text-[11px]">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          ${box('Kode Klaim', claim.code, 'font-mono')}
          ${box('Status', null, '', SandboxUtil.claimStatusBadge(claim.status))}
          ${box('Faskes', claim.healthFacility ? claim.healthFacility.name : '-')}
          ${box('Peserta', claim.insuree ? `${claim.insuree.lastName} (${claim.insuree.chfId})` : '-')}
          ${box('Diagnosa ICD', claim.icd ? `[${claim.icd.code}] ${claim.icd.name}` : '-')}
          ${box('Tanggal Rawat', `${SandboxUtil.dateOnly(claim.dateFrom)} → ${SandboxUtil.dateOnly(claim.dateTo || claim.dateFrom)}`)}
          ${box('Tipe Kunjungan', claim.visitType === 'O' ? 'Rawat Jalan' : claim.visitType === 'I' ? 'Rawat Inap' : (claim.visitType || '-'))}
          ${box('Tanggal Klaim', SandboxUtil.dateOnly(claim.dateClaimed))}
        </div>

        ${services.length ? `
          <div>
            <div class="font-bold text-slate-700 mb-1">Tindakan (services)</div>
            <div class="overflow-x-auto rounded-lg border border-slate-200">
              <table class="w-full text-[10.5px]">
                <thead class="bg-slate-50 text-slate-600"><tr>
                  <th class="p-2 text-left">Kode</th><th class="p-2 text-left">Nama</th>
                  <th class="p-2 text-right">Qty</th><th class="p-2 text-right">Harga</th>
                  <th class="p-2 text-left">Status</th>
                </tr></thead>
                <tbody>${services.map(s => `<tr class="border-t border-slate-100">
                  <td class="p-2 font-mono text-purple-700">${SandboxUtil.esc(s.service ? s.service.code : '-')}</td>
                  <td class="p-2">${SandboxUtil.esc(s.service ? s.service.name : '-')}</td>
                  <td class="p-2 text-right">${SandboxUtil.esc(s.qtyProvided)}</td>
                  <td class="p-2 text-right font-mono">${SandboxUtil.money(s.priceAsked)}</td>
                  <td class="p-2">${Number(s.status) === 1
                    ? '<span class="text-emerald-600 text-[9.5px]">Passed</span>'
                    : '<span class="text-red-600 text-[9.5px]">Rejected</span>'}</td>
                </tr>`).join('')}</tbody>
                <tfoot class="bg-slate-50 font-semibold"><tr>
                  <td class="p-2" colspan="3">Subtotal tindakan</td>
                  <td class="p-2 text-right font-mono">${SandboxUtil.money(totalServices)}</td>
                  <td></td>
                </tr></tfoot>
              </table>
            </div>
          </div>` : ''}

        ${items.length ? `
          <div>
            <div class="font-bold text-slate-700 mb-1">Obat (items)</div>
            <div class="overflow-x-auto rounded-lg border border-slate-200">
              <table class="w-full text-[10.5px]">
                <thead class="bg-slate-50 text-slate-600"><tr>
                  <th class="p-2 text-left">Kode</th><th class="p-2 text-left">Nama</th>
                  <th class="p-2 text-right">Qty</th><th class="p-2 text-right">Harga</th>
                  <th class="p-2 text-left">Status</th>
                </tr></thead>
                <tbody>${items.map(i => `<tr class="border-t border-slate-100">
                  <td class="p-2 font-mono text-emerald-700">${SandboxUtil.esc(i.item ? i.item.code : '-')}</td>
                  <td class="p-2">${SandboxUtil.esc(i.item ? i.item.name : '-')}</td>
                  <td class="p-2 text-right">${SandboxUtil.esc(i.qtyProvided)}</td>
                  <td class="p-2 text-right font-mono">${SandboxUtil.money(i.priceAsked)}</td>
                  <td class="p-2">${Number(i.status) === 1
                    ? '<span class="text-emerald-600 text-[9.5px]">Passed</span>'
                    : '<span class="text-red-600 text-[9.5px]">Rejected</span>'}</td>
                </tr>`).join('')}</tbody>
                <tfoot class="bg-slate-50 font-semibold"><tr>
                  <td class="p-2" colspan="3">Subtotal obat</td>
                  <td class="p-2 text-right font-mono">${SandboxUtil.money(totalItems)}</td>
                  <td></td>
                </tr></tfoot>
              </table>
            </div>
          </div>` : ''}

        <div class="grid grid-cols-3 gap-2">
          <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div class="text-[9.5px] text-slate-500 uppercase">Ditagih</div>
            <div class="font-mono font-bold text-slate-800">${SandboxUtil.money(claim.claimed)}</div>
          </div>
          <div class="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div class="text-[9.5px] text-emerald-700 uppercase">Disetujui</div>
            <div class="font-mono font-bold text-emerald-800">${SandboxUtil.money(claim.approved)}</div>
          </div>
          <div class="p-2.5 bg-sky-50 border border-sky-200 rounded-lg">
            <div class="text-[9.5px] text-sky-700 uppercase">Valuasi</div>
            <div class="font-mono font-bold text-sky-800">${SandboxUtil.money(claim.valuated)}</div>
          </div>
        </div>

        ${history.length ? `
          <div>
            <div class="font-bold text-slate-700 mb-1">Riwayat (claimHistory)</div>
            <div class="space-y-1 max-h-32 overflow-y-auto">
              ${history.map(h => `<div class="flex items-center justify-between p-1.5 bg-slate-50 rounded text-[10px]">
                <span class="font-mono text-slate-600">${SandboxUtil.esc(h.code)}</span>
                ${SandboxUtil.claimStatusBadge(h.status)}
                <span class="text-slate-400">${SandboxUtil.dateOnly(h.dateClaimed)}</span>
              </div>`).join('')}
            </div>
          </div>` : ''}

        <div class="pt-2 border-t border-slate-100 flex justify-between items-center flex-wrap gap-2">
          <button onclick="GraphQLHelp.previewLast('Query Detail Klaim')"
            class="text-[10.5px] text-slate-500 hover:text-sky-600 underline">Lihat GraphQL</button>
          <div class="flex gap-2">
            ${Number(claim.status) === 2 ? `<button onclick="ClaimsModule.actSubmit('${SandboxUtil.jsStr(claim.uuid)}','${SandboxUtil.jsStr(claim.code)}')"
              class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold">Verifikasi (submitClaims)</button>` : ''}
            ${Number(claim.status) === 4 ? `<button onclick="ClaimsModule.actProcess('${SandboxUtil.jsStr(claim.uuid)}','${SandboxUtil.jsStr(claim.code)}')"
              class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-semibold">Proses (processClaims)</button>` : ''}
            <button onclick="AppModal.close()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold">Tutup</button>
          </div>
        </div>
      </div>`;

    AppModal.open(`Klaim ${claim.code}`, html, { wide: true });
  }

  function box(label, value, cls = '', htmlValue = null) {
    return `<div class="p-2 bg-slate-50 border border-slate-200 rounded-lg">
      <div class="text-[9.5px] text-slate-500 uppercase tracking-wide">${label}</div>
      <div class="font-semibold text-slate-800 ${cls}">${htmlValue !== null ? htmlValue : SandboxUtil.esc(value)}</div>
    </div>`;
  }

  // ---------------------------------------------------------
  // Lifecycle actions
  // ---------------------------------------------------------
  /**
   * submitClaims / processClaims in openIMIS 26.04 only return
   * clientMutationId + internalId — no statistics. We re-read the claim to
   * learn its new status, which is the authoritative source anyway.
   */
  async function refetchStatus(uuid, code) {
    for (let i = 0; i < 8; i++) {
      try {
        const conn = await OpenIMISApi.getClaims(1, { code });
        const c = SandboxUtil.nodes(conn)[0];
        if (c && c.uuid === uuid) return c;
      } catch (e) { /* retry */ }
      await new Promise(r => setTimeout(r, 600));
    }
    return null;
  }

  async function actSubmit(uuid, code) {
    const ok = await AppModal.confirm(
      'Verifikasi Klaim',
      `Klaim <strong>${SandboxUtil.esc(code)}</strong> akan diverifikasi lewat mutation
       <code class="font-mono">submitClaims</code>.<br><br>
       Transisi status: <strong>2 Entered → 4 Checked</strong> (atau <strong>1 Rejected</strong>
       bila ada item/tindakan yang tidak lolos validasi).`,
      'Verifikasi'
    );
    if (!ok) return;

    try {
      await OpenIMISApi.submitClaims([uuid]);
      const fresh = await refetchStatus(uuid, code);
      const st = fresh ? fresh.status : null;
      SandboxUtil.toast(
        st ? `Klaim ${code} diverifikasi — status ${st}` : `Klaim ${code} dikirim untuk verifikasi`,
        'success', 5000
      );
      AppModal.close();
      await load(activeStatus === '' ? null : activeStatus, activeFilter);
    } catch (err) {
      SandboxUtil.toast(`Verifikasi gagal: ${err.message}`, 'error', 7000);
    }
  }

  async function actProcess(uuid, code) {
    const ok = await AppModal.confirm(
      'Proses & Adjudikasi Klaim',
      `Klaim <strong>${SandboxUtil.esc(code)}</strong> akan diproses lewat mutation
       <code class="font-mono">processClaims</code>.<br><br>
       Transisi status: <strong>4 Checked → 8 Processed → 16 Valuated</strong>.
       Di tahap ini openIMIS menghitung nilai penggantian berdasarkan plafon polis,
       harga di pricelist, dan aturan limit produk.`,
      'Proses'
    );
    if (!ok) return;

    try {
      await OpenIMISApi.processClaims([uuid]);
      const fresh = await refetchStatus(uuid, code);
      const st = fresh ? fresh.status : null;
      const extra = fresh ? ` · disetujui ${SandboxUtil.money(fresh.approved)}` : '';
      SandboxUtil.toast(
        st ? `Klaim ${code} diproses — status ${st}${extra}` : `Klaim ${code} dikirim untuk adjudikasi`,
        'success', 6000
      );
      AppModal.close();
      await load(activeStatus === '' ? null : activeStatus, activeFilter);
    } catch (err) {
      SandboxUtil.toast(`Proses gagal: ${err.message}`, 'error', 7000);
    }
  }

  // ---------------------------------------------------------
  // Create claim (standalone)
  // ---------------------------------------------------------
  async function openCreate() {
    AppModal.open('Ajukan Klaim Baru', `
      <div class="p-6 text-center text-slate-500 text-[11px]">
        <span class="animate-spin inline-block w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full"></span>
        Memuat referensi...
      </div>`);

    let hfs = [], insurees = [], diagnoses = [], services = [], items = [];
    try {
      const [hfConn, insConn, diagConn, svcConn, itemConn] = await Promise.all([
        OpenIMISApi.getHealthFacilities(40),
        OpenIMISApi.getInsurees(40),
        OpenIMISApi.getDiagnoses(60),
        OpenIMISApi.getMedicalServices(40),
        OpenIMISApi.getMedicalItems(40)
      ]);
      hfs = SandboxUtil.nodes(hfConn);
      insurees = SandboxUtil.nodes(insConn);
      diagnoses = SandboxUtil.nodes(diagConn);
      services = SandboxUtil.nodes(svcConn);
      items = SandboxUtil.nodes(itemConn);
    } catch (e) {
      SandboxUtil.toast(`Gagal memuat referensi: ${e.message}`, 'error', 6000);
      AppModal.close();
      return;
    }

    const today = SandboxUtil.today();
    const claimCode = 'CLM-' + Date.now().toString().slice(-8);

    const html = `
      <form onsubmit="ClaimsModule.submitCreate(event)" class="space-y-3 text-[11px]">
        <div class="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-[10.5px] text-sky-900">
          Memanggil <code class="font-mono">createClaim</code>. Klaim baru masuk dengan status
          <strong>2 Entered</strong>. Items & services boleh dikirim sekaligus di mutation yang sama.
        </div>

        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Kode Klaim', UiKit.input('clm-code', { value: claimCode, required: true, extraClass: 'font-mono' }))}
          ${UiKit.field('Tanggal Klaim', UiKit.input('clm-date', { type: 'date', value: today, required: true }))}
        </div>

        ${UiKit.field('Fasilitas Kesehatan', UiKit.select('clm-hf', hfs.map(h =>
          `<option value="${SandboxUtil.relayToId(h.id)}">${SandboxUtil.esc(h.code)} - ${SandboxUtil.esc(h.name)}</option>`).join('')))}

        ${UiKit.field('Peserta', UiKit.select('clm-insuree', insurees.map(p =>
          `<option value="${SandboxUtil.relayToId(p.id)}">${SandboxUtil.esc(p.chfId)} - ${SandboxUtil.esc(p.otherNames || '')} ${SandboxUtil.esc(p.lastName || '')}</option>`).join('')))}

        ${UiKit.field('Diagnosa Utama (ICD-10)', UiKit.select('clm-icd', diagnoses.map(d =>
          `<option value="${SandboxUtil.relayToId(d.id)}">[${SandboxUtil.esc(d.code)}] ${SandboxUtil.esc(d.name)}</option>`).join('')))}

        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Tipe Kunjungan', UiKit.select('clm-visit',
            `<option value="O">Rawat Jalan (O)</option><option value="I">Rawat Inap (I)</option>`))}
          ${UiKit.field('Tanggal Pulang', UiKit.input('clm-date-to', { type: 'date', value: today }))}
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <div class="font-semibold text-slate-700 mb-1 text-[11px]">Tindakan</div>
            <div class="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-1.5 space-y-1">
              ${services.slice(0, 20).map(s => `
                <label class="flex items-center gap-1.5 text-[10px] p-1 rounded hover:bg-slate-50">
                  <input type="checkbox" name="clm-svc" value="${SandboxUtil.relayToId(s.id)}"
                    data-price="${SandboxUtil.num(s.price)}" data-code="${SandboxUtil.esc(s.code)}"
                    class="rounded text-purple-600">
                  <span class="flex-1 truncate">${SandboxUtil.esc(s.name)}</span>
                  <span class="font-mono text-slate-400">${SandboxUtil.num(s.price).toLocaleString('id-ID')}</span>
                </label>`).join('')}
            </div>
          </div>
          <div>
            <div class="font-semibold text-slate-700 mb-1 text-[11px]">Obat</div>
            <div class="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-1.5 space-y-1">
              ${items.slice(0, 20).map(i => `
                <label class="flex items-center gap-1.5 text-[10px] p-1 rounded hover:bg-slate-50">
                  <input type="checkbox" name="clm-item" value="${SandboxUtil.relayToId(i.id)}"
                    data-price="${SandboxUtil.num(i.price)}" data-code="${SandboxUtil.esc(i.code)}"
                    class="rounded text-emerald-600">
                  <span class="flex-1 truncate">${SandboxUtil.esc(i.name)}</span>
                  <span class="font-mono text-slate-400">${SandboxUtil.num(i.price).toLocaleString('id-ID')}</span>
                </label>`).join('')}
            </div>
          </div>
        </div>

        <div id="clm-total" class="p-2.5 bg-slate-900 text-yellow-400 rounded-lg font-mono text-[11px] text-right">
          Total: Rp 0
        </div>

        ${UiKit.formFooter('Ajukan Klaim', 'clm-btn-submit')}
      </form>`;

    AppModal.open('Ajukan Klaim Baru', html, { wide: true });

    // live total
    const recalc = () => {
      let total = 0;
      document.querySelectorAll('input[name="clm-svc"]:checked, input[name="clm-item"]:checked').forEach(cb => {
        total += SandboxUtil.num(cb.getAttribute('data-price'));
      });
      SandboxUtil.setHTML('clm-total', `Total: ${SandboxUtil.money(total)}`);
    };
    document.querySelectorAll('input[name="clm-svc"], input[name="clm-item"]').forEach(cb => {
      cb.addEventListener('change', recalc);
    });
  }

  async function submitCreate(e) {
    e.preventDefault();

    const services = [];
    document.querySelectorAll('input[name="clm-svc"]:checked').forEach(cb => {
      services.push({
        serviceId: Number(cb.value),
        status: 1,
        qtyProvided: 1,
        priceAsked: String(SandboxUtil.num(cb.getAttribute('data-price')))
      });
    });

    const items = [];
    document.querySelectorAll('input[name="clm-item"]:checked').forEach(cb => {
      items.push({
        itemId: Number(cb.value),
        status: 1,
        qtyProvided: 1,
        priceAsked: String(SandboxUtil.num(cb.getAttribute('data-price')))
      });
    });

    const dateFrom = SandboxUtil.val('clm-date');
    const input = {
      clientMutationId: 'create-claim-' + Date.now(),
      code: SandboxUtil.val('clm-code').trim(),
      insureeId: Number(SandboxUtil.val('clm-insuree')),
      healthFacilityId: Number(SandboxUtil.val('clm-hf')),
      icdId: Number(SandboxUtil.val('clm-icd')),
      dateFrom,
      dateTo: SandboxUtil.val('clm-date-to') || dateFrom,
      dateClaimed: dateFrom,
      visitType: SandboxUtil.val('clm-visit'),
      careType: SandboxUtil.val('clm-visit')
    };
    if (services.length) input.services = services;
    if (items.length) input.items = items;

    await UiKit.busy('clm-btn-submit', 'Mengirim...', async () => {
      try {
        await OpenIMISApi.createClaim(input);
        SandboxUtil.toast(`Klaim ${input.code} berhasil diajukan (status 2 Entered)`, 'success', 5000);
        AppModal.close();
        await load();
      } catch (err) {
        SandboxUtil.toast(`Gagal mengajukan klaim: ${err.message}`, 'error', 7000);
      }
    });
  }

  async function remove(uuid, code) {
    const ok = await AppModal.confirm('Hapus Klaim',
      `Klaim <strong>${SandboxUtil.esc(code)}</strong> akan di-soft-delete lewat <code class="font-mono">deleteClaims</code>.`,
      'Hapus');
    if (!ok) return;
    try {
      await OpenIMISApi.deleteClaims([uuid]);
      SandboxUtil.toast(`Klaim ${code} dihapus`, 'success');
      await load();
    } catch (err) {
      SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
    }
  }

  return { load, search, applyFilter, detail, actSubmit, actProcess, openCreate, submitCreate, remove };
})();

window.ClaimsModule = ClaimsModule;
