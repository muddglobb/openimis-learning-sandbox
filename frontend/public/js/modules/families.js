// ============================================================
// Families (Kartu Keluarga) — CRUD + member management
// ============================================================
const FamiliesModule = (function () {
  let cache = [];
  let locations = [];

  async function loadLocations() {
    if (locations.length) return locations;
    try {
      const conn = await OpenIMISApi.getLocations(60);
      locations = SandboxUtil.nodes(conn);
    } catch (e) {
      locations = [];
    }
    return locations;
  }

  async function load() {
    const container = document.getElementById('families-table-body');
    if (!container) return;
    container.innerHTML = SandboxUtil.spinnerRow(7, 'Memuat data keluarga...');

    try {
      const conn = await OpenIMISApi.getFamilies(40);
      cache = SandboxUtil.nodes(conn);
      renderTable(cache, SandboxUtil.totalCount(conn));
    } catch (err) {
      container.innerHTML = SandboxUtil.errorRow(7, `Gagal memuat keluarga: ${err.message}`);
    }
  }

  function renderTable(data, total) {
    const container = document.getElementById('families-table-body');
    if (!container) return;

    const counter = document.getElementById('families-count');
    if (counter) counter.innerText = `${data.length} dari ${total !== undefined ? total : data.length} keluarga`;

    if (!data.length) {
      container.innerHTML = SandboxUtil.emptyRow(7, 'Belum ada data keluarga.');
      return;
    }

    container.innerHTML = data.map(f => {
      const head = f.headInsuree || {};
      return `<tr class="hover:bg-slate-50/80 border-b border-slate-100">
        <td class="p-2.5 font-mono text-[10px] text-slate-500">${SandboxUtil.esc((f.uuid || '').slice(0, 8))}…</td>
        <td class="p-2.5">
          <div class="font-semibold text-slate-800 text-[11px]">${SandboxUtil.esc(head.otherNames || '')} ${SandboxUtil.esc(head.lastName || '')}</div>
          <div class="text-[10px] text-slate-400 font-mono">${SandboxUtil.esc(head.chfId || '-')}</div>
        </td>
        <td class="p-2.5 text-[11px] max-w-[200px] truncate">${SandboxUtil.esc(f.address || '-')}</td>
        <td class="p-2.5 text-[11px]">${SandboxUtil.esc(f.location ? f.location.name : '-')}</td>
        <td class="p-2.5">${f.poverty
          ? '<span class="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px]">Poverty</span>'
          : '<span class="text-[10px] text-slate-400">-</span>'}</td>
        <td class="p-2.5 font-mono text-[10px] text-slate-500">${SandboxUtil.esc(f.confirmationNo || '-')}</td>
        <td class="p-2.5 text-right whitespace-nowrap">
          <button onclick="FamiliesModule.members('${SandboxUtil.jsStr(f.id)}','${SandboxUtil.jsStr(f.uuid)}')"
            class="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded text-[10.5px]">Anggota</button>
          <button onclick="FamiliesModule.edit('${SandboxUtil.jsStr(f.id)}')"
            class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10.5px]">Edit</button>
          <button onclick="FamiliesModule.remove('${SandboxUtil.jsStr(f.uuid)}')"
            class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded text-[10.5px]">Hapus</button>
        </td>
      </tr>`;
    }).join('');
  }

  function search(keyword) {
    const q = (keyword || '').toLowerCase().trim();
    if (!q) { renderTable(cache); return; }
    renderTable(cache.filter(f =>
      (f.address || '').toLowerCase().includes(q) ||
      (f.headInsuree?.chfId || '').toLowerCase().includes(q) ||
      (f.headInsuree?.lastName || '').toLowerCase().includes(q)
    ));
  }

  // ---------------------------------------------------------
  // Members
  // ---------------------------------------------------------
  async function members(id, uuid) {
    AppModal.open('Anggota Keluarga', `
      <div class="p-6 text-center text-slate-500 text-[11px]">
        <span class="animate-spin inline-block w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full"></span>
        Memuat anggota...
      </div>`);

    let list = [];
    try {
      const conn = await OpenIMISApi.getFamilyMembers(50, uuid);
      list = SandboxUtil.nodes(conn);
    } catch (e) { /* ignore */ }

    const family = cache.find(f => f.id === id) || {};
    const headId = family.headInsuree ? family.headInsuree.id : null;

    const html = `
      <div class="space-y-3 text-[11px]">
        <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
          <div class="text-[10px] text-slate-500">Alamat</div>
          <div class="font-semibold">${SandboxUtil.esc(family.address || '-')}</div>
        </div>

        ${list.length ? `
          <div class="overflow-x-auto rounded-lg border border-slate-200">
            <table class="w-full text-[10.5px]">
              <thead class="bg-slate-50 text-slate-600"><tr>
                <th class="p-2 text-left">CHFID</th>
                <th class="p-2 text-left">Nama</th>
                <th class="p-2 text-left">Lahir</th>
                <th class="p-2 text-left">Hubungan</th>
                <th class="p-2 text-left">Status</th>
                <th class="p-2 text-right">Aksi</th>
              </tr></thead>
              <tbody>
                ${list.map(m => `<tr class="border-t border-slate-100">
                  <td class="p-2 font-mono text-sky-700">${SandboxUtil.esc(m.chfId)}</td>
                  <td class="p-2 font-semibold">${SandboxUtil.esc(m.otherNames || '')} ${SandboxUtil.esc(m.lastName || '')}</td>
                  <td class="p-2">${SandboxUtil.dateOnly(m.dob)}</td>
                  <td class="p-2">${SandboxUtil.esc(m.relation ? m.relation.relation : '-')}</td>
                  <td class="p-2">${m.head
                    ? '<span class="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9.5px] font-semibold">Kepala</span>'
                    : '<span class="text-slate-400 text-[9.5px]">Anggota</span>'}</td>
                  <td class="p-2 text-right">
                    ${!m.head ? `<button onclick="FamiliesModule.setHead('${SandboxUtil.jsStr(uuid)}','${SandboxUtil.jsStr(m.uuid)}')"
                      class="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[9.5px]">Jadikan Kepala</button>` : ''}
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>` : `<div class="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500">Tidak ada anggota.</div>`}

        <div class="pt-2 border-t border-slate-100 flex justify-between items-center">
          <button onclick="GraphQLHelp.previewLast('Query Anggota Keluarga')"
            class="text-[10.5px] text-slate-500 hover:text-sky-600 underline">Lihat GraphQL</button>
          <button onclick="AppModal.close()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold">Tutup</button>
        </div>
      </div>`;

    AppModal.open('Anggota Keluarga', html, { wide: true });
  }

  async function setHead(familyUuid, insureeUuid) {
    try {
      await OpenIMISApi.setFamilyHead(familyUuid, insureeUuid);
      SandboxUtil.toast('Kepala keluarga diperbarui', 'success');
      AppModal.close();
      await load();
    } catch (e) {
      SandboxUtil.toast(`Gagal: ${e.message}`, 'error', 5000);
    }
  }

  // ---------------------------------------------------------
  // Create / Edit
  // ---------------------------------------------------------
  async function openCreate() {
    await loadLocations();
    const locOptions = locations.map(l => `<option value="${SandboxUtil.relayToId(l.id)}">${SandboxUtil.esc(l.code)} - ${SandboxUtil.esc(l.name)}</option>`).join('');
    const chfId = SandboxUtil.newChfId();

    AppModal.open('Buat Keluarga Baru', `
      <form onsubmit="FamiliesModule.submitCreate(event)" class="space-y-3 text-[11px]">
        <div class="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-[10.5px] text-sky-900">
          Memanggil <code class="font-mono">createFamily</code>. openIMIS mewajibkan setiap keluarga
          punya <strong>headInsuree</strong> — kepala keluarga dibuat sekaligus dalam satu mutation.
        </div>

        ${UiKit.field('Wilayah', UiKit.select('fam-location', locOptions || '<option value="1">-</option>'))}
        ${UiKit.field('Alamat', UiKit.input('fam-address', { placeholder: 'Jl. Contoh No. 1, RT 02/RW 03' }))}

        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Tipe Keluarga', UiKit.select('fam-type',
            `<option value="H">Kepala Keluarga (H)</option>
             <option value="S">Single (S)</option>
             <option value="O">Lainnya (O)</option>`))}
          ${UiKit.field('Status Kemiskinan', UiKit.select('fam-poverty',
            `<option value="false">Tidak</option><option value="true">Ya (PBI)</option>`))}
        </div>

        <div class="pt-2 border-t border-slate-100">
          <div class="font-bold text-slate-700 text-[11px] mb-2">Data Kepala Keluarga</div>
          <div class="grid grid-cols-2 gap-2">
            ${UiKit.field('CHFID', UiKit.input('fam-head-chfid', { value: chfId, required: true, extraClass: 'font-mono' }))}
            ${UiKit.field('Gender', UiKit.select('fam-head-gender',
              `<option value="M">Laki-laki (M)</option><option value="F">Perempuan (F)</option>`))}
          </div>
          <div class="grid grid-cols-2 gap-2 mt-2">
            ${UiKit.field('Nama Depan', UiKit.input('fam-head-other', { placeholder: 'Budi', required: true }))}
            ${UiKit.field('Nama Belakang', UiKit.input('fam-head-last', { placeholder: 'Pratama', required: true }))}
          </div>
          <div class="mt-2">
            ${UiKit.field('Tanggal Lahir', UiKit.input('fam-head-dob', { type: 'date', value: '1985-01-01', required: true }))}
          </div>
        </div>

        ${UiKit.formFooter('Simpan Keluarga', 'fam-btn-submit')}
      </form>
    `, { wide: true });
  }

  async function submitCreate(e) {
    e.preventDefault();
    const input = {
      clientMutationId: 'create-family-' + Date.now(),
      locationId: Number(SandboxUtil.val('fam-location') || 1),
      familyTypeId: SandboxUtil.val('fam-type') || 'H',
      poverty: SandboxUtil.val('fam-poverty') === 'true',
      headInsuree: {
        chfId: SandboxUtil.val('fam-head-chfid').trim(),
        lastName: SandboxUtil.val('fam-head-last').trim(),
        otherNames: SandboxUtil.val('fam-head-other').trim(),
        genderId: SandboxUtil.val('fam-head-gender'),
        dob: SandboxUtil.val('fam-head-dob'),
        head: true
      }
    };
    const address = SandboxUtil.val('fam-address').trim();
    if (address) input.address = address;

    await UiKit.busy('fam-btn-submit', 'Menyimpan...', async () => {
      try {
        await OpenIMISApi.createFamily(input);
        SandboxUtil.toast('Keluarga berhasil dibuat', 'success', 4000);
        AppModal.close();
        await load();
      } catch (err) {
        SandboxUtil.toast(`Gagal membuat keluarga: ${err.message}`, 'error', 6000);
      }
    });
  }

  async function edit(id) {
    const family = cache.find(f => f.id === id);
    if (!family) return;
    await loadLocations();

    const locOptions = locations.map(l => {
      const lid = SandboxUtil.relayToId(l.id);
      const selected = family.location && SandboxUtil.relayToId(family.location.id) === lid ? ' selected' : '';
      return `<option value="${lid}"${selected}>${SandboxUtil.esc(l.code)} - ${SandboxUtil.esc(l.name)}</option>`;
    }).join('');

    AppModal.open('Edit Keluarga', `
      <form onsubmit="FamiliesModule.submitEdit(event,'${SandboxUtil.jsStr(family.uuid)}')" class="space-y-3 text-[11px]">
        <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10.5px] text-amber-900">
          Memanggil <code class="font-mono">updateFamily</code>. Ubah kepala keluarga lewat
          <code class="font-mono">setFamilyHead</code> di tab Anggota.
        </div>
        ${UiKit.field('Wilayah', UiKit.select('fam-edit-location', locOptions || '<option value="1">-</option>'))}
        ${UiKit.field('Alamat', UiKit.input('fam-edit-address', { value: family.address || '' }))}
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Tipe Keluarga', UiKit.select('fam-edit-type',
            `<option value="H" ${family.familyType && family.familyType.code === 'H' ? 'selected' : ''}>Kepala Keluarga (H)</option>
             <option value="S" ${family.familyType && family.familyType.code === 'S' ? 'selected' : ''}>Single (S)</option>
             <option value="O" ${family.familyType && family.familyType.code === 'O' ? 'selected' : ''}>Lainnya (O)</option>`))}
          ${UiKit.field('Status Kemiskinan', UiKit.select('fam-edit-poverty',
            `<option value="false" ${!family.poverty ? 'selected' : ''}>Tidak</option>
             <option value="true" ${family.poverty ? 'selected' : ''}>Ya (PBI)</option>`))}
        </div>
        ${UiKit.formFooter('Simpan Perubahan', 'fam-edit-submit')}
      </form>
    `, { wide: true });
  }

  async function submitEdit(e, uuid) {
    e.preventDefault();
    const input = {
      clientMutationId: 'update-family-' + Date.now(),
      uuid,
      locationId: Number(SandboxUtil.val('fam-edit-location') || 1),
      familyTypeId: SandboxUtil.val('fam-edit-type') || 'H',
      poverty: SandboxUtil.val('fam-edit-poverty') === 'true'
    };
    const address = SandboxUtil.val('fam-edit-address').trim();
    if (address) input.address = address;

    await UiKit.busy('fam-edit-submit', 'Menyimpan...', async () => {
      try {
        await OpenIMISApi.updateFamily(input);
        SandboxUtil.toast('Keluarga diperbarui', 'success');
        AppModal.close();
        await load();
      } catch (err) {
        SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
      }
    });
  }

  async function remove(uuid) {
    const ok = await AppModal.confirm('Hapus Keluarga',
      'Keluarga akan di-soft-delete lewat <code class="font-mono">deleteFamilies</code>.', 'Hapus');
    if (!ok) return;
    try {
      await OpenIMISApi.deleteFamilies([uuid]);
      SandboxUtil.toast('Keluarga dihapus', 'success');
      await load();
    } catch (err) {
      SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 6000);
    }
  }

  return { load, search, members, setHead, openCreate, submitCreate, edit, submitEdit, remove };
})();

window.FamiliesModule = FamiliesModule;
