// ============================================================
// P-Care Business Process Simulator (FKTP / Puskesmas)
// ------------------------------------------------------------
// P-Care is BPJS Kesehatan's application for primary care
// facilities. Here the sandbox plays the P-Care client and maps
// each step onto openIMIS GraphQL operations.
//
// DISCLAIMER: no connection to the real BPJS P-Care API.
// ============================================================
const PcareSimulator = (function () {
  let step = 1;
  let state = {
    facility: null,
    patient: null,
    chfId: null,
    eligibility: null,
    claimCode: null,
    claimUuid: null,
    claimStatus: null,
    services: [],
    items: [],
    diagnosis: null,
    referral: null
  };

  const TOTAL_STEPS = 9;

  // ---------------------------------------------------------
  // Step UI
  // ---------------------------------------------------------
  function updateStepUI() {
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const card = document.getElementById(`pcare-step-${i}`);
      const dot = document.getElementById(`pcare-dot-${i}`);
      const body = document.getElementById(`pcare-body-${i}`);
      if (!card || !body) continue;

      if (i === step) {
        card.className = 'bg-white rounded-2xl p-5 border-2 border-teal-500 ring-2 ring-teal-500/20 shadow-sm space-y-3';
        if (dot) dot.className = 'w-7 h-7 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow';
        body.classList.remove('hidden');
      } else if (i < step) {
        card.className = 'bg-white rounded-2xl p-5 border border-emerald-300 bg-emerald-50/30 shadow-sm space-y-3';
        if (dot) dot.className = 'w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs';
        body.classList.add('hidden');
      } else {
        card.className = 'bg-white rounded-2xl p-5 border border-slate-200 opacity-50 shadow-sm space-y-3';
        if (dot) dot.className = 'w-7 h-7 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs';
        body.classList.add('hidden');
      }
    }
    setTimeout(() => SandboxUtil.refreshIcons(), 40);
  }

  function setStep(n) {
    step = n;
    updateStepUI();
  }

  function init() {
    updateStepUI();
    loadFacilities();
  }

  async function loadFacilities() {
    const select = document.getElementById('pcare-facility-select');
    if (!select) return;
    try {
      const conn = await OpenIMISApi.getHealthFacilities(60, { level: 'C' });
      let list = SandboxUtil.nodes(conn);
      if (!list.length) {
        const all = await OpenIMISApi.getHealthFacilities(30);
        list = SandboxUtil.nodes(all);
      }
      select.innerHTML = list.map(f =>
        `<option value="${SandboxUtil.relayToId(f.id)}"
                 data-code="${SandboxUtil.esc(f.code)}" data-name="${SandboxUtil.esc(f.name)}">
          ${SandboxUtil.esc(f.code)} — ${SandboxUtil.esc(f.name)} (${SandboxUtil.esc(f.level)})
        </option>`).join('');
    } catch (e) {
      select.innerHTML = '<option value="1">Faskes #1</option>';
    }
  }

  // ---------------------------------------------------------
  // Step 1 — Login faskes
  // ---------------------------------------------------------
  function step1() {
    const out = document.getElementById('pcare-out-1');
    out.innerHTML = `
      <div class="space-y-2">
        <p class="text-[10.5px] text-slate-600">
          P-Care dijalankan oleh petugas FKTP. Langkah pertama adalah memilih Puskesmas/Klinik
          yang sedang login — di openIMIS ini adalah <code class="font-mono">HealthFacility</code>.
        </p>
        <select id="pcare-facility-select" class="w-full p-2 border border-slate-300 rounded-lg text-[11px] focus:ring-2 focus:ring-teal-500 focus:outline-none"></select>
        <div class="flex justify-end">
          <button onclick="PcareSimulator.confirmFacility()"
            class="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-semibold">
            Masuk sebagai Faskes Ini
          </button>
        </div>
        <div id="pcare-facility-result"></div>
      </div>`;
    loadFacilities();
  }

  async function confirmFacility() {
    const select = document.getElementById('pcare-facility-select');
    if (!select || !select.value) { SandboxUtil.toast('Pilih faskes', 'warning'); return; }
    const opt = select.options[select.selectedIndex];

    state.facility = {
      id: Number(select.value),
      code: opt.getAttribute('data-code'),
      name: opt.getAttribute('data-name')
    };

    document.getElementById('pcare-facility-result').innerHTML = `
      <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] space-y-1">
        <div class="font-bold text-slate-800">Login berhasil</div>
        <div class="text-slate-600">Faskes aktif: <strong>${SandboxUtil.esc(state.facility.name)}</strong>
          (<span class="font-mono">${SandboxUtil.esc(state.facility.code)}</span>)</div>
        <div class="text-[10px] text-slate-500">Semua klaim yang dibuat akan tercatat atas nama faskes ini.</div>
      </div>
      <button onclick="PcareSimulator.next(2)" class="mt-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-semibold">
        Lanjut: Cari Peserta →
      </button>`;
  }

  // ---------------------------------------------------------
  // Step 2 — Cari peserta
  // ---------------------------------------------------------
  async function step2() {
    const out = document.getElementById('pcare-out-2');
    let options = '';
    try {
      const conn = await OpenIMISApi.getInsurees(25);
      const list = SandboxUtil.nodes(conn);
      options = list.map(p =>
        `<option value="${SandboxUtil.esc(p.chfId)}">${SandboxUtil.esc(p.chfId)} — ${SandboxUtil.esc((p.otherNames || '') + ' ' + (p.lastName || ''))}</option>`
      ).join('');
    } catch (e) { /* ignore */ }

    out.innerHTML = `
      <div class="space-y-2">
        <p class="text-[10.5px] text-slate-600">
          Petugas memasukkan nomor kartu peserta. Di P-Care aslinya ini memanggil
          <code class="font-mono">Peserta/{noKartu}</code> ke BPJS; di sandbox kita memanggil
          <code class="font-mono">insurees(chfId:)</code>.
        </p>
        <div class="flex gap-2">
          <select id="pcare-card-input" class="flex-1 p-2 border border-slate-300 rounded-lg text-[11px] focus:ring-2 focus:ring-teal-500 focus:outline-none">
            ${options || '<option value="070707070">070707070</option>'}
          </select>
          <button onclick="PcareSimulator.findPatient()"
            class="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-semibold whitespace-nowrap">
            Cari Peserta
          </button>
        </div>
        <div id="pcare-patient-result"></div>
      </div>`;
  }

  async function findPatient() {
    const chfId = SandboxUtil.val('pcare-card-input').trim();
    const result = document.getElementById('pcare-patient-result');
    result.innerHTML = loadingBox('Mencari peserta...');

    try {
      const conn = await OpenIMISApi.getInsurees(1, { chfId });
      const list = SandboxUtil.nodes(conn);

      if (!list.length) {
        result.innerHTML = warnBox('Peserta tidak ditemukan',
          `Nomor <strong>${SandboxUtil.esc(chfId)}</strong> tidak terdaftar. Di P-Care, peserta
           tanpa kartu aktif tetap bisa dilayani sebagai pasien umum.`);
        return;
      }

      const p = list[0];
      state.patient = p;
      state.chfId = chfId;

      result.innerHTML = `
        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] space-y-2">
          <div class="flex items-center gap-2">
            <i data-lucide="user-check" class="w-4 h-4 text-emerald-600"></i>
            <span class="font-bold text-slate-800">${SandboxUtil.esc((p.otherNames || '') + ' ' + (p.lastName || ''))}</span>
            <span class="ml-auto font-mono text-[10px] text-slate-500">${SandboxUtil.esc(p.chfId)}</span>
          </div>
          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200 text-[10.5px]">
            ${mini('Tanggal Lahir', SandboxUtil.dateOnly(p.dob))}
            ${mini('Usia', (p.age !== null && p.age !== undefined) ? p.age + ' tahun' : '-')}
            ${mini('Gender', p.gender ? p.gender.code : '-')}
            ${mini('Faskes', p.healthFacility ? p.healthFacility.name : '-')}
          </div>
          <div class="flex justify-between items-center">
            <button onclick="GraphQLHelp.previewLast('Query Cari Peserta')" class="text-[10px] text-sky-600 hover:underline">Lihat GraphQL</button>
            <button onclick="PcareSimulator.next(3)" class="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-semibold">
              Lanjut: Validasi Eligibilitas →
            </button>
          </div>
        </div>`;
      SandboxUtil.refreshIcons();
    } catch (e) {
      result.innerHTML = errBox(e.message);
    }
  }

  // ---------------------------------------------------------
  // Step 3 — Validasi eligibilitas (pengganti SEP)
  // ---------------------------------------------------------
  async function step3() {
    const out = document.getElementById('pcare-out-3');
    out.innerHTML = loadingBox('Memvalidasi eligibilitas peserta...');

    try {
      const { policies, eligibility } = await OpenIMISApi.checkEligibility(state.chfId);
      state.eligibility = eligibility;

      const active = policies.filter(p => Number(p.status) === 2);
      const ok = active.length > 0;
      const serviceOk = eligibility ? eligibility.isServiceOk !== false : ok;
      const itemOk = eligibility ? eligibility.isItemOk !== false : ok;

      out.innerHTML = `
        <div class="space-y-2">
          <div class="p-3 ${ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'} border rounded-xl text-[11px] space-y-2">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}">
                ${ok ? 'ELIGIBLE — SEP DAPAT DITERBITKAN' : 'TIDAK ELIGIBLE'}
              </span>
            </div>
            ${eligibility ? `
              <div class="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 text-[10.5px]">
                ${mini('Produk', eligibility.prodId || '-')}
                ${mini('Sisa Kunjungan', eligibility.totalVisitsLeft !== null ? eligibility.totalVisitsLeft : '-')}
                ${mini('Tindakan Dijamin', serviceOk ? 'Ya' : 'Tidak', serviceOk ? 'text-emerald-700' : 'text-red-600')}
                ${mini('Obat Dijamin', itemOk ? 'Ya' : 'Tidak', itemOk ? 'text-emerald-700' : 'text-red-600')}
              </div>` : ''}
          </div>

          <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900 leading-relaxed">
            <strong>Penting — SEP tidak ada di openIMIS.</strong> SEP (Surat Eligibilitas Peserta)
            adalah dokumen BPJS. openIMIS tidak menyimpannya sebagai entitas tersendiri. Yang setara
            secara fungsional adalah hasil <code class="font-mono">policyEligibilityByInsuree</code>
            ditambah <code class="font-mono">Claim.referralCode</code> / <code class="font-mono">Claim.guaranteeId</code>
            bila nomor SEP perlu dicatat.
          </div>

          <div class="flex justify-between items-center">
            <button onclick="GraphQLHelp.previewLast('Query Validasi Eligibilitas')" class="text-[10px] text-sky-600 hover:underline">Lihat GraphQL</button>
            <button onclick="PcareSimulator.next(4)" class="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-semibold">
              Lanjut: Daftarkan Kunjungan →
            </button>
          </div>
        </div>`;
    } catch (e) {
      out.innerHTML = errBox(e.message);
    }
  }

  // ---------------------------------------------------------
  // Step 4 — Daftarkan kunjungan (createClaim)
  // ---------------------------------------------------------
  async function step4() {
    const out = document.getElementById('pcare-out-4');

    let diagnoses = [];
    try {
      const conn = await OpenIMISApi.getDiagnoses(60);
      diagnoses = SandboxUtil.nodes(conn);
    } catch (e) { /* ignore */ }

    state.claimCode = state.claimCode || 'PC-' + Date.now().toString().slice(-8);
    const today = SandboxUtil.today();

    out.innerHTML = `
      <div class="space-y-2">
        <p class="text-[10.5px] text-slate-600">
          Kunjungan didaftarkan sebagai <code class="font-mono">Claim</code> berstatus
          <strong>2 Entered</strong> dengan <code>visitType = "O"</code> (rawat jalan).
          Ini adalah "kunjungan" dalam P-Care.
        </p>

        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Kode Kunjungan', UiKit.input('pcare-claim-code', { value: state.claimCode, required: true, extraClass: 'font-mono' }))}
          ${UiKit.field('Tanggal', UiKit.input('pcare-claim-date', { type: 'date', value: today, required: true }))}
        </div>

        ${UiKit.field('Diagnosa Awal (ICD-10)', UiKit.select('pcare-icd',
          diagnoses.map(d => `<option value="${SandboxUtil.relayToId(d.id)}"
            data-code="${SandboxUtil.esc(d.code)}" data-name="${SandboxUtil.esc(d.name)}">
            [${SandboxUtil.esc(d.code)}] ${SandboxUtil.esc(d.name)}</option>`).join('')))}

        <div class="flex justify-end">
          <button id="pcare-btn-create" onclick="PcareSimulator.createEncounter()"
            class="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-semibold">
            Daftarkan Kunjungan
          </button>
        </div>
        <div id="pcare-encounter-result"></div>
      </div>`;
  }

  async function createEncounter() {
    const result = document.getElementById('pcare-encounter-result');
    result.innerHTML = loadingBox('Mendaftarkan kunjungan...');

    const icdSelect = document.getElementById('pcare-icd');
    const icdOpt = icdSelect.options[icdSelect.selectedIndex];
    state.diagnosis = {
      id: Number(icdSelect.value),
      code: icdOpt.getAttribute('data-code'),
      name: icdOpt.getAttribute('data-name')
    };

    const date = SandboxUtil.val('pcare-claim-date');
    state.claimCode = SandboxUtil.val('pcare-claim-code').trim();

    const input = {
      clientMutationId: 'pcare-claim-' + Date.now(),
      code: state.claimCode,
      insureeId: SandboxUtil.relayToId(state.patient.id),
      healthFacilityId: state.facility.id,
      icdId: state.diagnosis.id,
      dateFrom: date,
      dateTo: date,
      dateClaimed: date,
      visitType: 'O',
      careType: 'O'
    };

    try {
      await OpenIMISApi.createClaim(input);
      state.claimStatus = 2;

      // resolve uuid (mutation is async)
      for (let i = 0; i < 6 && !state.claimUuid; i++) {
        try {
          const conn = await OpenIMISApi.getClaims(3, { code: state.claimCode });
          const list = SandboxUtil.nodes(conn);
          if (list.length) {
            state.claimUuid = list[0].uuid;
            state.claimStatus = list[0].status;
            break;
          }
        } catch (e) { /* retry */ }
        await new Promise(r => setTimeout(r, 700));
      }

      result.innerHTML = `
        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] space-y-1">
          <div class="font-bold text-slate-800">Kunjungan terdaftar</div>
          <div class="text-slate-600">Kode: <span class="font-mono">${SandboxUtil.esc(state.claimCode)}</span></div>
          <div>Status: ${SandboxUtil.claimStatusBadge(state.claimStatus || 2)}</div>
          <div class="text-[10px] text-slate-500">Diagnosa awal: [${SandboxUtil.esc(state.diagnosis.code)}] ${SandboxUtil.esc(state.diagnosis.name)}</div>
        </div>
        <button onclick="PcareSimulator.next(5)" class="mt-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-semibold">
          Lanjut: Input Tindakan →
        </button>`;
      SandboxUtil.toast('Kunjungan terdaftar (status 2 Entered)', 'success', 4000);
    } catch (e) {
      result.innerHTML = errBox(e.message);
    }
  }

  // ---------------------------------------------------------
  // Step 5 — Input tindakan
  // ---------------------------------------------------------
  async function step5() {
    const out = document.getElementById('pcare-out-5');
    out.innerHTML = loadingBox('Memuat katalog tindakan...');

    try {
      const conn = await OpenIMISApi.getMedicalServices(30);
      const services = SandboxUtil.nodes(conn);

      out.innerHTML = `
        <div class="space-y-2">
          <p class="text-[10.5px] text-slate-600">
            Pilih tindakan yang diberikan. Di P-Care ini adalah
            <code class="font-mono">Tindakan</code>; di openIMIS menjadi
            <code class="font-mono">ClaimService</code> yang menempel pada klaim.
          </p>
          <div class="max-h-52 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
            ${services.length ? services.map(s => `
              <label class="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" name="pcare-svc" value="${SandboxUtil.relayToId(s.id)}"
                  data-code="${SandboxUtil.esc(s.code)}" data-name="${SandboxUtil.esc(s.name)}"
                  data-price="${SandboxUtil.num(s.price)}" class="rounded text-teal-600">
                <span class="flex-1 text-[10.5px] truncate">${SandboxUtil.esc(s.name)}</span>
                <span class="font-mono text-[10px] text-slate-500">${SandboxUtil.money(s.price)}</span>
              </label>`).join('') : '<div class="text-[10.5px] text-slate-400 p-2">Tidak ada tindakan.</div>'}
          </div>
          <div class="flex justify-end">
            <button onclick="PcareSimulator.saveServices()"
              class="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-semibold">
              Simpan Tindakan (updateClaim)
            </button>
          </div>
          <div id="pcare-svc-result"></div>
        </div>`;
    } catch (e) {
      out.innerHTML = errBox(e.message);
    }
  }

  async function saveServices() {
    const result = document.getElementById('pcare-svc-result');
    const picked = [];
    document.querySelectorAll('input[name="pcare-svc"]:checked').forEach(cb => {
      picked.push({
        serviceId: Number(cb.value),
        status: 1,
        qtyProvided: 1,
        priceAsked: String(SandboxUtil.num(cb.getAttribute('data-price')))
      });
    });

    if (!picked.length) { SandboxUtil.toast('Pilih minimal satu tindakan', 'warning'); return; }
    if (!state.claimUuid) { SandboxUtil.toast('UUID klaim belum tersedia', 'warning'); return; }

    state.services = picked;
    result.innerHTML = loadingBox('Menyimpan tindakan...');

    try {
      await OpenIMISApi.updateClaim({
        clientMutationId: 'pcare-update-claim-' + Date.now(),
        uuid: state.claimUuid,
        code: state.claimCode,
        insureeId: SandboxUtil.relayToId(state.patient.id),
        healthFacilityId: state.facility.id,
        icdId: state.diagnosis.id,
        dateFrom: SandboxUtil.val('pcare-claim-date') || SandboxUtil.today(),
        dateClaimed: SandboxUtil.val('pcare-claim-date') || SandboxUtil.today(),
        visitType: 'O',
        careType: 'O',
        services: picked
      });

      const total = picked.reduce((s, p) => s + Number(p.priceAsked), 0);
      result.innerHTML = `
        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px]">
          <div class="font-bold text-slate-800">${picked.length} tindakan tersimpan</div>
          <div class="font-mono text-emerald-700">Total: ${SandboxUtil.money(total)}</div>
        </div>
        <button onclick="PcareSimulator.next(6)" class="mt-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-semibold">
          Lanjut: Input Resep Obat →
        </button>`;
      SandboxUtil.toast('Tindakan tersimpan', 'success');
    } catch (e) {
      result.innerHTML = errBox(e.message);
    }
  }

  // ---------------------------------------------------------
  // Step 6 — Input resep obat
  // ---------------------------------------------------------
  async function step6() {
    const out = document.getElementById('pcare-out-6');
    out.innerHTML = loadingBox('Memuat formularium obat...');

    try {
      const conn = await OpenIMISApi.getMedicalItems(30);
      const items = SandboxUtil.nodes(conn);

      out.innerHTML = `
        <div class="space-y-2">
          <p class="text-[10.5px] text-slate-600">
            Pilih obat yang diresepkan. Di P-Care ini adalah <code class="font-mono">Obat</code>;
            di openIMIS menjadi <code class="font-mono">ClaimItem</code>.
          </p>
          <div class="max-h-52 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
            ${items.length ? items.map(i => `
              <label class="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" name="pcare-item" value="${SandboxUtil.relayToId(i.id)}"
                  data-code="${SandboxUtil.esc(i.code)}" data-name="${SandboxUtil.esc(i.name)}"
                  data-price="${SandboxUtil.num(i.price)}" class="rounded text-emerald-600">
                <span class="flex-1 text-[10.5px] truncate">${SandboxUtil.esc(i.name)}</span>
                <span class="font-mono text-[10px] text-slate-500">${SandboxUtil.money(i.price)}</span>
              </label>`).join('') : '<div class="text-[10.5px] text-slate-400 p-2">Tidak ada obat.</div>'}
          </div>
          <div class="flex justify-end">
            <button onclick="PcareSimulator.saveItems()"
              class="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-semibold">
              Simpan Resep (updateClaim)
            </button>
          </div>
          <div id="pcare-item-result"></div>
        </div>`;
    } catch (e) {
      out.innerHTML = errBox(e.message);
    }
  }

  async function saveItems() {
    const result = document.getElementById('pcare-item-result');
    const picked = [];
    document.querySelectorAll('input[name="pcare-item"]:checked').forEach(cb => {
      picked.push({
        itemId: Number(cb.value),
        status: 1,
        qtyProvided: 1,
        priceAsked: String(SandboxUtil.num(cb.getAttribute('data-price')))
      });
    });

    if (!picked.length) { SandboxUtil.toast('Pilih minimal satu obat', 'warning'); return; }
    if (!state.claimUuid) { SandboxUtil.toast('UUID klaim belum tersedia', 'warning'); return; }

    state.items = picked;
    result.innerHTML = loadingBox('Menyimpan resep...');

    try {
      await OpenIMISApi.updateClaim({
        clientMutationId: 'pcare-update-items-' + Date.now(),
        uuid: state.claimUuid,
        code: state.claimCode,
        insureeId: SandboxUtil.relayToId(state.patient.id),
        healthFacilityId: state.facility.id,
        icdId: state.diagnosis.id,
        dateFrom: SandboxUtil.val('pcare-claim-date') || SandboxUtil.today(),
        dateClaimed: SandboxUtil.val('pcare-claim-date') || SandboxUtil.today(),
        visitType: 'O',
        careType: 'O',
        services: state.services,
        items: picked
      });

      const total = picked.reduce((s, p) => s + Number(p.priceAsked), 0);
      result.innerHTML = `
        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px]">
          <div class="font-bold text-slate-800">${picked.length} obat tersimpan</div>
          <div class="font-mono text-emerald-700">Total: ${SandboxUtil.money(total)}</div>
        </div>
        <button onclick="PcareSimulator.next(7)" class="mt-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-semibold">
          Lanjut: Rujukan →
        </button>`;
      SandboxUtil.toast('Resep tersimpan', 'success');
    } catch (e) {
      result.innerHTML = errBox(e.message);
    }
  }

  // ---------------------------------------------------------
  // Step 7 — Rujukan (opsional)
  // ---------------------------------------------------------
  async function step7() {
    const out = document.getElementById('pcare-out-7');
    out.innerHTML = loadingBox('Memuat daftar FKRTL...');

    try {
      const conn = await OpenIMISApi.getHealthFacilities(60, { level: 'H' });
      let list = SandboxUtil.nodes(conn);
      if (!list.length) {
        const all = await OpenIMISApi.getHealthFacilities(30);
        list = SandboxUtil.nodes(all);
      }

      out.innerHTML = `
        <div class="space-y-2">
          <p class="text-[10.5px] text-slate-600">
            Bila kondisi pasien memerlukan penanganan lanjutan, FKTP menerbitkan rujukan ke FKRTL.
            Di openIMIS, rujukan dicatat pada klaim lewat <code class="font-mono">referToId</code>
            dan <code class="font-mono">referralCode</code>.
          </p>
          <select id="pcare-refer-select" class="w-full p-2 border border-slate-300 rounded-lg text-[11px] focus:ring-2 focus:ring-teal-500 focus:outline-none">
            <option value="">— Tidak perlu rujukan —</option>
            ${list.map(f => `<option value="${SandboxUtil.relayToId(f.id)}"
              data-code="${SandboxUtil.esc(f.code)}" data-name="${SandboxUtil.esc(f.name)}">
              ${SandboxUtil.esc(f.code)} — ${SandboxUtil.esc(f.name)} (${SandboxUtil.esc(f.level)})
            </option>`).join('')}
          </select>
          ${UiKit.field('Nomor Rujukan', UiKit.input('pcare-refer-code', {
            value: 'RJ-' + Date.now().toString().slice(-8), extraClass: 'font-mono'
          }))}

          <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900 leading-relaxed">
            <strong>Catatan:</strong> nomor rujukan BPJS aslinya diterbitkan oleh sistem VClaim.
            Di sandbox ini kita hanya menyimpan string-nya di klaim sebagai penanda.
          </div>

          <div class="flex justify-end">
            <button onclick="PcareSimulator.saveReferral()"
              class="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-semibold">
              Simpan Rujukan
            </button>
          </div>
          <div id="pcare-refer-result"></div>
        </div>`;
    } catch (e) {
      out.innerHTML = errBox(e.message);
    }
  }

  async function saveReferral() {
    const result = document.getElementById('pcare-refer-result');
    const select = document.getElementById('pcare-refer-select');
    const code = SandboxUtil.val('pcare-refer-code').trim();

    if (!select || !select.value) {
      result.innerHTML = `
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
          Tanpa rujukan — kunjungan tetap di FKTP.
        </div>
        <button onclick="PcareSimulator.next(8)" class="mt-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-semibold">
          Lanjut: Kirim Klaim →
        </button>`;
      return;
    }

    const opt = select.options[select.selectedIndex];
    state.referral = {
      id: Number(select.value),
      code: opt.getAttribute('data-code'),
      name: opt.getAttribute('data-name'),
      referralCode: code
    };

    result.innerHTML = loadingBox('Menyimpan rujukan...');
    try {
      await OpenIMISApi.updateClaim({
        clientMutationId: 'pcare-referral-' + Date.now(),
        uuid: state.claimUuid,
        code: state.claimCode,
        insureeId: SandboxUtil.relayToId(state.patient.id),
        healthFacilityId: state.facility.id,
        icdId: state.diagnosis.id,
        dateFrom: SandboxUtil.today(),
        dateClaimed: SandboxUtil.today(),
        visitType: 'O',
        careType: 'O',
        referToId: state.referral.id,
        referralCode: code,
        services: state.services,
        items: state.items
      });

      result.innerHTML = `
        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] space-y-1">
          <div class="font-bold text-slate-800">Rujukan tercatat</div>
          <div class="text-slate-600">Tujuan: <strong>${SandboxUtil.esc(state.referral.name)}</strong></div>
          <div class="font-mono text-[10px] text-slate-500">No. rujukan: ${SandboxUtil.esc(code)}</div>
        </div>
        <button onclick="PcareSimulator.next(8)" class="mt-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-semibold">
          Lanjut: Kirim Klaim →
        </button>`;
      SandboxUtil.toast('Rujukan tersimpan', 'success');
    } catch (e) {
      result.innerHTML = errBox(e.message);
    }
  }

  // ---------------------------------------------------------
  // Step 8 — Kirim & proses klaim
  // ---------------------------------------------------------
  function step8() {
    const out = document.getElementById('pcare-out-8');
    out.innerHTML = `
      <div class="space-y-2">
        <p class="text-[10.5px] text-slate-600">
          Klaim dikirim ke penjamin. Di P-Care ini adalah "Kirim Klaim"; di openIMIS dua mutation
          berurutan: <code class="font-mono">submitClaims</code> lalu
          <code class="font-mono">processClaims</code>.
        </p>
        <div class="grid grid-cols-3 gap-2">
          ${miniCard('Kode Klaim', state.claimCode || '-')}
          ${miniCard('Status', state.claimStatus ? (SandboxUtil.CLAIM_STATUS[state.claimStatus] || {}).label || state.claimStatus : '-')}
          ${miniCard('Tindakan', state.services.length)}
        </div>

        <div class="flex flex-wrap gap-2">
          <button id="pcare-btn-submit" onclick="PcareSimulator.submitClaim()"
            class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold">
            1. Kirim (submitClaims)
          </button>
          <button id="pcare-btn-process" onclick="PcareSimulator.processClaim()" disabled
            class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg text-[11px] font-semibold">
            2. Proses (processClaims)
          </button>
          <button onclick="GraphQLHelp.previewLast('Mutation Klaim P-Care')"
            class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-300 rounded-lg text-[10.5px] font-mono font-semibold">
            Lihat GraphQL
          </button>
        </div>
        <div id="pcare-claim-result"></div>
      </div>`;
  }

  /** Re-read the claim so we can report its authoritative status. */
  async function refetchClaim() {
    for (let i = 0; i < 8; i++) {
      try {
        const conn = await OpenIMISApi.getClaims(1, { code: state.claimCode });
        const c = SandboxUtil.nodes(conn)[0];
        if (c) { state.claimStatus = c.status; return c; }
      } catch (e) { /* retry */ }
      await new Promise(r => setTimeout(r, 600));
    }
    return null;
  }

  async function submitClaim() {
    const result = document.getElementById('pcare-claim-result');
    if (!state.claimUuid) { result.innerHTML = errBox('UUID klaim tidak tersedia.'); return; }

    result.innerHTML = loadingBox('Mengirim klaim...');
    try {
      await OpenIMISApi.submitClaims([state.claimUuid]);

      // openIMIS returns no statistics — read the claim back instead.
      const fresh = await refetchClaim();
      const newStatus = fresh ? Number(fresh.status) : 4;
      state.claimStatus = newStatus;

      result.innerHTML = `
        <div class="p-3 ${newStatus === 4 ? 'bg-blue-50 border-blue-200' : (newStatus === 1 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200')} border rounded-xl text-[11px] space-y-1">
          <div class="font-bold text-slate-800">Hasil submitClaims</div>
          <div>Status: ${SandboxUtil.claimStatusBadge(newStatus)}</div>
          <div class="text-slate-600 text-[10px]">Klaim diverifikasi terhadap polis, plafon, dan aturan produk.</div>
        </div>`;

      if (newStatus === 4) {
        const btn = document.getElementById('pcare-btn-process');
        if (btn) btn.disabled = false;
      }
    } catch (e) {
      result.innerHTML = errBox(e.message);
    }
  }

  async function processClaim() {
    const result = document.getElementById('pcare-claim-result');
    result.innerHTML = loadingBox('Memproses adjudikasi...');
    try {
      await OpenIMISApi.processClaims([state.claimUuid]);

      // openIMIS returns no statistics — read the claim back instead.
      const final = await refetchClaim();
      const newStatus = final ? Number(final.status) : 8;
      state.claimStatus = newStatus;

      result.innerHTML = `
        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] space-y-2">
          <div class="font-bold text-slate-800">Adjudikasi selesai</div>
          <div>Status: ${SandboxUtil.claimStatusBadge(newStatus)}</div>
          ${final ? `<div class="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200">
            <div><span class="text-[9.5px] text-slate-500 block">Ditagih</span>
              <span class="font-mono font-bold">${SandboxUtil.money(final.claimed)}</span></div>
            <div><span class="text-[9.5px] text-slate-500 block">Disetujui</span>
              <span class="font-mono font-bold text-emerald-700">${SandboxUtil.money(final.approved)}</span></div>
          </div>` : ''}
        </div>

        <div class="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10.5px] text-slate-600 space-y-1">
          <p class="font-bold text-slate-800">Alur P-Care selesai</p>
          <p>Login faskes → cari peserta → validasi eligibilitas → daftar kunjungan → tindakan →
             resep → rujukan → kirim klaim → adjudikasi.</p>
        </div>

        <div class="flex flex-wrap gap-2 mt-2">
          <button onclick="AppRouter.navigate('claims')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10.5px] font-bold">
            Lihat di menu Klaim
          </button>
          <button onclick="PcareSimulator.reset()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[10.5px] font-semibold">
            Ulangi Simulasi
          </button>
        </div>`;
      SandboxUtil.toast(`Adjudikasi selesai — status ${newStatus}`, 'success', 5000);
    } catch (e) {
      result.innerHTML = errBox(e.message);
    }
  }

  // ---------------------------------------------------------
  // Step 9 — Ringkasan & mapping
  // ---------------------------------------------------------
  function step9() {
    const out = document.getElementById('pcare-out-9');
    out.innerHTML = `
      <div class="space-y-2">
        <div class="p-3 bg-slate-900 text-slate-200 rounded-xl text-[10.5px] font-mono leading-relaxed whitespace-pre">${SandboxUtil.esc(
`FASKES (FKTP)                 OPENIMIS
----------------------------  ----------------------------------
Login faskes                  HealthFacility (level = "C")
Cari peserta                  insurees(chfId)
Cek SEP / eligibilitas        policyEligibilityByInsuree
Daftar kunjungan              createClaim  (status 2 Entered)
Diagnosa ICD-10               Claim.icd
Tindakan                      ClaimService
Resep obat                    ClaimItem
Rujukan ke RS                 Claim.referToId + referralCode
Kirim klaim                   submitClaims  (status 4 Checked)
Adjudikasi                    processClaims (8 Processed -> 16 Valuated)`
        )}</div>

        <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900 leading-relaxed">
          <strong>Yang TIDAK ada di openIMIS:</strong> SEP, nomor rujukan VClaim, kode billing,
          dan antrean. Semuanya milik ekosistem BPJS. Sandbox ini menyimpan sebagian sebagai
          string di klaim agar alur tetap bisa dipelajari, tanpa berpura-pura terintegrasi.
        </div>

        <div class="flex justify-end">
          <button onclick="PcareSimulator.reset()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[11px] font-semibold">
            Ulangi Simulasi
          </button>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------
  function mini(label, value, cls = '') {
    return `<div>
      <span class="text-slate-500 block text-[9.5px]">${label}</span>
      <span class="font-semibold ${cls || 'text-slate-800'}">${SandboxUtil.esc(value)}</span>
    </div>`;
  }

  function miniCard(label, value) {
    return `<div class="p-2 bg-white border border-slate-200 rounded-lg">
      <div class="text-[9.5px] text-slate-500 uppercase">${label}</div>
      <div class="font-mono font-bold text-slate-800 text-[11px]">${SandboxUtil.esc(value)}</div>
    </div>`;
  }

  function pill(label, value) {
    return `<div class="p-1.5 bg-white border border-slate-200 rounded text-center">
      <div class="text-[9px] text-slate-500">${label}</div>
      <div class="font-bold">${value !== undefined && value !== null ? value : '-'}</div>
    </div>`;
  }

  function loadingBox(msg) {
    return `<div class="p-3 bg-teal-50 border border-teal-200 rounded-lg text-[11px] text-teal-800 flex items-center gap-2">
      <span class="animate-spin w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full"></span>
      ${SandboxUtil.esc(msg)}</div>`;
  }

  function warnBox(title, body) {
    return `<div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
      <div class="font-bold">${SandboxUtil.esc(title)}</div>
      <div class="mt-1 leading-relaxed">${body}</div></div>`;
  }

  function errBox(msg) {
    return `<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800">${SandboxUtil.esc(msg)}</div>`;
  }

  function next(n) {
    setStep(n);
    const runners = {
      2: step2, 3: step3, 4: step4, 5: step5,
      6: step6, 7: step7, 8: step8, 9: step9
    };
    if (runners[n]) runners[n]();
  }

  function reset() {
    state = {
      facility: null, patient: null, chfId: null, eligibility: null,
      claimCode: null, claimUuid: null, claimStatus: null,
      services: [], items: [], diagnosis: null, referral: null
    };
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const out = document.getElementById(`pcare-out-${i}`);
      if (out) out.innerHTML = '';
    }
    setStep(1);
    step1();
    SandboxUtil.toast('Simulasi P-Care di-reset', 'info');
  }

  return {
    init, next, reset,
    step1, step2, step3, step4, step5, step6, step7, step8, step9,
    confirmFacility, findPatient, createEncounter,
    saveServices, saveItems, saveReferral,
    submitClaim, processClaim
  };
})();

window.PcareSimulator = PcareSimulator;
