// ============================================================
// Mobile JKN Business Process Simulator
// ------------------------------------------------------------
// Mobile JKN is BPJS Kesehatan's participant-facing app. Here it
// is played by the sandbox UI; every user action is translated
// into a real openIMIS GraphQL call so the mapping between the
// BPJS concept and the openIMIS entity is visible.
//
// DISCLAIMER: this is an educational simulation. No connection to
// BPJS VClaim / Mobile JKN APIs is made.
// ============================================================
const MobileJknSimulator = (function () {
  let step = 1;
  let state = {
    chfId: null,
    patient: null,
    eligibility: null,
    policies: [],
    premiums: [],
    fktp: null,
    ticket: null
  };

  const TOTAL_STEPS = 8;

  // ---------------------------------------------------------
  // Step UI
  // ---------------------------------------------------------
  function updateStepUI() {
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const card = document.getElementById(`jkn-step-${i}`);
      const dot = document.getElementById(`jkn-dot-${i}`);
      const body = document.getElementById(`jkn-body-${i}`);
      if (!card || !body) continue;

      if (i === step) {
        card.className = 'bg-white rounded-2xl p-5 border-2 border-sky-500 ring-2 ring-sky-500/20 shadow-sm space-y-3';
        if (dot) dot.className = 'w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs shadow';
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
    loadPatientOptions();
  }

  async function loadPatientOptions() {
    const select = document.getElementById('jkn-card-input');
    if (!select) return;
    try {
      const conn = await OpenIMISApi.getInsurees(25);
      const list = SandboxUtil.nodes(conn);
      select.innerHTML = list.map(p =>
        `<option value="${SandboxUtil.esc(p.chfId)}">${SandboxUtil.esc(p.chfId)} — ${SandboxUtil.esc((p.otherNames || '') + ' ' + (p.lastName || ''))}</option>`
      ).join('');
    } catch (e) {
      select.innerHTML = '<option value="070707070">070707070</option>';
    }
  }

  // ---------------------------------------------------------
  // Step 1 — Login peserta
  // ---------------------------------------------------------
  async function step1() {
    const chfId = SandboxUtil.val('jkn-card-input').trim();
    if (!chfId) { SandboxUtil.toast('Pilih / masukkan nomor kartu', 'warning'); return; }

    const out = document.getElementById('jkn-out-1');
    out.innerHTML = loadingBox('Mencari peserta...');

    try {
      const conn = await OpenIMISApi.getInsurees(1, { chfId });
      const list = SandboxUtil.nodes(conn);

      if (!list.length) {
        out.innerHTML = warnBox(
          'Peserta tidak ditemukan',
          `Nomor <strong>${SandboxUtil.esc(chfId)}</strong> tidak ada di master data openIMIS.
           Di Mobile JKN, kondisi ini berarti "Data Tidak Ditemukan" dan peserta diarahkan ke kantor cabang.`
        );
        return;
      }

      const p = list[0];
      state.chfId = chfId;
      state.patient = p;

      out.innerHTML = `
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
            ${mini('Telepon', p.phone || '-')}
          </div>
          <div class="flex justify-between items-center pt-1">
            <span class="text-[10px] text-slate-500">Data diambil lewat <code class="font-mono">insurees(chfId:)</code></span>
            <button onclick="GraphQLHelp.previewLast('Query Login Peserta')" class="text-[10px] text-sky-600 hover:underline">Lihat GraphQL</button>
          </div>
        </div>
        <button onclick="MobileJknSimulator.next(2)" class="mt-2 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-semibold">
          Lanjut: Cek Status Kepesertaan →
        </button>`;
      SandboxUtil.refreshIcons();
    } catch (e) {
      out.innerHTML = errBox(e.message);
    }
  }

  // ---------------------------------------------------------
  // Step 2 — Status kepesertaan
  // ---------------------------------------------------------
  async function step2() {
    const out = document.getElementById('jkn-out-2');
    out.innerHTML = loadingBox('Memeriksa status kepesertaan...');

    try {
      const { policies, eligibility } = await OpenIMISApi.checkEligibility(state.chfId);
      state.policies = policies;
      state.eligibility = eligibility;

      const active = policies.filter(p => Number(p.status) === 2);
      const isActive = active.length > 0;
      const serviceOk = eligibility ? eligibility.isServiceOk !== false : isActive;
      const itemOk = eligibility ? eligibility.isItemOk !== false : isActive;

      out.innerHTML = `
        <div class="p-3 ${isActive ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'} border rounded-xl text-[11px] space-y-2">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}">
              ${isActive ? 'STATUS: AKTIF' : 'STATUS: NONAKTIF'}
            </span>
            <span class="text-[10px] text-slate-500 ml-auto">via policyEligibilityByInsuree</span>
          </div>

          ${eligibility ? `
            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-[10.5px]">
              ${mini('Sisa Kunjungan', eligibility.totalVisitsLeft !== null ? eligibility.totalVisitsLeft : '-')}
              ${mini('Sisa Konsultasi', eligibility.totalConsultationsLeft !== null ? eligibility.totalConsultationsLeft : '-')}
              ${mini('Tindakan Dijamin', serviceOk ? 'Ya' : 'Tidak', serviceOk ? 'text-emerald-700' : 'text-red-600')}
              ${mini('Obat Dijamin', itemOk ? 'Ya' : 'Tidak', itemOk ? 'text-emerald-700' : 'text-red-600')}
            </div>` : ''}

          <div class="p-2 bg-white/70 rounded-lg border border-slate-200 text-[10px] text-slate-600 leading-relaxed">
            <strong>Pemetaan:</strong> di BPJS, status <em>AKTIF / NONAKTIF</em> ditentukan oleh
            pembayaran iuran. Di openIMIS, hal yang setara adalah ada-tidaknya
            <code class="font-mono">Policy</code> berstatus <code>2 (Active)</code> beserta
            <code class="font-mono">isServiceOk</code> / <code class="font-mono">isItemOk</code>.
          </div>

          <div class="flex justify-between items-center">
            <button onclick="GraphQLHelp.previewLast('Query Status Kepesertaan')" class="text-[10px] text-sky-600 hover:underline">Lihat GraphQL</button>
            <button onclick="MobileJknSimulator.next(3)" class="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-semibold">
              Lanjut: Hak Manfaat →
            </button>
          </div>
        </div>`;
    } catch (e) {
      out.innerHTML = errBox(e.message);
    }
  }

  // ---------------------------------------------------------
  // Step 3 — Kelas & hak manfaat
  // ---------------------------------------------------------
  async function step3() {
    const out = document.getElementById('jkn-out-3');
    out.innerHTML = loadingBox('Mengambil rincian manfaat...');

    try {
      const list = await OpenIMISApi.getPoliciesByInsuree(state.chfId, true);
      state.policies = list;

      if (!list.length) {
        out.innerHTML = warnBox('Belum ada polis',
          'Peserta belum memiliki polis, sehingga tidak ada hak manfaat yang bisa ditampilkan.');
        return;
      }

      out.innerHTML = `
        <div class="space-y-2">
          ${list.map(p => `
            <div class="p-3 bg-white border border-slate-200 rounded-xl text-[11px] space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-800">${SandboxUtil.esc(p.productName || p.productCode)}</span>
                ${SandboxUtil.policyStatusBadge(p.status)}
              </div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10.5px]">
                ${mini('Mulai', SandboxUtil.dateOnly(p.startDate))}
                ${mini('Kadaluwarsa', SandboxUtil.dateOnly(p.expiryDate))}
                ${mini('Plafon', SandboxUtil.money(p.ceiling), 'text-sky-700 font-mono')}
                ${mini('Sisa Saldo', SandboxUtil.money(p.balance), 'text-emerald-700 font-mono')}
              </div>
            </div>`).join('')}

          <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900 leading-relaxed">
            <strong>Catatan pemetaan:</strong> "Kelas I / II / III" pada BPJS tidak punya field
            khusus di openIMIS. Ia dipetakan lewat <code class="font-mono">Product</code>
            (kode &amp; nama produk) dan <code class="font-mono">Product.ceiling</code> untuk plafon.
          </div>

          <div class="flex justify-between items-center">
            <button onclick="GraphQLHelp.previewLast('Query Hak Manfaat')" class="text-[10px] text-sky-600 hover:underline">Lihat GraphQL</button>
            <button onclick="MobileJknSimulator.next(4)" class="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-semibold">
              Lanjut: Tagihan Iuran →
            </button>
          </div>
        </div>`;
    } catch (e) {
      out.innerHTML = errBox(e.message);
    }
  }

  // ---------------------------------------------------------
  // Step 4 — Tagihan iuran
  // ---------------------------------------------------------
  async function step4() {
    const out = document.getElementById('jkn-out-4');
    out.innerHTML = loadingBox('Mengambil riwayat iuran...');

    try {
      const policyUuids = state.policies.map(p => p.policyUuid).filter(Boolean);
      let premiums = [];

      if (policyUuids.length) {
        try {
          const conn = await OpenIMISApi.getPremiumsByPolicies(policyUuids);
          premiums = SandboxUtil.nodes(conn);
        } catch (e) { /* fall through */ }
      }
      if (!premiums.length) {
        const conn = await OpenIMISApi.getPremiums(20);
        premiums = SandboxUtil.nodes(conn);
      }
      state.premiums = premiums;

      const totalPaid = premiums.reduce((s, p) => s + SandboxUtil.num(p.amount), 0);

      out.innerHTML = `
        <div class="space-y-2">
          <div class="grid grid-cols-2 gap-2">
            ${miniCard('Total Iuran Dibayar', SandboxUtil.money(totalPaid), 'text-emerald-700')}
            ${miniCard('Jumlah Transaksi', premiums.length, 'text-slate-800')}
          </div>

          ${premiums.length ? `
            <div class="overflow-x-auto rounded-lg border border-slate-200">
              <table class="w-full text-[10.5px]">
                <thead class="bg-slate-50 text-slate-600"><tr>
                  <th class="p-2 text-left">Kwitansi</th>
                  <th class="p-2 text-left">Tanggal</th>
                  <th class="p-2 text-left">Metode</th>
                  <th class="p-2 text-right">Nominal</th>
                </tr></thead>
                <tbody>
                  ${premiums.slice(0, 10).map(p => `<tr class="border-t border-slate-100">
                    <td class="p-2 font-mono text-slate-600">${SandboxUtil.esc(p.receipt || '-')}</td>
                    <td class="p-2">${SandboxUtil.dateOnly(p.payDate)}</td>
                    <td class="p-2">${SandboxUtil.esc(SandboxUtil.payTypeLabel(p.payType))}</td>
                    <td class="p-2 text-right font-mono font-bold">${SandboxUtil.money(p.amount)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>` : '<div class="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[10.5px] text-slate-500">Belum ada riwayat pembayaran.</div>'}

          <div class="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-[10px] text-sky-900 leading-relaxed">
            <strong>Pemetaan:</strong> "Virtual Account / kode billing" di BPJS tidak punya entitas
            sendiri di openIMIS. Pembayaran dicatat sebagai <code class="font-mono">Premium</code>
            dengan <code>receipt</code>, <code>amount</code>, <code>payDate</code>, dan
            <code>payType</code>.
          </div>

          <div class="flex justify-between items-center">
            <button onclick="GraphQLHelp.previewLast('Query Iuran')" class="text-[10px] text-sky-600 hover:underline">Lihat GraphQL</button>
            <button onclick="MobileJknSimulator.next(5)" class="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-semibold">
              Lanjut: Pilih FKTP →
            </button>
          </div>
        </div>`;
    } catch (e) {
      out.innerHTML = errBox(e.message);
    }
  }

  // ---------------------------------------------------------
  // Step 5 — Pilih / ganti FKTP
  // ---------------------------------------------------------
  async function step5() {
    const out = document.getElementById('jkn-out-5');
    out.innerHTML = loadingBox('Memuat daftar FKTP...');

    try {
      const conn = await OpenIMISApi.getHealthFacilities(60, { level: 'C' });
      let list = SandboxUtil.nodes(conn);

      // fall back to any facility if no level-C exists in the demo dataset
      if (!list.length) {
        const all = await OpenIMISApi.getHealthFacilities(30);
        list = SandboxUtil.nodes(all);
      }

      if (!list.length) {
        out.innerHTML = warnBox('Tidak ada FKTP', 'Belum ada fasilitas kesehatan terdaftar.');
        return;
      }

      const current = state.patient && state.patient.healthFacility ? state.patient.healthFacility.code : null;

      out.innerHTML = `
        <div class="space-y-2">
          <p class="text-[10.5px] text-slate-600">
            Pilih fasilitas kesehatan tingkat pertama (FKTP). Di openIMIS ini adalah
            <code class="font-mono">HealthFacility</code> dengan <code>level = "C"</code>.
          </p>
          <select id="jkn-fktp-select" class="w-full p-2 border border-slate-300 rounded-lg text-[11px] focus:ring-2 focus:ring-sky-500 focus:outline-none">
            ${list.map(f => `<option value="${SandboxUtil.relayToId(f.id)}"
              data-code="${SandboxUtil.esc(f.code)}" data-name="${SandboxUtil.esc(f.name)}"
              ${current && f.code === current ? 'selected' : ''}>
              ${SandboxUtil.esc(f.code)} — ${SandboxUtil.esc(f.name)} (${SandboxUtil.esc(f.level)})
            </option>`).join('')}
          </select>
          ${current ? `<p class="text-[10px] text-emerald-700">FKTP terdaftar saat ini: <strong>${SandboxUtil.esc(current)}</strong></p>` : ''}

          <div class="flex justify-between items-center pt-1">
            <button onclick="GraphQLHelp.previewLast('Query Daftar FKTP')" class="text-[10px] text-sky-600 hover:underline">Lihat GraphQL</button>
            <div class="flex gap-2">
              <button onclick="MobileJknSimulator.applyFktp()"
                class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold">
                Simpan Pilihan FKTP
              </button>
              <button onclick="MobileJknSimulator.next(6)" class="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-semibold">
                Lanjut: Antrean →
              </button>
            </div>
          </div>
        </div>`;
    } catch (e) {
      out.innerHTML = errBox(e.message);
    }
  }

  async function applyFktp() {
    const select = document.getElementById('jkn-fktp-select');
    if (!select) return;
    const opt = select.options[select.selectedIndex];
    const hfId = Number(select.value);

    try {
      await OpenIMISApi.updateInsuree({
        clientMutationId: 'jkn-change-fktp-' + Date.now(),
        uuid: state.patient.uuid,
        chfId: state.patient.chfId,
        lastName: state.patient.lastName,
        otherNames: state.patient.otherNames,
        genderId: state.patient.gender ? state.patient.gender.code : 'M',
        dob: SandboxUtil.dateOnly(state.patient.dob),
        head: state.patient.head,
        cardIssued: state.patient.cardIssued,
        healthFacilityId: hfId
      });

      state.fktp = { id: hfId, code: opt.getAttribute('data-code'), name: opt.getAttribute('data-name') };
      SandboxUtil.toast(`FKTP diubah ke ${state.fktp.name}`, 'success', 4000);
      state.patient.healthFacility = state.fktp;
    } catch (e) {
      SandboxUtil.toast(`Gagal mengubah FKTP: ${e.message}`, 'error', 6000);
    }
  }

  // ---------------------------------------------------------
  // Step 6 — Antrean online (local simulation)
  // ---------------------------------------------------------
  function step6() {
    const out = document.getElementById('jkn-out-6');
    const fktpName = state.fktp ? state.fktp.name : (state.patient && state.patient.healthFacility ? state.patient.healthFacility.name : 'FKTP terdaftar');

    out.innerHTML = `
      <div class="space-y-2">
        <div class="p-3 bg-white border border-slate-200 rounded-xl text-[11px] space-y-2">
          <div class="grid grid-cols-2 gap-2">
            ${mini('Fasilitas Tujuan', fktpName)}
            ${mini('Poli', 'Poli Umum')}
            ${mini('Tanggal', SandboxUtil.dateOnly(SandboxUtil.today()))}
            ${mini('Perkiraan Jam', '09:30')}
          </div>
          <div class="p-3 bg-slate-900 rounded-xl text-center">
            <div class="text-[9.5px] text-slate-400 uppercase tracking-wide">Nomor Antrean</div>
            <div class="text-3xl font-black text-yellow-400 font-mono">A-014</div>
            <div class="text-[9.5px] text-slate-500 mt-0.5">Estimasi tunggu ± 25 menit</div>
          </div>
        </div>

        <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900 leading-relaxed">
          <strong>Di luar cakupan openIMIS.</strong> openIMIS tidak memiliki entitas "antrean".
          Fitur antrean online Mobile JKN berada di sistem BPJS (aplikasi Mobile JKN / Antrean
          Online RS). Di sandbox ini ia disimulasikan agar alurnya utuh. Untuk mencatat bahwa
          pasien benar-benar datang, langkah berikutnya (riwayat pelayanan) memakai
          <code class="font-mono">Claim</code> sebagai representasi kunjungan.
        </div>

        <div class="flex justify-end">
          <button onclick="MobileJknSimulator.next(7)" class="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-semibold">
            Lanjut: Riwayat Pelayanan →
          </button>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------
  // Step 7 — Riwayat pelayanan
  // ---------------------------------------------------------
  async function step7() {
    const out = document.getElementById('jkn-out-7');
    out.innerHTML = loadingBox('Mengambil riwayat kunjungan...');

    try {
      const conn = await OpenIMISApi.getClaims(20, { chfId: state.chfId });
      const claims = SandboxUtil.nodes(conn);

      out.innerHTML = `
        <div class="space-y-2">
          ${claims.length ? `
            <div class="overflow-x-auto rounded-lg border border-slate-200">
              <table class="w-full text-[10.5px]">
                <thead class="bg-slate-50 text-slate-600"><tr>
                  <th class="p-2 text-left">Kode</th>
                  <th class="p-2 text-left">Faskes</th>
                  <th class="p-2 text-left">Tanggal</th>
                  <th class="p-2 text-left">Diagnosa</th>
                  <th class="p-2 text-left">Status</th>
                  <th class="p-2 text-right">Ditagih</th>
                </tr></thead>
                <tbody>
                  ${claims.map(c => `<tr class="border-t border-slate-100">
                    <td class="p-2 font-mono text-sky-700">${SandboxUtil.esc(c.code)}</td>
                    <td class="p-2">${SandboxUtil.esc(c.healthFacility ? c.healthFacility.name : '-')}</td>
                    <td class="p-2">${SandboxUtil.dateOnly(c.dateClaimed)}</td>
                    <td class="p-2">${SandboxUtil.esc(c.icd ? c.icd.code : '-')}</td>
                    <td class="p-2">${SandboxUtil.claimStatusBadge(c.status)}</td>
                    <td class="p-2 text-right font-mono">${SandboxUtil.money(c.claimed)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>` : `<div class="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[10.5px] text-slate-500">
              Belum ada riwayat kunjungan untuk peserta ini.</div>`}

          <div class="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-[10px] text-sky-900 leading-relaxed">
            <strong>Pemetaan:</strong> "Riwayat Pelayanan" di Mobile JKN = daftar
            <code class="font-mono">Claim</code> milik peserta. Status klaim di openIMIS
            (1 Rejected, 2 Entered, 4 Checked, 8 Processed, 16 Valuated) bukan status yang
            ditampilkan ke peserta, tetapi bisa dipakai untuk audit internal.
          </div>

          <div class="flex justify-between items-center">
            <button onclick="GraphQLHelp.previewLast('Query Riwayat Pelayanan')" class="text-[10px] text-sky-600 hover:underline">Lihat GraphQL</button>
            <button onclick="MobileJknSimulator.next(8)" class="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-semibold">
              Lanjut: Ajukan Pengaduan →
            </button>
          </div>
        </div>`;
    } catch (e) {
      out.innerHTML = errBox(e.message);
    }
  }

  // ---------------------------------------------------------
  // Step 8 — Pengaduan
  // ---------------------------------------------------------
  function step8() {
    const out = document.getElementById('jkn-out-8');
    out.innerHTML = `
      <div class="space-y-2">
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Kategori', UiKit.select('jkn-tkt-cat',
            `<option value="service">Pelayanan Faskes</option>
             <option value="claim">Klaim</option>
             <option value="payment">Iuran / Pembayaran</option>
             <option value="other">Lainnya</option>`))}
          ${UiKit.field('Prioritas', UiKit.select('jkn-tkt-prio',
            `<option value="Medium">Sedang</option>
             <option value="High">Tinggi</option>
             <option value="Urgent">Mendesak</option>`))}
        </div>
        ${UiKit.field('Judul', UiKit.input('jkn-tkt-title', { value: 'Antrean poli terlalu lama', required: true }))}
        ${UiKit.field('Deskripsi', UiKit.textarea('jkn-tkt-desc', {
          value: 'Menunggu lebih dari 2 jam di poli umum meski sudah mengambil antrean online.',
          rows: 3
        }))}
        <div class="flex justify-end">
          <button onclick="MobileJknSimulator.submitTicket()"
            class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-semibold">
            Kirim Pengaduan (createTicket)
          </button>
        </div>
        <div id="jkn-tkt-result"></div>
      </div>`;
  }

  async function submitTicket() {
    const result = document.getElementById('jkn-tkt-result');
    result.innerHTML = loadingBox('Mengirim pengaduan...');

    try {
      const res = await OpenIMISApi.createTicket({
        clientMutationId: 'jkn-ticket-' + Date.now(),
        title: SandboxUtil.val('jkn-tkt-title').trim(),
        description: SandboxUtil.val('jkn-tkt-desc').trim(),
        status: 'RECEIVED',
        priority: SandboxUtil.val('jkn-tkt-prio'),
        category: SandboxUtil.val('jkn-tkt-cat'),
        channel: 'Mobile JKN'
      });

      result.innerHTML = `
        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] space-y-1">
          <div class="font-bold text-slate-800">Pengaduan terkirim</div>
          <p class="text-slate-600">Tiket dibuat di openIMIS dengan status <strong>RECEIVED</strong> dan kanal <strong>Mobile JKN</strong>.</p>
          <p class="text-[10px] text-slate-500">Di sistem nyata, tiket ini masuk ke alur grievance BPJS dan diteruskan ke faskes terkait.</p>
          <div class="flex gap-2 pt-1">
            <button onclick="AppRouter.navigate('tickets')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-semibold">
              Lihat di menu Tiket
            </button>
            <button onclick="GraphQLHelp.previewLast('Mutation Buat Tiket')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold">
              Lihat GraphQL
            </button>
          </div>
        </div>
        <div class="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10.5px] text-slate-600 space-y-1">
          <p class="font-bold text-slate-800">Alur Mobile JKN selesai</p>
          <p>Yang baru saja dipetakan: login → status kepesertaan → hak manfaat → iuran →
             FKTP → antrean → riwayat layanan → pengaduan.</p>
        </div>`;
      SandboxUtil.refreshIcons();
      SandboxUtil.toast('Pengaduan terkirim', 'success');
    } catch (e) {
      result.innerHTML = errBox(e.message);
    }
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

  function miniCard(label, value, cls = '') {
    return `<div class="p-2.5 bg-white border border-slate-200 rounded-lg">
      <div class="text-[9.5px] text-slate-500 uppercase">${label}</div>
      <div class="font-mono font-bold ${cls}">${SandboxUtil.esc(value)}</div>
    </div>`;
  }

  function loadingBox(msg) {
    return `<div class="p-3 bg-sky-50 border border-sky-200 rounded-lg text-[11px] text-sky-800 flex items-center gap-2">
      <span class="animate-spin w-3.5 h-3.5 border-2 border-sky-600 border-t-transparent rounded-full"></span>
      ${SandboxUtil.esc(msg)}</div>`;
  }

  function warnBox(title, body) {
    return `<div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
      <div class="font-bold">${SandboxUtil.esc(title)}</div>
      <div class="mt-1 leading-relaxed">${body}</div></div>`;
  }

  function errBox(msg) {
    return `<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800">
      ${SandboxUtil.esc(msg)}</div>`;
  }

  function next(n) {
    setStep(n);
    const runners = {
      2: step2, 3: step3, 4: step4, 5: step5,
      6: step6, 7: step7, 8: step8
    };
    if (runners[n]) runners[n]();
  }

  function reset() {
    state = { chfId: null, patient: null, eligibility: null, policies: [], premiums: [], fktp: null, ticket: null };
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const out = document.getElementById(`jkn-out-${i}`);
      if (out) out.innerHTML = '';
    }
    setStep(1);
    SandboxUtil.toast('Simulasi Mobile JKN di-reset', 'info');
  }

  return { init, next, reset, step1, step2, step3, step4, step5, step6, step7, step8, applyFktp, submitTicket };
})();

window.MobileJknSimulator = MobileJknSimulator;
