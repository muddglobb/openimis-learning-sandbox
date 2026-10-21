// ============================================================
// Health Facilities & Locations — CRUD
// ============================================================
const FacilitiesModule = (function () {
  let hfCache = [];
  let locCache = [];
  let locationsForSelect = [];

  const LEVEL_LABEL = {
    H: { text: 'Rumah Sakit (FKRTL)', tone: 'bg-red-50 text-red-700 border-red-200' },
    C: { text: 'Puskesmas (FKTP)', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
    D: { text: 'Klinik / Apotik', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  };

  const STATUS_LABEL = {
    AC: { text: 'Aktif', tone: 'bg-emerald-100 text-emerald-800' },
    IN: { text: 'Tidak Aktif', tone: 'bg-slate-100 text-slate-700' },
    DE: { text: 'Delisted', tone: 'bg-red-100 text-red-800' },
    ID: { text: 'Idle', tone: 'bg-amber-100 text-amber-800' }
  };

  async function load() {
    await Promise.all([loadFacilities(), loadLocations()]);
  }

  async function loadFacilities() {
    const container = document.getElementById('facilities-table-body');
    if (!container) return;
    container.innerHTML = SandboxUtil.spinnerRow(7, 'Memuat faskes...');
    try {
      const conn = await OpenIMISApi.getHealthFacilities(60);
      hfCache = SandboxUtil.nodes(conn);
      renderFacilities(hfCache);
    } catch (e) {
      container.innerHTML = SandboxUtil.errorRow(7, `Gagal: ${e.message}`);
    }
  }

  async function loadLocations() {
    const container = document.getElementById('locations-table-body');
    if (!container) return;
    container.innerHTML = SandboxUtil.spinnerRow(5, 'Memuat wilayah...');
    try {
      const conn = await OpenIMISApi.getLocations(60);
      locCache = SandboxUtil.nodes(conn);
      renderLocations(locCache);
    } catch (e) {
      container.innerHTML = SandboxUtil.errorRow(5, `Gagal: ${e.message}`);
    }
  }

  function renderFacilities(data) {
    const container = document.getElementById('facilities-table-body');
    if (!container) return;
    if (!data.length) {
      container.innerHTML = SandboxUtil.emptyRow(7, 'Belum ada faskes.');
      return;
    }
    container.innerHTML = data.map(f => {
      const lvl = LEVEL_LABEL[f.level] || { text: f.level || '-', tone: 'bg-slate-100 text-slate-700' };
      const st = STATUS_LABEL[f.status] || { text: f.status || '-', tone: 'bg-slate-100 text-slate-700' };
      return `<tr class="hover:bg-slate-50 border-b border-slate-100">
        <td class="p-2.5 font-mono font-bold text-sky-700 text-[11px]">${SandboxUtil.esc(f.code)}</td>
        <td class="p-2.5 text-[11px] font-semibold text-slate-800">${SandboxUtil.esc(f.name)}</td>
        <td class="p-2.5">
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${lvl.tone}">${SandboxUtil.esc(lvl.text)}</span>
        </td>
        <td class="p-2.5 text-[10.5px] text-slate-600">${SandboxUtil.esc(f.location ? f.location.name : '-')}</td>
        <td class="p-2.5">
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${st.tone}">${SandboxUtil.esc(st.text)}</span>
        </td>
        <td class="p-2.5 text-[10px] text-slate-500">${SandboxUtil.esc(f.careType === 'B' ? 'Inap + Jalan' : f.careType === 'O' ? 'Rawat Jalan' : f.careType === 'I' ? 'Rawat Inap' : '-')}</td>
        <td class="p-2.5 text-right whitespace-nowrap">
          <button onclick="FacilitiesModule.detail('${SandboxUtil.jsStr(f.uuid)}')"
            class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10.5px]">Detail</button>
          <button onclick="FacilitiesModule.edit('${SandboxUtil.jsStr(f.uuid)}')"
            class="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded text-[10.5px]">Edit</button>
          <button onclick="FacilitiesModule.remove('${SandboxUtil.jsStr(f.uuid)}','${SandboxUtil.jsStr(f.code)}')"
            class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded text-[10.5px]">Hapus</button>
        </td>
      </tr>`;
    }).join('');
  }

  function renderLocations(data) {
    const container = document.getElementById('locations-table-body');
    if (!container) return;
    if (!data.length) {
      container.innerHTML = SandboxUtil.emptyRow(5, 'Belum ada wilayah.');
      return;
    }
    container.innerHTML = data.map(l => `
      <tr class="hover:bg-slate-50 border-b border-slate-100">
        <td class="p-2.5 font-mono font-bold text-slate-700 text-[11px]">${SandboxUtil.esc(l.code || '-')}</td>
        <td class="p-2.5 text-[11px] font-semibold text-slate-800">${SandboxUtil.esc(l.name)}</td>
        <td class="p-2.5 text-[10.5px] text-slate-600">${SandboxUtil.esc(typeLabel(l.type))}</td>
        <td class="p-2.5 text-[10.5px] text-slate-500">${SandboxUtil.esc(l.parent ? l.parent.name : '(teratas)')}</td>
        <td class="p-2.5 text-right">
          <button onclick="FacilitiesModule.removeLocation('${SandboxUtil.jsStr(l.uuid)}','${SandboxUtil.jsStr(l.code)}')"
            class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded text-[10.5px]">Hapus</button>
        </td>
      </tr>`).join('');
  }

  function typeLabel(type) {
    const map = { R: 'Region / Provinsi', D: 'District / Kabupaten', W: 'Ward / Kecamatan', V: 'Village / Desa' };
    return map[type] || type || '-';
  }

  async function ensureLocations() {
    if (locationsForSelect.length) return locationsForSelect;
    try {
      const conn = await OpenIMISApi.getLocations(100);
      locationsForSelect = SandboxUtil.nodes(conn);
    } catch (e) {
      locationsForSelect = [];
    }
    return locationsForSelect;
  }

  function locationOptions(selectedId) {
    return locationsForSelect.map(l => {
      const lid = SandboxUtil.relayToId(l.id);
      const sel = selectedId && lid === Number(selectedId) ? ' selected' : '';
      return `<option value="${lid}"${sel}>${SandboxUtil.esc(l.code || '')} - ${SandboxUtil.esc(l.name)} (${SandboxUtil.esc(typeLabel(l.type))})</option>`;
    }).join('');
  }

  // ---------------------------------------------------------
  // Detail
  // ---------------------------------------------------------
  function detail(uuid) {
    const f = hfCache.find(x => x.uuid === uuid);
    if (!f) return;

    AppModal.open(`Faskes ${f.code}`, `
      <div class="space-y-3 text-[11px]">
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
          ${kv('Kode', f.code, 'font-mono')}
          ${kv('Nama', f.name)}
          ${kv('Level', LEVEL_LABEL[f.level] ? LEVEL_LABEL[f.level].text : f.level)}
          ${kv('Care Type', f.careType === 'B' ? 'Inap + Jalan' : f.careType === 'O' ? 'Rawat Jalan' : 'Rawat Inap')}
          ${kv('Status', STATUS_LABEL[f.status] ? STATUS_LABEL[f.status].text : f.status)}
          ${kv('Badan Hukum', f.legalForm ? f.legalForm.legalForm : '-')}
          ${kv('Wilayah', f.location ? f.location.name : '-')}
          ${kv('Alamat', f.address || '-')}
          ${kv('Telepon', f.phone || '-')}
          ${kv('Email', f.email || '-')}
          ${kv('Acc Code', f.accCode || '-')}
          ${kv('Kontrak', f.contractStartDate ? `${SandboxUtil.dateOnly(f.contractStartDate)} → ${SandboxUtil.dateOnly(f.contractEndDate)}` : '-')}
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${kv('Pricelist Tindakan', f.servicesPricelist ? f.servicesPricelist.name : '-')}
          ${kv('Pricelist Obat', f.itemsPricelist ? f.itemsPricelist.name : '-')}
        </div>
        <div class="pt-2 border-t border-slate-100 flex justify-between">
          <button onclick="GraphQLHelp.previewLast('Query Detail Faskes')"
            class="text-[10.5px] text-slate-500 hover:text-sky-600 underline">Lihat GraphQL</button>
          <button onclick="AppModal.close()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold">Tutup</button>
        </div>
      </div>`, { wide: true });
  }

  function kv(label, value, cls = '') {
    return `<div class="p-2 bg-slate-50 border border-slate-200 rounded-lg">
      <div class="text-[9.5px] text-slate-500 uppercase">${label}</div>
      <div class="font-semibold text-slate-800 ${cls}">${SandboxUtil.esc(value)}</div>
    </div>`;
  }

  // ---------------------------------------------------------
  // Create / Edit
  // ---------------------------------------------------------
  async function openCreate() {
    await ensureLocations();
    const code = 'RS' + Math.floor(Math.random() * 9000 + 1000);

    AppModal.open('Daftarkan Faskes Baru', `
      <form onsubmit="FacilitiesModule.submitCreate(event)" class="space-y-3 text-[11px]">
        <div class="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-[10.5px] text-sky-900">
          Memanggil <code class="font-mono">createHealthFacility</code>. Field wajib:
          <code>code</code>, <code>name</code>, <code>legalFormId</code>, <code>level</code>,
          <code>locationId</code>, <code>careType</code>.
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Kode Faskes', UiKit.input('hf-code', { value: code, required: true, maxlength: 8, extraClass: 'font-mono uppercase' }))}
          ${UiKit.field('Nama Faskes', UiKit.input('hf-name', { placeholder: 'RSUD Sehat Sentosa', required: true }))}
        </div>
        <div class="grid grid-cols-3 gap-2">
          ${UiKit.field('Level', UiKit.select('hf-level',
            `<option value="H">H - Rumah Sakit</option>
             <option value="C">C - Puskesmas</option>
             <option value="D">D - Klinik/Apotik</option>`))}
          ${UiKit.field('Care Type', UiKit.select('hf-care',
            `<option value="B">B - Inap + Jalan</option>
             <option value="O">O - Rawat Jalan</option>
             <option value="I">I - Rawat Inap</option>`))}
          ${UiKit.field('Badan Hukum', UiKit.select('hf-legal',
            `<option value="G">G - Pemerintah</option>
             <option value="P">P - Swasta</option>`))}
        </div>
        ${UiKit.field('Wilayah', UiKit.select('hf-location', locationOptions()))}
        ${UiKit.field('Alamat', UiKit.input('hf-address', { placeholder: 'Jl. Kesehatan No. 1' }))}
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Telepon', UiKit.input('hf-phone', { placeholder: '021-1234567' }))}
          ${UiKit.field('Email', UiKit.input('hf-email', { type: 'email', placeholder: 'rs@contoh.id' }))}
        </div>
        ${UiKit.formFooter('Simpan Faskes', 'hf-btn-submit')}
      </form>`, { wide: true });
  }

  async function submitCreate(e) {
    e.preventDefault();
    const input = {
      clientMutationId: 'create-hf-' + Date.now(),
      code: SandboxUtil.val('hf-code').trim().toUpperCase(),
      name: SandboxUtil.val('hf-name').trim(),
      level: SandboxUtil.val('hf-level'),
      careType: SandboxUtil.val('hf-care'),
      legalFormId: SandboxUtil.val('hf-legal'),
      locationId: Number(SandboxUtil.val('hf-location') || 1)
    };
    const address = SandboxUtil.val('hf-address').trim();
    if (address) input.address = address;
    const phone = SandboxUtil.val('hf-phone').trim();
    if (phone) input.phone = phone;
    const email = SandboxUtil.val('hf-email').trim();
    if (email) input.email = email;

    await UiKit.busy('hf-btn-submit', 'Menyimpan...', async () => {
      try {
        await OpenIMISApi.createHealthFacility(input);
        SandboxUtil.toast(`Faskes ${input.code} terdaftar`, 'success');
        AppModal.close();
        await loadFacilities();
      } catch (err) {
        SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
      }
    });
  }

  async function edit(uuid) {
    const f = hfCache.find(x => x.uuid === uuid);
    if (!f) return;
    await ensureLocations();
    const locId = f.location ? SandboxUtil.relayToId(f.location.id) : null;

    AppModal.open(`Edit Faskes ${f.code}`, `
      <form onsubmit="FacilitiesModule.submitEdit(event,'${SandboxUtil.jsStr(uuid)}')" class="space-y-3 text-[11px]">
        <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10.5px] text-amber-900">
          Memanggil <code class="font-mono">updateHealthFacility</code>.
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Kode', UiKit.input('hf-e-code', { value: f.code, readonly: true, extraClass: 'font-mono bg-slate-100' }))}
          ${UiKit.field('Nama', UiKit.input('hf-e-name', { value: f.name, required: true }))}
        </div>
        <div class="grid grid-cols-3 gap-2">
          ${UiKit.field('Level', UiKit.select('hf-e-level',
            `<option value="H" ${f.level === 'H' ? 'selected' : ''}>H</option>
             <option value="C" ${f.level === 'C' ? 'selected' : ''}>C</option>
             <option value="D" ${f.level === 'D' ? 'selected' : ''}>D</option>`))}
          ${UiKit.field('Care Type', UiKit.select('hf-e-care',
            `<option value="B" ${f.careType === 'B' ? 'selected' : ''}>B</option>
             <option value="O" ${f.careType === 'O' ? 'selected' : ''}>O</option>
             <option value="I" ${f.careType === 'I' ? 'selected' : ''}>I</option>`))}
          ${UiKit.field('Status', UiKit.select('hf-e-status',
            `<option value="AC" ${f.status === 'AC' ? 'selected' : ''}>Aktif</option>
             <option value="IN" ${f.status === 'IN' ? 'selected' : ''}>Tidak Aktif</option>
             <option value="ID" ${f.status === 'ID' ? 'selected' : ''}>Idle</option>`))}
        </div>
        ${UiKit.field('Wilayah', UiKit.select('hf-e-location', locationOptions(locId)))}
        ${UiKit.field('Alamat', UiKit.input('hf-e-address', { value: f.address || '' }))}
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Telepon', UiKit.input('hf-e-phone', { value: f.phone || '' }))}
          ${UiKit.field('Email', UiKit.input('hf-e-email', { value: f.email || '' }))}
        </div>
        ${UiKit.formFooter('Simpan Perubahan', 'hf-e-submit')}
      </form>`, { wide: true });
  }

  async function submitEdit(e, uuid) {
    e.preventDefault();
    const input = {
      clientMutationId: 'update-hf-' + Date.now(),
      uuid,
      code: SandboxUtil.val('hf-e-code').trim(),
      name: SandboxUtil.val('hf-e-name').trim(),
      level: SandboxUtil.val('hf-e-level'),
      careType: SandboxUtil.val('hf-e-care'),
      status: SandboxUtil.val('hf-e-status'),
      legalFormId: 'G',
      locationId: Number(SandboxUtil.val('hf-e-location') || 1)
    };
    const address = SandboxUtil.val('hf-e-address').trim();
    if (address) input.address = address;
    const phone = SandboxUtil.val('hf-e-phone').trim();
    if (phone) input.phone = phone;
    const email = SandboxUtil.val('hf-e-email').trim();
    if (email) input.email = email;

    await UiKit.busy('hf-e-submit', 'Menyimpan...', async () => {
      try {
        await OpenIMISApi.updateHealthFacility(input);
        SandboxUtil.toast('Faskes diperbarui', 'success');
        AppModal.close();
        await loadFacilities();
      } catch (err) {
        SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
      }
    });
  }

  async function remove(uuid, code) {
    const ok = await AppModal.confirm('Hapus Faskes',
      `Faskes <strong>${SandboxUtil.esc(code)}</strong> akan di-soft-delete lewat
       <code class="font-mono">deleteHealthFacility</code>.`, 'Hapus');
    if (!ok) return;
    try {
      await OpenIMISApi.deleteHealthFacility(uuid);
      SandboxUtil.toast('Faskes dihapus', 'success');
      await loadFacilities();
    } catch (err) {
      SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
    }
  }

  // ---------------------------------------------------------
  // Locations
  // ---------------------------------------------------------
  async function openCreateLocation() {
    await ensureLocations();
    const code = 'LOC' + Math.floor(Math.random() * 900 + 100);

    AppModal.open('Buat Wilayah', `
      <form onsubmit="FacilitiesModule.submitCreateLocation(event)" class="space-y-3 text-[11px]">
        <div class="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-[10.5px] text-sky-900">
          Memanggil <code class="font-mono">createLocation</code>.
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Kode', UiKit.input('loc-code', { value: code, required: true, extraClass: 'font-mono uppercase' }))}
          ${UiKit.field('Tipe', UiKit.select('loc-type',
            `<option value="R">R - Provinsi</option>
             <option value="D">D - Kabupaten</option>
             <option value="W">W - Kecamatan</option>
             <option value="V" selected>V - Desa</option>`))}
        </div>
        ${UiKit.field('Nama Wilayah', UiKit.input('loc-name', { placeholder: 'Desa Sejahtera', required: true }))}
        ${UiKit.field('UUID Wilayah Induk', UiKit.input('loc-parent-uuid', { placeholder: 'kosongkan bila wilayah teratas', extraClass: 'font-mono text-[10px]' }), 'LocationInputType memakai parentUuid, bukan id numerik.')}
        ${UiKit.formFooter('Simpan Wilayah', 'loc-btn-submit')}
      </form>`);
  }

  async function submitCreateLocation(e) {
    e.preventDefault();
    const input = {
      clientMutationId: 'create-loc-' + Date.now(),
      code: SandboxUtil.val('loc-code').trim().toUpperCase(),
      name: SandboxUtil.val('loc-name').trim(),
      type: SandboxUtil.val('loc-type')
    };
    // LocationInputType expects parent_uuid (a UUID string), not an integer id.
    const parentUuid = SandboxUtil.val('loc-parent-uuid').trim();
    if (parentUuid) input.parentUuid = parentUuid;

    await UiKit.busy('loc-btn-submit', 'Menyimpan...', async () => {
      try {
        await OpenIMISApi.createLocation(input);
        SandboxUtil.toast('Wilayah dibuat', 'success');
        AppModal.close();
        locationsForSelect = [];
        await loadLocations();
      } catch (err) {
        SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
      }
    });
  }

  async function removeLocation(uuid, code) {
    const ok = await AppModal.confirm('Hapus Wilayah',
      `Wilayah <strong>${SandboxUtil.esc(code)}</strong> akan di-soft-delete.`, 'Hapus');
    if (!ok) return;
    try {
      await OpenIMISApi.deleteLocation(uuid);
      SandboxUtil.toast('Wilayah dihapus', 'success');
      locationsForSelect = [];
      await loadLocations();
    } catch (err) {
      SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
    }
  }

  return {
    load, detail, openCreate, submitCreate, edit, submitEdit, remove,
    openCreateLocation, submitCreateLocation, removeLocation
  };
})();

window.FacilitiesModule = FacilitiesModule;
