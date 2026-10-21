// ============================================================
// Products & Policies
// ============================================================
const PoliciesModule = (function () {
  let productCache = [];
  let policyCache = [];

  // ---------------------------------------------------------
  // Load
  // ---------------------------------------------------------
  async function load() {
    await Promise.all([loadProducts(), loadPolicies()]);
  }

  async function loadProducts() {
    const container = document.getElementById('products-table-body');
    if (!container) return;
    container.innerHTML = SandboxUtil.spinnerRow(6, 'Memuat produk...');
    try {
      const conn = await OpenIMISApi.getProducts(30);
      productCache = SandboxUtil.nodes(conn);
      renderProducts(productCache);
    } catch (e) {
      container.innerHTML = SandboxUtil.errorRow(6, `Gagal: ${e.message}`);
    }
  }

  async function loadPolicies() {
    const container = document.getElementById('policies-table-body');
    if (!container) return;
    container.innerHTML = SandboxUtil.spinnerRow(7, 'Memuat polis...');
    try {
      const conn = await OpenIMISApi.getPolicies(40);
      policyCache = SandboxUtil.nodes(conn);
      renderPolicies(policyCache);
    } catch (e) {
      container.innerHTML = SandboxUtil.errorRow(7, `Gagal: ${e.message}`);
    }
  }

  function renderProducts(data) {
    const container = document.getElementById('products-table-body');
    if (!container) return;
    if (!data.length) {
      container.innerHTML = SandboxUtil.emptyRow(6, 'Belum ada produk.');
      return;
    }
    container.innerHTML = data.map(p => `
      <tr class="hover:bg-slate-50 border-b border-slate-100">
        <td class="p-2.5 font-mono font-bold text-sky-700 text-[11px]">${SandboxUtil.esc(p.code)}</td>
        <td class="p-2.5 text-[11px]">
          <div class="font-semibold text-slate-800">${SandboxUtil.esc(p.name)}</div>
          <div class="text-[10px] text-slate-400">Periode ${p.insurancePeriod || '-'} bln · maks ${p.maxMembers || '-'} anggota</div>
        </td>
        <td class="p-2.5 text-right font-mono text-[10.5px] text-emerald-700">${SandboxUtil.money(p.lumpSum)}</td>
        <td class="p-2.5 text-[10.5px]">${p.maxInstallments || 1}×</td>
        <td class="p-2.5 text-[10.5px] font-mono">${SandboxUtil.esc(p.ceilingType || '-')}</td>
        <td class="p-2.5 text-right whitespace-nowrap">
          <button onclick="PoliciesModule.detailProduct('${SandboxUtil.jsStr(p.code)}')"
            class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10.5px]">Detail</button>
          <button onclick="PoliciesModule.editProduct('${SandboxUtil.jsStr(p.uuid)}')"
            class="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded text-[10.5px]">Edit</button>
        </td>
      </tr>`).join('');
  }

  function renderPolicies(data) {
    const container = document.getElementById('policies-table-body');
    if (!container) return;
    if (!data.length) {
      container.innerHTML = SandboxUtil.emptyRow(7, 'Belum ada polis.');
      return;
    }
    container.innerHTML = data.map(p => {
      const head = p.family && p.family.headInsuree ? p.family.headInsuree : {};
      return `<tr class="hover:bg-slate-50 border-b border-slate-100">
        <td class="p-2.5 font-mono text-[10px] text-slate-500">${SandboxUtil.esc((p.uuid || '').slice(0, 8))}…</td>
        <td class="p-2.5 text-[11px] font-semibold text-slate-800">${SandboxUtil.esc(p.product ? p.product.name : '-')}</td>
        <td class="p-2.5 text-[11px]">
          <div>${SandboxUtil.esc(head.lastName || '-')}</div>
          <div class="text-[10px] text-slate-400 font-mono">${SandboxUtil.esc(head.chfId || '')}</div>
        </td>
        <td class="p-2.5 text-[10.5px]">${SandboxUtil.dateOnly(p.startDate)}</td>
        <td class="p-2.5 text-[10.5px]">${SandboxUtil.dateOnly(p.expiryDate)}</td>
        <td class="p-2.5">${SandboxUtil.policyStatusBadge(p.status)}</td>
        <td class="p-2.5 text-right whitespace-nowrap">
          <button onclick="PoliciesModule.detailPolicy('${SandboxUtil.jsStr(p.id)}')"
            class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10.5px]">Detail</button>
          <button onclick="PoliciesModule.renew('${SandboxUtil.jsStr(p.uuid)}','${SandboxUtil.jsStr(p.product?.code || '')}','${SandboxUtil.jsStr(p.expiryDate || '')}')"
            class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[10.5px]">Perpanjang</button>
          <button onclick="PoliciesModule.suspend('${SandboxUtil.jsStr(p.uuid)}')"
            class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-[10.5px]">Suspend</button>
        </td>
      </tr>`;
    }).join('');
  }

  // ---------------------------------------------------------
  // Product detail / edit
  // ---------------------------------------------------------
  async function detailProduct(code) {
    try {
      const p = await OpenIMISApi.getProductByCode(code);
      if (!p) { SandboxUtil.toast('Produk tidak ditemukan', 'warning'); return; }

      const svcs = p.productServices || [];
      const itms = p.productItems || [];

      AppModal.open(`Produk ${p.code}`, `
        <div class="space-y-3 text-[11px]">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            ${kv('Kode', p.code, 'font-mono')}
            ${kv('Nama', p.name)}
            ${kv('Lump Sum', SandboxUtil.money(p.lumpSum))}
            ${kv('Max Anggota', p.maxMembers)}
            ${kv('Periode', (p.insurancePeriod || '-') + ' bulan')}
            ${kv('Max Cicilan', p.maxInstallments || '-')}
            ${kv('Premi Dewasa', SandboxUtil.money(p.premiumAdult))}
            ${kv('Premi Anak', SandboxUtil.money(p.premiumChild))}
            ${kv('Deductible', SandboxUtil.money(p.deductible))}
            ${kv('Ceiling Type', p.ceilingType || '-')}
            ${kv('Berlaku Dari', SandboxUtil.dateOnly(p.dateFrom))}
            ${kv('Berlaku Sampai', SandboxUtil.dateOnly(p.dateTo))}
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <div class="font-bold text-slate-700 mb-1">Tindakan Dijamin (${svcs.length})</div>
              <div class="max-h-40 overflow-y-auto space-y-0.5">
                ${svcs.length ? svcs.map(s => `<div class="flex justify-between p-1.5 bg-purple-50 rounded text-[10px]">
                  <span>${SandboxUtil.esc(s.service ? s.service.name : '-')}</span>
                  <span class="font-mono text-purple-700">${SandboxUtil.money(s.service ? s.service.price : 0)}</span>
                </div>`).join('') : '<div class="text-slate-400 text-[10px] p-2">Belum ada tindakan.</div>'}
              </div>
            </div>
            <div>
              <div class="font-bold text-slate-700 mb-1">Obat Dijamin (${itms.length})</div>
              <div class="max-h-40 overflow-y-auto space-y-0.5">
                ${itms.length ? itms.map(i => `<div class="flex justify-between p-1.5 bg-emerald-50 rounded text-[10px]">
                  <span>${SandboxUtil.esc(i.item ? i.item.name : '-')}</span>
                  <span class="font-mono text-emerald-700">${SandboxUtil.money(i.item ? i.item.price : 0)}</span>
                </div>`).join('') : '<div class="text-slate-400 text-[10px] p-2">Belum ada obat.</div>'}
              </div>
            </div>
          </div>

          <div class="pt-2 border-t border-slate-100 flex justify-between">
            <button onclick="GraphQLHelp.previewLast('Query Detail Produk')"
              class="text-[10.5px] text-slate-500 hover:text-sky-600 underline">Lihat GraphQL</button>
            <button onclick="AppModal.close()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold">Tutup</button>
          </div>
        </div>`, { wide: true });
    } catch (e) {
      SandboxUtil.toast(`Gagal memuat produk: ${e.message}`, 'error', 5000);
    }
  }

  function kv(label, value, cls = '') {
    return `<div class="p-2 bg-slate-50 border border-slate-200 rounded-lg">
      <div class="text-[9.5px] text-slate-500 uppercase">${label}</div>
      <div class="font-semibold text-slate-800 ${cls}">${SandboxUtil.esc(value)}</div>
    </div>`;
  }

  async function openCreateProduct() {
    const code = 'PRD' + Math.floor(Math.random() * 900 + 100);
    AppModal.open('Buat Produk Baru', `
      <form onsubmit="PoliciesModule.submitCreateProduct(event)" class="space-y-3 text-[11px]">
        <div class="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-[10.5px] text-sky-900">
          Memanggil <code class="font-mono">createProduct</code>. Field wajib:
          <code>code</code>, <code>name</code>, <code>dateFrom</code>, <code>dateTo</code>,
          <code>insurancePeriod</code>, <code>lumpSum</code>, <code>maxMembers</code>.
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Kode Produk', UiKit.input('prod-code', { value: code, required: true, maxlength: 8, extraClass: 'font-mono uppercase' }))}
          ${UiKit.field('Nama Produk', UiKit.input('prod-name', { placeholder: 'JKN Kelas III', required: true }))}
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Lump Sum (plafon)', UiKit.input('prod-lump', { type: 'number', value: '1200000', required: true }))}
          ${UiKit.field('Max Anggota', UiKit.input('prod-members', { type: 'number', value: '10', required: true }))}
        </div>
        <div class="grid grid-cols-3 gap-2">
          ${UiKit.field('Periode (bulan)', UiKit.input('prod-period', { type: 'number', value: '12', required: true }))}
          ${UiKit.field('Max Cicilan', UiKit.input('prod-inst', { type: 'number', value: '12' }))}
          ${UiKit.field('Threshold', UiKit.input('prod-threshold', { type: 'number', value: '0' }))}
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Premi Dewasa', UiKit.input('prod-adult', { type: 'number', value: '35000' }))}
          ${UiKit.field('Premi Anak', UiKit.input('prod-child', { type: 'number', value: '25000' }))}
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Berlaku Dari', UiKit.input('prod-from', { type: 'date', value: SandboxUtil.today(), required: true }))}
          ${UiKit.field('Berlaku Sampai', UiKit.input('prod-to', { type: 'date', value: SandboxUtil.addYears(SandboxUtil.today(), 5), required: true }))}
        </div>
        ${UiKit.formFooter('Simpan Produk', 'prod-btn-submit')}
      </form>`, { wide: true });
  }

  async function submitCreateProduct(e) {
    e.preventDefault();
    const input = {
      clientMutationId: 'create-product-' + Date.now(),
      code: SandboxUtil.val('prod-code').trim().toUpperCase(),
      name: SandboxUtil.val('prod-name').trim(),
      dateFrom: SandboxUtil.val('prod-from'),
      dateTo: SandboxUtil.val('prod-to'),
      insurancePeriod: Number(SandboxUtil.val('prod-period')),
      lumpSum: String(SandboxUtil.val('prod-lump')),
      maxMembers: Number(SandboxUtil.val('prod-members')),
      maxInstallments: Number(SandboxUtil.val('prod-inst') || 1),
      threshold: Number(SandboxUtil.val('prod-threshold') || 0),
      premiumAdult: String(SandboxUtil.val('prod-adult') || 0),
      premiumChild: String(SandboxUtil.val('prod-child') || 0)
    };

    await UiKit.busy('prod-btn-submit', 'Menyimpan...', async () => {
      try {
        await OpenIMISApi.createProduct(input);
        SandboxUtil.toast(`Produk ${input.code} dibuat`, 'success');
        AppModal.close();
        await loadProducts();
      } catch (err) {
        SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
      }
    });
  }

  function editProduct(uuid) {
    const p = productCache.find(x => x.uuid === uuid);
    if (!p) return;
    AppModal.open(`Edit Produk ${p.code}`, `
      <form onsubmit="PoliciesModule.submitEditProduct(event,'${SandboxUtil.jsStr(uuid)}')" class="space-y-3 text-[11px]">
        <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10.5px] text-amber-900">
          Memanggil <code class="font-mono">updateProduct</code>. Produk yang sudah dipakai polis
          sebaiknya tidak diubah plafonnya — buat produk baru lewat <code>duplicateProduct</code>.
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Kode', UiKit.input('prod-e-code', { value: p.code, required: true, readonly: true, extraClass: 'font-mono bg-slate-100' }))}
          ${UiKit.field('Nama', UiKit.input('prod-e-name', { value: p.name, required: true }))}
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Lump Sum', UiKit.input('prod-e-lump', { type: 'number', value: p.lumpSum, required: true }))}
          ${UiKit.field('Max Anggota', UiKit.input('prod-e-members', { type: 'number', value: p.maxMembers, required: true }))}
        </div>
        <div class="grid grid-cols-3 gap-2">
          ${UiKit.field('Periode', UiKit.input('prod-e-period', { type: 'number', value: p.insurancePeriod, required: true }))}
          ${UiKit.field('Max Cicilan', UiKit.input('prod-e-inst', { type: 'number', value: p.maxInstallments || 1 }))}
          ${UiKit.field('Threshold', UiKit.input('prod-e-threshold', { type: 'number', value: p.threshold || 0 }))}
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Berlaku Dari', UiKit.input('prod-e-from', { type: 'date', value: SandboxUtil.dateOnly(p.dateFrom), required: true }))}
          ${UiKit.field('Berlaku Sampai', UiKit.input('prod-e-to', { type: 'date', value: SandboxUtil.dateOnly(p.dateTo), required: true }))}
        </div>
        ${UiKit.formFooter('Simpan Perubahan', 'prod-e-submit')}
      </form>`, { wide: true });
  }

  async function submitEditProduct(e, uuid) {
    e.preventDefault();
    const input = {
      clientMutationId: 'update-product-' + Date.now(),
      uuid,
      code: SandboxUtil.val('prod-e-code').trim(),
      name: SandboxUtil.val('prod-e-name').trim(),
      dateFrom: SandboxUtil.val('prod-e-from'),
      dateTo: SandboxUtil.val('prod-e-to'),
      insurancePeriod: Number(SandboxUtil.val('prod-e-period')),
      lumpSum: String(SandboxUtil.val('prod-e-lump')),
      maxMembers: Number(SandboxUtil.val('prod-e-members')),
      maxInstallments: Number(SandboxUtil.val('prod-e-inst') || 1),
      threshold: Number(SandboxUtil.val('prod-e-threshold') || 0)
    };
    await UiKit.busy('prod-e-submit', 'Menyimpan...', async () => {
      try {
        await OpenIMISApi.updateProduct(input);
        SandboxUtil.toast('Produk diperbarui', 'success');
        AppModal.close();
        await loadProducts();
      } catch (err) {
        SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
      }
    });
  }

  // ---------------------------------------------------------
  // Policy detail / create / renew / suspend
  // ---------------------------------------------------------
  async function detailPolicy(id) {
    const p = policyCache.find(x => x.id === id);
    if (!p) return;

    AppModal.open('Detail Polis', `
      <div class="space-y-3 text-[11px]">
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
          ${kv('UUID', (p.uuid || '').slice(0, 13) + '…', 'font-mono text-[10px]')}
          ${kv('Produk', p.product ? p.product.name : '-')}
          ${kv('Status', null, '', null, SandboxUtil.policyStatusBadge(p.status))}
          ${kv('Mulai', SandboxUtil.dateOnly(p.startDate))}
          ${kv('Kadaluwarsa', SandboxUtil.dateOnly(p.expiryDate))}
          ${kv('Nilai Polis', SandboxUtil.money(p.value))}
          ${kv('Plafon (dari produk)', SandboxUtil.money(p.product ? p.product.ceiling : null))}
          ${kv('Sisa Saldo', SandboxUtil.money(p.balance))}
          ${kv('Deductible (dari produk)', SandboxUtil.money(p.product ? p.product.deductible : null))}
        </div>
        <div class="pt-2 border-t border-slate-100 flex justify-between">
          <button onclick="GraphQLHelp.previewLast('Query Detail Polis')"
            class="text-[10.5px] text-slate-500 hover:text-sky-600 underline">Lihat GraphQL</button>
          <button onclick="AppModal.close()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold">Tutup</button>
        </div>
      </div>`);
  }

  async function openCreatePolicy() {
    AppModal.open('Terbitkan Polis', `
      <div class="p-6 text-center text-slate-500 text-[11px]">
        <span class="animate-spin inline-block w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full"></span>
        Memuat referensi...
      </div>`);

    let products = [], families = [], officers = [];
    try {
      const [prodConn, famConn, offConn] = await Promise.all([
        OpenIMISApi.getProducts(40),
        OpenIMISApi.getFamilies(60),
        OpenIMISApi.getEnrolmentOfficers(20)
      ]);
      products = SandboxUtil.nodes(prodConn);
      families = SandboxUtil.nodes(famConn);
      officers = SandboxUtil.nodes(offConn);
    } catch (e) {
      SandboxUtil.toast(`Gagal memuat referensi: ${e.message}`, 'error', 6000);
      AppModal.close();
      return;
    }

    const today = SandboxUtil.today();

    AppModal.open('Terbitkan Polis', `
      <form onsubmit="PoliciesModule.submitCreatePolicy(event)" class="space-y-3 text-[11px]">
        <div class="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-[10.5px] text-sky-900">
          Memanggil <code class="font-mono">createPolicy</code>. Field wajib:
          <code>enrollDate</code>, <code>startDate</code>, <code>expiryDate</code>,
          <code>value</code>, <code>productId</code>, <code>familyId</code>, <code>officerId</code>.
        </div>

        ${UiKit.field('Produk', UiKit.select('pol-product', products.map(p =>
          `<option value="${SandboxUtil.relayToId(p.id)}">${SandboxUtil.esc(p.code)} - ${SandboxUtil.esc(p.name)}</option>`).join('')))}

        ${UiKit.field('Keluarga', UiKit.select('pol-family', families.map(f => {
          const head = f.headInsuree || {};
          return `<option value="${SandboxUtil.relayToId(f.id)}">${SandboxUtil.esc(head.lastName || '')} (${SandboxUtil.esc(head.chfId || '-')})</option>`;
        }).join('')))}

        ${officers.length ? UiKit.field('Enrolment Officer', UiKit.select('pol-officer', officers.map(o =>
          `<option value="${SandboxUtil.relayToId(o.id)}">${SandboxUtil.esc(o.code)} - ${SandboxUtil.esc(o.lastName || '')}</option>`).join(''))) : `
          <div class="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10.5px] text-amber-800">
            Tidak ada enrolment officer terdeteksi — ID 1 akan dipakai. Bila gagal, buat officer terlebih dahulu.
          </div>`}

        <div class="grid grid-cols-3 gap-2">
          ${UiKit.field('Tanggal Enroll', UiKit.input('pol-enroll', { type: 'date', value: today, required: true }))}
          ${UiKit.field('Tanggal Mulai', UiKit.input('pol-start', { type: 'date', value: today, required: true }))}
          ${UiKit.field('Kadaluwarsa', UiKit.input('pol-expiry', { type: 'date', value: SandboxUtil.addYears(today, 1), required: true }))}
        </div>

        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Nilai Polis', UiKit.input('pol-value', { type: 'number', value: '150000', required: true }))}
          ${UiKit.field('Sudah Dibayar', UiKit.select('pol-paid', `<option value="false">Belum</option><option value="true">Sudah</option>`))}
        </div>

        ${UiKit.formFooter('Terbitkan Polis', 'pol-btn-submit')}
      </form>`, { wide: true });
  }

  async function submitCreatePolicy(e) {
    e.preventDefault();
    const input = {
      clientMutationId: 'create-policy-' + Date.now(),
      enrollDate: SandboxUtil.val('pol-enroll'),
      startDate: SandboxUtil.val('pol-start'),
      expiryDate: SandboxUtil.val('pol-expiry'),
      value: String(SandboxUtil.val('pol-value')),
      productId: Number(SandboxUtil.val('pol-product')),
      familyId: Number(SandboxUtil.val('pol-family')),
      officerId: Number(SandboxUtil.val('pol-officer') || 1),
      isPaid: SandboxUtil.val('pol-paid') === 'true'
    };

    await UiKit.busy('pol-btn-submit', 'Menerbitkan...', async () => {
      try {
        await OpenIMISApi.createPolicy(input);
        SandboxUtil.toast('Polis berhasil diterbitkan', 'success');
        AppModal.close();
        await loadPolicies();
      } catch (err) {
        SandboxUtil.toast(`Gagal menerbitkan polis: ${err.message}`, 'error', 7000);
      }
    });
  }

  async function renew(uuid, productCode, expiryDate) {
    const policy = policyCache.find(p => p.uuid === uuid);
    if (!policy) return;

    const newStart = expiryDate ? SandboxUtil.addDays(expiryDate, 1) : SandboxUtil.today();
    const newExpiry = SandboxUtil.addYears(newStart, 1);

    const ok = await AppModal.confirm('Perpanjang Polis',
      `Polis akan diperpanjang lewat <code class="font-mono">renewPolicy</code>.<br><br>
       Periode baru: <strong>${newStart}</strong> → <strong>${newExpiry}</strong>`, 'Perpanjang');
    if (!ok) return;

    try {
      await OpenIMISApi.renewPolicy({
        clientMutationId: 'renew-policy-' + Date.now(),
        enrollDate: newStart,
        startDate: newStart,
        expiryDate: newExpiry,
        value: String(policy.value || 0),
        productId: SandboxUtil.relayToId(policy.product ? policy.product.id : null),
        familyId: SandboxUtil.relayToId(policy.family ? policy.family.id : null),
        officerId: SandboxUtil.relayToId(policy.officer ? policy.officer.id : null) || 1
      });
      SandboxUtil.toast('Polis diperpanjang', 'success');
      await loadPolicies();
    } catch (err) {
      SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
    }
  }

  async function suspend(uuid) {
    const ok = await AppModal.confirm('Suspend Polis',
      'Polis akan ditangguhkan lewat <code class="font-mono">suspendPolicies</code>.', 'Suspend');
    if (!ok) return;
    try {
      await OpenIMISApi.suspendPolicies([uuid]);
      SandboxUtil.toast('Polis disuspend', 'success');
      await loadPolicies();
    } catch (err) {
      SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
    }
  }

  return {
    load, loadProducts, loadPolicies,
    detailProduct, openCreateProduct, submitCreateProduct, editProduct, submitEditProduct,
    detailPolicy, openCreatePolicy, submitCreatePolicy, renew, suspend
  };
})();

window.PoliciesModule = PoliciesModule;
