// ============================================================
// Medical catalog — diagnoses, items, services (CRUD)
// ============================================================
const MedicalModule = (function () {
  let activeTab = 'diagnoses';
  let caches = { diagnoses: [], items: [], services: [] };
  let searchTerm = '';

  async function load(tab = 'diagnoses') {
    activeTab = tab;
    updateSubTabs();
    const container = document.getElementById('medical-content-box');
    if (!container) return;

    container.innerHTML = `<div class="p-8 text-center text-slate-500 text-xs">
      <span class="animate-spin inline-block w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full"></span>
      Memuat katalog...</div>`;

    try {
      if (tab === 'diagnoses') {
        const conn = await OpenIMISApi.getDiagnoses(60, searchTerm || null);
        caches.diagnoses = SandboxUtil.nodes(conn);
        renderDiagnoses(caches.diagnoses);
      } else if (tab === 'items') {
        const conn = await OpenIMISApi.getMedicalItems(60, searchTerm || null);
        caches.items = SandboxUtil.nodes(conn);
        renderItems(caches.items);
      } else {
        const conn = await OpenIMISApi.getMedicalServices(60, searchTerm || null);
        caches.services = SandboxUtil.nodes(conn);
        renderServices(caches.services);
      }
    } catch (err) {
      container.innerHTML = `<div class="p-8 text-center text-red-600 text-xs">Gagal memuat katalog: ${SandboxUtil.esc(err.message)}</div>`;
    }
  }

  function updateSubTabs() {
    ['diagnoses', 'items', 'services'].forEach(t => {
      const btn = document.getElementById(`subtab-med-${t}`);
      if (!btn) return;
      btn.className = t === activeTab
        ? 'px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 text-white shadow-sm'
        : 'px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white text-slate-600 hover:bg-slate-50 shadow-sm';
    });
    const addBtn = document.getElementById('medical-btn-add');
    if (addBtn) addBtn.style.display = activeTab === 'diagnoses' ? 'none' : 'inline-flex';
  }

  function onSearch(value) {
    searchTerm = value.trim();
    clearTimeout(onSearch._t);
    onSearch._t = setTimeout(() => load(activeTab), 350);
  }

  function tableWrap(headers, rows) {
    return `<div class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
          <tr>${headers.map(h => `<th class="p-2.5">${h}</th>`).join('')}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  function renderDiagnoses(data) {
    const container = document.getElementById('medical-content-box');
    if (!container) return;
    if (!data.length) {
      container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">Tidak ada diagnosis.</div>`;
      return;
    }
    container.innerHTML = tableWrap(
      ['KODE ICD-10', 'NAMA DIAGNOSIS', 'STANDAR'],
      data.map(d => `<tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="p-2.5 font-mono font-bold text-sky-700 text-[11px]">${SandboxUtil.esc(d.code)}</td>
        <td class="p-2.5 text-[11px] font-medium text-slate-800">${SandboxUtil.esc(d.name)}</td>
        <td class="p-2.5 text-[10.5px] text-slate-500">ICD-10</td>
      </tr>`).join('')
    );
  }

  function renderItems(data) {
    const container = document.getElementById('medical-content-box');
    if (!container) return;
    if (!data.length) {
      container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">Tidak ada obat/alkes.</div>`;
      return;
    }
    container.innerHTML = tableWrap(
      ['KODE', 'NAMA OBAT / ALKES', 'TIPE', 'CARE', 'HARGA', 'AKSI'],
      data.map(i => `<tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="p-2.5 font-mono font-bold text-emerald-700 text-[11px]">${SandboxUtil.esc(i.code)}</td>
        <td class="p-2.5 text-[11px] font-medium text-slate-800">${SandboxUtil.esc(i.name)}</td>
        <td class="p-2.5 text-[10.5px] text-slate-500">${SandboxUtil.esc(i.type || '-')}</td>
        <td class="p-2.5 text-[10.5px] text-slate-500">${SandboxUtil.esc(i.careType || '-')}</td>
        <td class="p-2.5 text-right font-mono text-[10.5px] text-slate-800">${SandboxUtil.money(i.price)}</td>
        <td class="p-2.5 text-right whitespace-nowrap">
          <button onclick="MedicalModule.editItem('${SandboxUtil.jsStr(i.uuid)}')"
            class="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded text-[10.5px]">Edit</button>
          <button onclick="MedicalModule.removeItem('${SandboxUtil.jsStr(i.uuid)}','${SandboxUtil.jsStr(i.code)}')"
            class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded text-[10.5px]">Hapus</button>
        </td>
      </tr>`).join('')
    );
  }

  function renderServices(data) {
    const container = document.getElementById('medical-content-box');
    if (!container) return;
    if (!data.length) {
      container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">Tidak ada tindakan.</div>`;
      return;
    }
    container.innerHTML = tableWrap(
      ['KODE', 'NAMA TINDAKAN', 'LEVEL', 'CARE', 'TARIF', 'AKSI'],
      data.map(s => `<tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="p-2.5 font-mono font-bold text-purple-700 text-[11px]">${SandboxUtil.esc(s.code)}</td>
        <td class="p-2.5 text-[11px] font-medium text-slate-800">${SandboxUtil.esc(s.name)}</td>
        <td class="p-2.5 text-[10.5px] text-slate-500">${SandboxUtil.esc(s.level || '-')}</td>
        <td class="p-2.5 text-[10.5px] text-slate-500">${SandboxUtil.esc(s.careType || '-')}</td>
        <td class="p-2.5 text-right font-mono text-[10.5px] text-slate-800">${SandboxUtil.money(s.price)}</td>
        <td class="p-2.5 text-right whitespace-nowrap">
          <button onclick="MedicalModule.editService('${SandboxUtil.jsStr(s.uuid)}')"
            class="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded text-[10.5px]">Edit</button>
          <button onclick="MedicalModule.removeService('${SandboxUtil.jsStr(s.uuid)}','${SandboxUtil.jsStr(s.code)}')"
            class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded text-[10.5px]">Hapus</button>
        </td>
      </tr>`).join('')
    );
  }

  // ---------------------------------------------------------
  // Items CRUD
  // ---------------------------------------------------------
  function openCreateItem() {
    const code = 'I' + Math.floor(Math.random() * 900 + 100);
    AppModal.open('Buat Obat / Alkes', `
      <form onsubmit="MedicalModule.submitCreateItem(event)" class="space-y-3 text-[11px]">
        <div class="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-[10.5px] text-sky-900">
          Memanggil <code class="font-mono">createItem</code>. Field wajib:
          <code>code</code>, <code>name</code>, <code>type</code>, <code>price</code>,
          <code>careType</code>, <code>patientCategory</code>.
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Kode', UiKit.input('mi-code', { value: code, required: true, maxlength: 6, extraClass: 'font-mono uppercase' }))}
          ${UiKit.field('Nama', UiKit.input('mi-name', { placeholder: 'Paracetamol 500mg', required: true }))}
        </div>
        <div class="grid grid-cols-3 gap-2">
          ${UiKit.field('Tipe', UiKit.select('mi-type',
            `<option value="D">D - Obat</option><option value="M">M - Alkes</option>`))}
          ${UiKit.field('Care Type', UiKit.select('mi-care',
            `<option value="B">B - Keduanya</option><option value="O">O - Rawat Jalan</option><option value="I">I - Rawat Inap</option>`))}
          ${UiKit.field('Harga', UiKit.input('mi-price', { type: 'number', value: '5000', required: true }))}
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Patient Category', UiKit.input('mi-patcat', { type: 'number', value: '15' }))}
          ${UiKit.field('Package', UiKit.input('mi-package', { placeholder: 'opsional' }))}
        </div>
        ${UiKit.formFooter('Simpan Obat', 'mi-btn-submit')}
      </form>`, { wide: true });
  }

  async function submitCreateItem(e) {
    e.preventDefault();
    const input = {
      clientMutationId: 'create-item-' + Date.now(),
      code: SandboxUtil.val('mi-code').trim().toUpperCase(),
      name: SandboxUtil.val('mi-name').trim(),
      type: SandboxUtil.val('mi-type'),
      careType: SandboxUtil.val('mi-care'),
      price: String(SandboxUtil.val('mi-price')),
      patientCategory: Number(SandboxUtil.val('mi-patcat') || 15)
    };
    const pkg = SandboxUtil.val('mi-package').trim();
    if (pkg) input.package = pkg;

    await UiKit.busy('mi-btn-submit', 'Menyimpan...', async () => {
      try {
        await OpenIMISApi.createItem(input);
        SandboxUtil.toast(`Obat ${input.code} dibuat`, 'success');
        AppModal.close();
        await load('items');
      } catch (err) {
        SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
      }
    });
  }

  function editItem(uuid) {
    const it = caches.items.find(x => x.uuid === uuid);
    if (!it) return;
    AppModal.open(`Edit Obat ${it.code}`, `
      <form onsubmit="MedicalModule.submitEditItem(event,'${SandboxUtil.jsStr(uuid)}')" class="space-y-3 text-[11px]">
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Kode', UiKit.input('mi-e-code', { value: it.code, required: true, readonly: true, extraClass: 'font-mono bg-slate-100' }))}
          ${UiKit.field('Nama', UiKit.input('mi-e-name', { value: it.name, required: true }))}
        </div>
        <div class="grid grid-cols-3 gap-2">
          ${UiKit.field('Tipe', UiKit.select('mi-e-type',
            `<option value="D" ${it.type === 'D' ? 'selected' : ''}>D - Obat</option>
             <option value="M" ${it.type === 'M' ? 'selected' : ''}>M - Alkes</option>`))}
          ${UiKit.field('Care Type', UiKit.select('mi-e-care',
            `<option value="B" ${it.careType === 'B' ? 'selected' : ''}>B - Keduanya</option>
             <option value="O" ${it.careType === 'O' ? 'selected' : ''}>O - Rawat Jalan</option>
             <option value="I" ${it.careType === 'I' ? 'selected' : ''}>I - Rawat Inap</option>`))}
          ${UiKit.field('Harga', UiKit.input('mi-e-price', { type: 'number', value: it.price, required: true }))}
        </div>
        ${UiKit.formFooter('Simpan Perubahan', 'mi-e-submit')}
      </form>`);
  }

  async function submitEditItem(e, uuid) {
    e.preventDefault();
    const input = {
      clientMutationId: 'update-item-' + Date.now(),
      uuid,
      code: SandboxUtil.val('mi-e-code').trim(),
      name: SandboxUtil.val('mi-e-name').trim(),
      type: SandboxUtil.val('mi-e-type'),
      careType: SandboxUtil.val('mi-e-care'),
      price: String(SandboxUtil.val('mi-e-price')),
      patientCategory: 15
    };
    await UiKit.busy('mi-e-submit', 'Menyimpan...', async () => {
      try {
        await OpenIMISApi.updateItem(input);
        SandboxUtil.toast('Obat diperbarui', 'success');
        AppModal.close();
        await load('items');
      } catch (err) {
        SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
      }
    });
  }

  async function removeItem(uuid, code) {
    const ok = await AppModal.confirm('Hapus Obat',
      `Obat <strong>${SandboxUtil.esc(code)}</strong> akan di-soft-delete lewat <code class="font-mono">deleteItem</code>.`, 'Hapus');
    if (!ok) return;
    try {
      await OpenIMISApi.deleteItem(uuid);
      SandboxUtil.toast('Obat dihapus', 'success');
      await load('items');
    } catch (err) {
      SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
    }
  }

  // ---------------------------------------------------------
  // Services CRUD
  // ---------------------------------------------------------
  function openCreateService() {
    const code = 'S' + Math.floor(Math.random() * 900 + 100);
    AppModal.open('Buat Tindakan Medis', `
      <form onsubmit="MedicalModule.submitCreateService(event)" class="space-y-3 text-[11px]">
        <div class="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-[10.5px] text-sky-900">
          Memanggil <code class="font-mono">createService</code>. Field wajib:
          <code>code</code>, <code>name</code>, <code>type</code>, <code>level</code>,
          <code>price</code>, <code>careType</code>, <code>patientCategory</code>.
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Kode', UiKit.input('ms-code', { value: code, required: true, maxlength: 6, extraClass: 'font-mono uppercase' }))}
          ${UiKit.field('Nama', UiKit.input('ms-name', { placeholder: 'Konsultasi Dokter Umum', required: true }))}
        </div>
        <div class="grid grid-cols-4 gap-2">
          ${UiKit.field('Tipe', UiKit.select('ms-type',
            `<option value="D">D</option><option value="M">M</option>`))}
          ${UiKit.field('Level', UiKit.select('ms-level',
            `<option value="H">H - RS</option><option value="C">C - Puskesmas</option><option value="D">D - Klinik</option>`))}
          ${UiKit.field('Care', UiKit.select('ms-care',
            `<option value="B">B</option><option value="O">O</option><option value="I">I</option>`))}
          ${UiKit.field('Tarif', UiKit.input('ms-price', { type: 'number', value: '50000', required: true }))}
        </div>
        ${UiKit.formFooter('Simpan Tindakan', 'ms-btn-submit')}
      </form>`, { wide: true });
  }

  async function submitCreateService(e) {
    e.preventDefault();
    const input = {
      clientMutationId: 'create-service-' + Date.now(),
      code: SandboxUtil.val('ms-code').trim().toUpperCase(),
      name: SandboxUtil.val('ms-name').trim(),
      type: SandboxUtil.val('ms-type'),
      level: SandboxUtil.val('ms-level'),
      careType: SandboxUtil.val('ms-care'),
      price: String(SandboxUtil.val('ms-price')),
      patientCategory: 15
    };
    await UiKit.busy('ms-btn-submit', 'Menyimpan...', async () => {
      try {
        await OpenIMISApi.createService(input);
        SandboxUtil.toast(`Tindakan ${input.code} dibuat`, 'success');
        AppModal.close();
        await load('services');
      } catch (err) {
        SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
      }
    });
  }

  function editService(uuid) {
    const s = caches.services.find(x => x.uuid === uuid);
    if (!s) return;
    AppModal.open(`Edit Tindakan ${s.code}`, `
      <form onsubmit="MedicalModule.submitEditService(event,'${SandboxUtil.jsStr(uuid)}')" class="space-y-3 text-[11px]">
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Kode', UiKit.input('ms-e-code', { value: s.code, required: true, readonly: true, extraClass: 'font-mono bg-slate-100' }))}
          ${UiKit.field('Nama', UiKit.input('ms-e-name', { value: s.name, required: true }))}
        </div>
        <div class="grid grid-cols-3 gap-2">
          ${UiKit.field('Level', UiKit.select('ms-e-level',
            `<option value="H" ${s.level === 'H' ? 'selected' : ''}>H</option>
             <option value="C" ${s.level === 'C' ? 'selected' : ''}>C</option>
             <option value="D" ${s.level === 'D' ? 'selected' : ''}>D</option>`))}
          ${UiKit.field('Care', UiKit.select('ms-e-care',
            `<option value="B" ${s.careType === 'B' ? 'selected' : ''}>B</option>
             <option value="O" ${s.careType === 'O' ? 'selected' : ''}>O</option>
             <option value="I" ${s.careType === 'I' ? 'selected' : ''}>I</option>`))}
          ${UiKit.field('Tarif', UiKit.input('ms-e-price', { type: 'number', value: s.price, required: true }))}
        </div>
        ${UiKit.formFooter('Simpan Perubahan', 'ms-e-submit')}
      </form>`);
  }

  async function submitEditService(e, uuid) {
    e.preventDefault();
    const input = {
      clientMutationId: 'update-service-' + Date.now(),
      uuid,
      code: SandboxUtil.val('ms-e-code').trim(),
      name: SandboxUtil.val('ms-e-name').trim(),
      type: 'D',
      level: SandboxUtil.val('ms-e-level'),
      careType: SandboxUtil.val('ms-e-care'),
      price: String(SandboxUtil.val('ms-e-price')),
      patientCategory: 15
    };
    await UiKit.busy('ms-e-submit', 'Menyimpan...', async () => {
      try {
        await OpenIMISApi.updateService(input);
        SandboxUtil.toast('Tindakan diperbarui', 'success');
        AppModal.close();
        await load('services');
      } catch (err) {
        SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
      }
    });
  }

  async function removeService(uuid, code) {
    const ok = await AppModal.confirm('Hapus Tindakan',
      `Tindakan <strong>${SandboxUtil.esc(code)}</strong> akan di-soft-delete lewat <code class="font-mono">deleteService</code>.`, 'Hapus');
    if (!ok) return;
    try {
      await OpenIMISApi.deleteService(uuid);
      SandboxUtil.toast('Tindakan dihapus', 'success');
      await load('services');
    } catch (err) {
      SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
    }
  }

  function openAdd() {
    if (activeTab === 'items') openCreateItem();
    else if (activeTab === 'services') openCreateService();
    else SandboxUtil.toast('Diagnosis ICD-10 dikelola lewat master data, tidak bisa ditambah dari sini.', 'info', 5000);
  }

  return {
    load, onSearch, openAdd,
    openCreateItem, submitCreateItem, editItem, submitEditItem, removeItem,
    openCreateService, submitCreateService, editService, submitEditService, removeService
  };
})();

window.MedicalModule = MedicalModule;
