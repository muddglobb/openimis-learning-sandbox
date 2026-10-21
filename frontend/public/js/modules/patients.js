// ============================================================
// Patients / Insurees — full CRUD
// ============================================================
const PatientsModule = (function () {
  let cache = [];
  let refs = { genders: [], relations: [], professions: [], educations: [], idTypes: [], hfs: [], families: [] };
  let refsLoaded = false;

  async function ensureRefs() {
    if (refsLoaded) return;
    try {
      const [genders, relations, hfs] = await Promise.all([
        OpenIMISApi.getInsureeGenders().catch(() => []),
        OpenIMISApi.getRelations().catch(() => []),
        OpenIMISApi.getHealthFacilities(60).then(c => SandboxUtil.nodes(c)).catch(() => [])
      ]);
      refs.genders = genders;
      refs.relations = relations;
      refs.hfs = hfs;
      refsLoaded = true;
    } catch (e) {
      console.warn('reference data partially unavailable', e);
    }
  }

  // ---------------------------------------------------------
  // List
  // ---------------------------------------------------------
  async function load(filters = {}) {
    const container = document.getElementById('patients-table-body');
    if (!container) return;

    container.innerHTML = SandboxUtil.spinnerRow(8, 'Memuat peserta dari OpenIMIS...');

    try {
      const conn = await OpenIMISApi.getInsurees(50, filters);
      cache = SandboxUtil.nodes(conn);
      renderTable(cache, SandboxUtil.totalCount(conn));
    } catch (err) {
      container.innerHTML = SandboxUtil.errorRow(8, `Gagal memuat peserta: ${err.message}`);
    }
  }

  function renderTable(data, total) {
    const container = document.getElementById('patients-table-body');
    if (!container) return;

    const counter = document.getElementById('patients-count');
    if (counter) counter.innerText = `${data.length} dari ${total !== undefined ? total : data.length} peserta`;

    if (!data.length) {
      container.innerHTML = SandboxUtil.emptyRow(8, 'Tidak ada peserta ditemukan.');
      return;
    }

    container.innerHTML = data.map(p => `
      <tr class="hover:bg-slate-50/80 border-b border-slate-100">
        <td class="p-2.5 font-mono font-bold text-sky-700 text-[11px]">${SandboxUtil.esc(p.chfId || '-')}</td>
        <td class="p-2.5">
          <div class="font-semibold text-slate-800 text-[11px]">${SandboxUtil.esc(p.otherNames || '')} ${SandboxUtil.esc(p.lastName || '')}</div>
          <div class="text-[10px] text-slate-400">${SandboxUtil.esc(p.email || p.phone || '-')}</div>
        </td>
        <td class="p-2.5 text-[11px]">${SandboxUtil.esc(SandboxUtil.dateOnly(p.dob))}
          <span class="text-[10px] text-slate-400 block">${p.age !== null && p.age !== undefined ? p.age + ' th' : ''}</span>
        </td>
        <td class="p-2.5 text-[11px]">${p.gender && p.gender.code === 'M'
          ? '<span class="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px]">Laki-laki</span>'
          : '<span class="px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 text-[10px]">Perempuan</span>'}</td>
        <td class="p-2.5 text-[11px]">${SandboxUtil.esc(p.phone || '-')}</td>
        <td class="p-2.5 text-[11px]">${p.head
          ? '<span class="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-semibold">Kepala</span>'
          : '<span class="text-[10px] text-slate-400">Anggota</span>'}</td>
        <td class="p-2.5 text-[10px] text-slate-500">${SandboxUtil.esc(p.healthFacility ? p.healthFacility.name : '-')}</td>
        <td class="p-2.5 text-right whitespace-nowrap">
          <button onclick="PatientsModule.detail('${SandboxUtil.jsStr(p.id)}')"
            class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10.5px]">Detail</button>
          <button onclick="PatientsModule.eligibility('${SandboxUtil.jsStr(p.chfId)}')"
            class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[10.5px]">Eligibilitas</button>
          <button onclick="PatientsModule.edit('${SandboxUtil.jsStr(p.id)}')"
            class="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded text-[10.5px]">Edit</button>
          <button onclick="PatientsModule.remove('${SandboxUtil.jsStr(p.id)}','${SandboxUtil.jsStr(p.uuid)}','${SandboxUtil.jsStr(p.chfId)}')"
            class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded text-[10.5px]">Hapus</button>
        </td>
      </tr>`).join('');
  }

  function search(keyword) {
    const q = (keyword || '').toLowerCase().trim();
    if (!q) { renderTable(cache); return; }
    renderTable(cache.filter(p =>
      (p.chfId || '').toLowerCase().includes(q) ||
      (p.lastName || '').toLowerCase().includes(q) ||
      (p.otherNames || '').toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q)
    ));
  }

  async function applyFilter() {
    const chfId = SandboxUtil.val('patients-filter-chfid').trim();
    const lastName = SandboxUtil.val('patients-filter-name').trim();
    const genderCode = SandboxUtil.val('patients-filter-gender');
    await load({
      chfId: chfId || undefined,
      lastName: lastName || undefined,
      genderCode: genderCode || undefined
    });
  }

  // ---------------------------------------------------------
  // Detail
  // ---------------------------------------------------------
  async function detail(id) {
    const patient = cache.find(p => p.id === id);
    if (!patient) return;

    const chfId = patient.chfId;

    AppModal.open(`Peserta: ${patient.otherNames || ''} ${patient.lastName || ''}`, `
      <div class="p-6 text-center text-slate-500 text-xs">
        <span class="animate-spin inline-block w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full"></span>
        Memuat polis & klaim...
      </div>`);

    let policies = [];
    let claims = [];
    let eligibility = null;

    try {
      const elig = await OpenIMISApi.checkEligibility(chfId);
      policies = elig.policies || [];
      eligibility = elig.eligibility;
    } catch (e) { /* ignore */ }

    try {
      const claimConn = await OpenIMISApi.getClaims(20, { chfId });
      claims = SandboxUtil.nodes(claimConn);
    } catch (e) { /* ignore */ }

    const html = `
      <div class="space-y-3">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
          ${infoBox('CHFID', patient.chfId || '-', 'mono')}
          ${infoBox('Tanggal Lahir', SandboxUtil.dateOnly(patient.dob))}
          ${infoBox('Usia', patient.age !== undefined && patient.age !== null ? patient.age + ' tahun' : '-')}
          ${infoBox('Gender', patient.gender ? patient.gender.code : '-')}
          ${infoBox('Telepon', patient.phone || '-')}
          ${infoBox('Email', patient.email || '-')}
          ${infoBox('Kepala Keluarga', patient.head ? 'Ya' : 'Tidak')}
          ${infoBox('Faskes', patient.healthFacility ? patient.healthFacility.name : '-')}
        </div>

        <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] space-y-1">
          <div><span class="text-slate-500">Alamat keluarga:</span> <strong>${SandboxUtil.esc(patient.family ? patient.family.address || '-' : '-')}</strong></div>
          <div><span class="text-slate-500">Wilayah:</span> ${SandboxUtil.esc(patient.currentVillage ? patient.currentVillage.name : '-')}</div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-[11px] font-bold text-slate-700">Polis (policiesByInsuree)</span>
            ${eligibility ? `<span class="text-[10px] ${eligibility.isServiceOk ? 'text-emerald-600' : 'text-red-600'} font-semibold">
              ${eligibility.isServiceOk ? '✓ Tindakan dijamin' : '✗ Tindakan tidak dijamin'} ·
              ${eligibility.isItemOk ? '✓ Obat dijamin' : '✗ Obat tidak dijamin'}</span>` : ''}
          </div>
          ${policies.length ? `
            <div class="space-y-1.5">
              ${policies.map(p => `
                <div class="p-2.5 border border-slate-200 rounded-lg text-[11px] flex items-center justify-between">
                  <div>
                    <div class="font-semibold text-slate-800">${SandboxUtil.esc(p.productName || p.productCode)}</div>
                    <div class="text-[10px] text-slate-500">${SandboxUtil.dateOnly(p.startDate)} → ${SandboxUtil.dateOnly(p.expiryDate)}</div>
                  </div>
                  <div class="text-right">
                    ${SandboxUtil.policyStatusBadge(p.status)}
                    <div class="text-[10px] text-emerald-700 font-mono mt-0.5">${SandboxUtil.money(p.balance)}</div>
                  </div>
                </div>`).join('')}
            </div>` : `<div class="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
              Peserta terdaftar tetapi belum memiliki polis aktif.</div>`}
        </div>

        <div>
          <span class="text-[11px] font-bold text-slate-700 block mb-1">Riwayat Klaim (claims)</span>
          ${claims.length ? `
            <div class="overflow-x-auto rounded-lg border border-slate-200">
              <table class="w-full text-[10.5px]">
                <thead class="bg-slate-50 text-slate-600"><tr>
                  <th class="p-2 text-left">Kode</th><th class="p-2 text-left">Tanggal</th>
                  <th class="p-2 text-left">Status</th><th class="p-2 text-right">Ditagih</th>
                </tr></thead>
                <tbody>
                  ${claims.map(c => `<tr class="border-t border-slate-100">
                    <td class="p-2 font-mono text-sky-700">${SandboxUtil.esc(c.code)}</td>
                    <td class="p-2">${SandboxUtil.dateOnly(c.dateClaimed)}</td>
                    <td class="p-2">${SandboxUtil.claimStatusBadge(c.status)}</td>
                    <td class="p-2 text-right font-mono">${SandboxUtil.money(c.claimed)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>` : `<div class="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500">Belum ada klaim.</div>`}
        </div>

        <div class="pt-2 border-t border-slate-100 flex justify-between items-center">
          <button onclick="GraphQLHelp.previewLast('Query Detail Peserta')"
            class="text-[10.5px] text-slate-500 hover:text-sky-600 underline">Lihat GraphQL</button>
          <div class="flex gap-2">
            <button onclick="PatientsModule.eligibility('${SandboxUtil.jsStr(chfId)}')"
              class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold">Cek Eligibilitas</button>
            <button onclick="AppModal.close()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold">Tutup</button>
          </div>
        </div>
      </div>
    `;
    AppModal.open(`Peserta: ${patient.otherNames || ''} ${patient.lastName || ''}`, html, { wide: true });
  }

  function infoBox(label, value, cls = '') {
    return `<div class="p-2 bg-slate-50 border border-slate-200 rounded-lg">
      <div class="text-[9.5px] text-slate-500 uppercase tracking-wide">${label}</div>
      <div class="font-semibold text-slate-800 ${cls}">${SandboxUtil.esc(value)}</div>
    </div>`;
  }

  // ---------------------------------------------------------
  // Eligibility
  // ---------------------------------------------------------
  async function eligibility(chfId) {
    try {
      const { policies, eligibility: e } = await OpenIMISApi.checkEligibility(chfId);

      let body = `<div class="space-y-3 text-[11px]">
        <div class="p-2.5 bg-slate-900 text-emerald-300 rounded-lg font-mono text-[10.5px]">
          policyEligibilityByInsuree(chfId: "${SandboxUtil.esc(chfId)}")
        </div>`;

      if (e) {
        body += `<div class="grid grid-cols-2 gap-2">
          ${infoBox('Produk', e.prodId || '-')}
          ${infoBox('Sisa Kunjungan', e.totalVisitsLeft !== null ? e.totalVisitsLeft : '-')}
          ${infoBox('Sisa Konsultasi', e.totalConsultationsLeft !== null ? e.totalConsultationsLeft : '-')}
          ${infoBox('Sisa Tindakan', e.serviceLeft !== null ? e.serviceLeft : '-')}
          ${infoBox('Sisa Obat', e.itemLeft !== null ? e.itemLeft : '-')}
          ${infoBox('Tindakan Dijamin', e.isServiceOk ? 'Ya' : 'Tidak')}
          ${infoBox('Obat Dijamin', e.isItemOk ? 'Ya' : 'Tidak')}
          ${infoBox('Min. Tgl Layanan', SandboxUtil.dateOnly(e.minDateService))}
        </div>`;
      }

      if (policies.length) {
        body += `<div class="space-y-1.5">
          <div class="font-bold text-slate-700">Polis aktif</div>
          ${policies.map(p => `
            <div class="p-2.5 border border-emerald-200 bg-emerald-50 rounded-lg flex justify-between">
              <div>
                <div class="font-semibold text-slate-800">${SandboxUtil.esc(p.productName || p.productCode)}</div>
                <div class="text-[10px] text-slate-500">Berlaku s/d ${SandboxUtil.dateOnly(p.expiryDate)}</div>
              </div>
              <div class="text-right">
                <div class="text-[10px] text-slate-500">Sisa saldo</div>
                <div class="font-mono font-bold text-emerald-700">${SandboxUtil.money(p.balance)}</div>
              </div>
            </div>`).join('')}
        </div>`;
      } else {
        body += `<div class="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          Peserta terdaftar namun belum memiliki polis aktif. Di BPJS, kondisi ini setara dengan
          status <strong>NONAKTIF</strong> karena iuran belum dibayar.
        </div>`;
      }

      body += `<div class="pt-2 border-t border-slate-100 flex justify-between items-center">
        <button onclick="GraphQLHelp.previewLast('Query Eligibilitas')" class="text-[10.5px] text-slate-500 hover:text-sky-600 underline">Lihat GraphQL</button>
        <button onclick="AppModal.close()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold">Tutup</button>
      </div></div>`;

      AppModal.open(`Eligibilitas ${chfId}`, body);
    } catch (e) {
      SandboxUtil.toast(`Gagal cek eligibilitas: ${e.message}`, 'error', 5000);
    }
  }

  // ---------------------------------------------------------
  // Create / Edit form
  // ---------------------------------------------------------
  async function openCreate() {
    await ensureRefs();
    const chfId = SandboxUtil.newChfId();

    const genderOptions = (refs.genders.length ? refs.genders : [{ code: 'M', gender: 'Male' }, { code: 'F', gender: 'Female' }])
      .map(g => `<option value="${g.code}">${SandboxUtil.esc(g.gender || g.code)} (${g.code})</option>`).join('');

    const hfOptions = refs.hfs.map(h => `<option value="${SandboxUtil.relayToId(h.id)}">${SandboxUtil.esc(h.code)} - ${SandboxUtil.esc(h.name)}</option>`).join('');

    AppModal.open('Daftarkan Peserta Baru', `
      <form onsubmit="PatientsModule.submitCreate(event)" class="space-y-3 text-[11px]">
        <div class="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-[10.5px] text-sky-900">
          Memanggil mutation <code class="font-mono">createInsuree</code>. Field wajib:
          <code>lastName</code>, <code>otherNames</code>, <code>genderId</code>, <code>dob</code>.
        </div>

        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Nomor Kartu (CHFID)', UiKit.input('reg-chfid', { value: chfId, required: true, maxlength: 50, extraClass: 'font-mono' }))}
          ${UiKit.field('Tipe Identitas', UiKit.select('reg-idtype',
            `<option value="">-</option>` + refs.idTypes.map(t => `<option value="${t.code}">${SandboxUtil.esc(t.name)}</option>`).join('')))}
        </div>

        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Nama Depan', UiKit.input('reg-othernames', { placeholder: 'Budi', required: true }))}
          ${UiKit.field('Nama Belakang', UiKit.input('reg-lastname', { placeholder: 'Pratama', required: true }))}
        </div>

        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Tanggal Lahir', UiKit.input('reg-dob', { type: 'date', value: '1995-05-15', required: true }))}
          ${UiKit.field('Jenis Kelamin', UiKit.select('reg-gender', genderOptions))}
        </div>

        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Telepon', UiKit.input('reg-phone', { placeholder: '08123456789' }))}
          ${UiKit.field('Email', UiKit.input('reg-email', { type: 'email', placeholder: 'nama@contoh.id' }))}
        </div>

        ${refs.hfs.length ? UiKit.field('Faskes Rujukan (FKTP)', UiKit.select('reg-hf', `<option value="">-</option>` + hfOptions)) : ''}

        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Status Perkawinan', UiKit.select('reg-marital',
            `<option value="">-</option>
             <option value="S">Belum Kawin</option>
             <option value="M">Kawin</option>
             <option value="D">Duda/Janda</option>`))}
          ${UiKit.field('Kartu Diterbitkan', UiKit.select('reg-card',
            `<option value="false">Belum</option><option value="true">Sudah</option>`))}
        </div>

        <div class="flex items-center gap-2 pt-1">
          <input type="checkbox" id="reg-head" checked class="rounded text-sky-600 focus:ring-sky-500">
          <label for="reg-head" class="text-slate-700 font-medium">Tetapkan sebagai kepala keluarga</label>
        </div>

        ${UiKit.formFooter('Daftarkan ke OpenIMIS', 'reg-btn-submit')}
      </form>
    `, { wide: true });
  }

  async function submitCreate(e) {
    e.preventDefault();

    const input = {
      clientMutationId: 'create-insuree-' + Date.now(),
      chfId: SandboxUtil.val('reg-chfid').trim(),
      lastName: SandboxUtil.val('reg-lastname').trim(),
      otherNames: SandboxUtil.val('reg-othernames').trim(),
      genderId: SandboxUtil.val('reg-gender'),
      dob: SandboxUtil.val('reg-dob'),
      head: SandboxUtil.checked('reg-head'),
      cardIssued: SandboxUtil.val('reg-card') === 'true'
    };

    const phone = SandboxUtil.val('reg-phone').trim();
    if (phone) input.phone = phone;
    const email = SandboxUtil.val('reg-email').trim();
    if (email) input.email = email;
    const marital = SandboxUtil.val('reg-marital');
    if (marital) input.marital = marital;
    const hf = SandboxUtil.val('reg-hf');
    if (hf) input.healthFacilityId = Number(hf);
    const idType = SandboxUtil.val('reg-idtype');
    if (idType) input.typeOfIdId = idType;

    await UiKit.busy('reg-btn-submit', 'Mendaftarkan...', async () => {
      try {
        await OpenIMISApi.createInsuree(input);
        SandboxUtil.toast(`Peserta ${input.otherNames} ${input.lastName} berhasil didaftarkan`, 'success', 4000);
        AppModal.close();
        await load();
      } catch (err) {
        SandboxUtil.toast(`Gagal mendaftarkan peserta: ${err.message}`, 'error', 6000);
      }
    });
  }

  async function edit(id) {
    const patient = cache.find(p => p.id === id);
    if (!patient) return;
    await ensureRefs();

    const genderOptions = (refs.genders.length ? refs.genders : [{ code: 'M', gender: 'Male' }, { code: 'F', gender: 'Female' }])
      .map(g => `<option value="${g.code}" ${patient.gender && patient.gender.code === g.code ? 'selected' : ''}>${SandboxUtil.esc(g.gender || g.code)} (${g.code})</option>`).join('');

    const hfOptions = `<option value="">-</option>` + refs.hfs.map(h => {
      const hfId = SandboxUtil.relayToId(h.id);
      const selected = patient.healthFacility && SandboxUtil.relayToId(patient.healthFacility.id) === hfId ? ' selected' : '';
      return `<option value="${hfId}"${selected}>${SandboxUtil.esc(h.code)} - ${SandboxUtil.esc(h.name)}</option>`;
    }).join('');

    AppModal.open(`Edit Peserta ${patient.chfId}`, `
      <form onsubmit="PatientsModule.submitEdit(event,'${SandboxUtil.jsStr(patient.uuid)}')" class="space-y-3 text-[11px]">
        <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10.5px] text-amber-900">
          Memanggil mutation <code class="font-mono">updateInsuree</code>. Graphene mengisi field yang
          tidak dikirim dengan <code>null</code>, jadi form ini mengirim ulang seluruh field wajib.
        </div>

        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Nomor Kartu (CHFID)', UiKit.input('edit-chfid', { value: patient.chfId || '', readonly: true, extraClass: 'font-mono bg-slate-100' }))}
          ${UiKit.field('Kartu Diterbitkan', UiKit.select('edit-card',
            `<option value="false" ${!patient.cardIssued ? 'selected' : ''}>Belum</option>
             <option value="true" ${patient.cardIssued ? 'selected' : ''}>Sudah</option>`))}
        </div>

        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Nama Depan', UiKit.input('edit-othernames', { value: patient.otherNames || '', required: true }))}
          ${UiKit.field('Nama Belakang', UiKit.input('edit-lastname', { value: patient.lastName || '', required: true }))}
        </div>

        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Tanggal Lahir', UiKit.input('edit-dob', { type: 'date', value: SandboxUtil.dateOnly(patient.dob), required: true }))}
          ${UiKit.field('Jenis Kelamin', UiKit.select('edit-gender', genderOptions))}
        </div>

        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Telepon', UiKit.input('edit-phone', { value: patient.phone || '' }))}
          ${UiKit.field('Email', UiKit.input('edit-email', { type: 'email', value: patient.email || '' }))}
        </div>

        ${refs.hfs.length ? UiKit.field('Faskes Rujukan', UiKit.select('edit-hf', hfOptions)) : ''}

        <div class="flex items-center gap-2 pt-1">
          <input type="checkbox" id="edit-head" ${patient.head ? 'checked' : ''} class="rounded text-sky-600 focus:ring-sky-500">
          <label for="edit-head" class="text-slate-700 font-medium">Kepala keluarga</label>
        </div>

        ${UiKit.formFooter('Simpan Perubahan', 'edit-btn-submit')}
      </form>
    `, { wide: true });
  }

  async function submitEdit(e, uuid) {
    e.preventDefault();

    const input = {
      clientMutationId: 'update-insuree-' + Date.now(),
      uuid,
      chfId: SandboxUtil.val('edit-chfid').trim(),
      lastName: SandboxUtil.val('edit-lastname').trim(),
      otherNames: SandboxUtil.val('edit-othernames').trim(),
      genderId: SandboxUtil.val('edit-gender'),
      dob: SandboxUtil.val('edit-dob'),
      head: SandboxUtil.checked('edit-head'),
      cardIssued: SandboxUtil.val('edit-card') === 'true'
    };

    const phone = SandboxUtil.val('edit-phone').trim();
    if (phone) input.phone = phone;
    const email = SandboxUtil.val('edit-email').trim();
    if (email) input.email = email;
    const hf = SandboxUtil.val('edit-hf');
    if (hf) input.healthFacilityId = Number(hf);

    await UiKit.busy('edit-btn-submit', 'Menyimpan...', async () => {
      try {
        await OpenIMISApi.updateInsuree(input);
        SandboxUtil.toast('Perubahan tersimpan', 'success');
        AppModal.close();
        await load();
      } catch (err) {
        SandboxUtil.toast(`Gagal menyimpan: ${err.message}`, 'error', 6000);
      }
    });
  }

  async function remove(id, uuid, chfId) {
    const ok = await AppModal.confirm(
      'Hapus Peserta',
      `Peserta <strong>${SandboxUtil.esc(chfId)}</strong> akan di-soft-delete lewat mutation
       <code class="font-mono">deleteInsurees</code>. Data tidak hilang permanen — openIMIS menyimpan histori.`,
      'Hapus'
    );
    if (!ok) return;

    try {
      await OpenIMISApi.deleteInsurees([uuid]);
      SandboxUtil.toast(`Peserta ${chfId} dihapus`, 'success');
      await load();
    } catch (err) {
      SandboxUtil.toast(`Gagal menghapus: ${err.message}`, 'error', 6000);
    }
  }

  return { load, search, applyFilter, detail, eligibility, openCreate, submitCreate, edit, submitEdit, remove };
})();

window.PatientsModule = PatientsModule;
