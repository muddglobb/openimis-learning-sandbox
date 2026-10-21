// ============================================================
// Hospital End-to-End Simulation
// 5 stages, each backed by a real GraphQL call:
//   1 Admission + eligibility   2 Clinical encounter
//   3 Billing                   4 Claim submission
//   5 Real adjudication (submitClaims -> processClaims)
// ============================================================
const HospitalSimulation = (function () {
  let currentStep = 1;
  let data = {
    patient: null,
    facility: null,
    diagnosis: null,
    services: [],
    items: [],
    complaints: '',
    claimCode: '',
    claimUuid: null,
    claimStatus: null,
    claimDetail: null,
    claimResult: null
  };

  // ---------------------------------------------------------
  // Step UI
  // ---------------------------------------------------------
  function updateStepUI() {
    for (let i = 1; i <= 5; i++) {
      const card = document.getElementById(`sim-step-${i}`);
      const dot = document.getElementById(`sim-dot-${i}`);
      const content = document.getElementById(`sim-content-${i}`);
      if (!card || !content) continue;

      if (i === currentStep) {
        card.classList.remove('opacity-50', 'border-slate-200', 'border-emerald-300');
        card.classList.add('border-sky-500', 'bg-sky-50/40', 'ring-2', 'ring-sky-500/20');
        if (dot) dot.className = 'w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-sm shadow-md';
        content.classList.remove('hidden');
      } else if (i < currentStep) {
        card.classList.remove('opacity-50', 'border-sky-500', 'bg-sky-50/40', 'ring-2', 'ring-sky-500/20');
        card.classList.add('border-emerald-300', 'bg-emerald-50/30');
        if (dot) dot.className = 'w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm';
        content.classList.add('hidden');
      } else {
        card.classList.remove('border-sky-500', 'bg-sky-50/40', 'border-emerald-300', 'bg-emerald-50/30', 'ring-2', 'ring-sky-500/20');
        card.classList.add('opacity-50', 'border-slate-200');
        if (dot) dot.className = 'w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm';
        content.classList.add('hidden');
      }
    }
  }

  // ---------------------------------------------------------
  // Init
  // ---------------------------------------------------------
  async function init() {
    if (!data.claimCode) data.claimCode = 'CLM-' + Date.now().toString().slice(-8);
    updateStepUI();
    await loadInitialOptions();
  }

  async function loadInitialOptions() {
    try {
      const [hfConn, insConn, diagConn, svcConn, itemConn] = await Promise.all([
        OpenIMISApi.getHealthFacilities(20),
        OpenIMISApi.getInsurees(20),
        OpenIMISApi.getDiagnoses(40),
        OpenIMISApi.getMedicalServices(20),
        OpenIMISApi.getMedicalItems(20)
      ]);

      const hfs = SandboxUtil.nodes(hfConn);
      const hfSelect = document.getElementById('sim-hf-select');
      if (hfSelect && hfs.length) {
        hfSelect.innerHTML = hfs.map(f => `
          <option value="${SandboxUtil.esc(f.id)}"
                  data-code="${SandboxUtil.esc(f.code)}"
                  data-name="${SandboxUtil.esc(f.name)}">
            ${SandboxUtil.esc(f.code)} - ${SandboxUtil.esc(f.name)} (${SandboxUtil.esc(f.level)})
          </option>`).join('');
        data.facility = hfs[0];
      }

      const insurees = SandboxUtil.nodes(insConn);
      const insSelect = document.getElementById('sim-insuree-select');
      if (insSelect && insurees.length) {
        insSelect.innerHTML = insurees.map(p => `
          <option value="${SandboxUtil.esc(p.id)}"
                  data-chfid="${SandboxUtil.esc(p.chfId)}"
                  data-name="${SandboxUtil.esc((p.otherNames || '') + ' ' + (p.lastName || ''))}"
                  data-dob="${SandboxUtil.esc(SandboxUtil.dateOnly(p.dob))}">
            ${SandboxUtil.esc(p.chfId)} - ${SandboxUtil.esc((p.otherNames || '') + ' ' + (p.lastName || ''))}
          </option>`).join('');
        data.patient = insurees[0];
      }

      const diagnoses = SandboxUtil.nodes(diagConn);
      const diagSelect = document.getElementById('sim-diag-select');
      if (diagSelect && diagnoses.length) {
        diagSelect.innerHTML = diagnoses.map(d => `
          <option value="${SandboxUtil.esc(d.id)}"
                  data-code="${SandboxUtil.esc(d.code)}"
                  data-name="${SandboxUtil.esc(d.name)}">
            [${SandboxUtil.esc(d.code)}] ${SandboxUtil.esc(d.name)}
          </option>`).join('');
        data.diagnosis = diagnoses[0];
      }

      const services = SandboxUtil.nodes(svcConn);
      const sList = document.getElementById('sim-services-checkboxes');
      if (sList) {
        sList.innerHTML = services.length ? services.map(s => `
          <label class="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input type="checkbox" name="sim-service"
                   value="${SandboxUtil.esc(SandboxUtil.relayToId(s.id))}"
                   data-name="${SandboxUtil.esc(s.name)}"
                   data-price="${SandboxUtil.num(s.price)}"
                   class="rounded text-purple-600 focus:ring-purple-500">
            <div class="flex-1 min-w-0">
              <span class="font-medium text-slate-800 text-[11px] block truncate">${SandboxUtil.esc(s.name)}</span>
              <span class="text-[10px] text-slate-500 block font-mono">${SandboxUtil.esc(s.code)} - ${SandboxUtil.money(s.price)}</span>
            </div>
          </label>`).join('') : '<div class="p-2 text-[11px] text-slate-400">Tidak ada tindakan.</div>';
      }

      const items = SandboxUtil.nodes(itemConn);
      const iList = document.getElementById('sim-items-checkboxes');
      if (iList) {
        iList.innerHTML = items.length ? items.map(i => `
          <label class="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input type="checkbox" name="sim-item"
                   value="${SandboxUtil.esc(SandboxUtil.relayToId(i.id))}"
                   data-name="${SandboxUtil.esc(i.name)}"
                   data-price="${SandboxUtil.num(i.price)}"
                   class="rounded text-emerald-600 focus:ring-emerald-500">
            <div class="flex-1 min-w-0">
              <span class="font-medium text-slate-800 text-[11px] block truncate">${SandboxUtil.esc(i.name)}</span>
              <span class="text-[10px] text-slate-500 block font-mono">${SandboxUtil.esc(i.code)} - ${SandboxUtil.money(i.price)}</span>
            </div>
          </label>`).join('') : '<div class="p-2 text-[11px] text-slate-400">Tidak ada obat.</div>';
      }
    } catch (err) {
      console.error('loadInitialOptions', err);
      SandboxUtil.toast('Gagal memuat referensi simulasi. Pastikan OpenIMIS berjalan.', 'error', 6000);
    }
  }

  // ---------------------------------------------------------
  // Step 1: admission & eligibility
  // ---------------------------------------------------------
  async function runStep1() {
    const select = document.getElementById('sim-insuree-select');
    const hfSelect = document.getElementById('sim-hf-select');
    const resultBox = document.getElementById('sim-step1-result');

    if (!select || !select.value) {
      SandboxUtil.toast('Pilih pasien terlebih dahulu', 'error');
      return;
    }

    const opt = select.options[select.selectedIndex];
    const chfId = opt.getAttribute('data-chfid');
    const name = opt.getAttribute('data-name');
    const dob = opt.getAttribute('data-dob');

    const hfOpt = hfSelect.options[hfSelect.selectedIndex];
    data.facility = {
      id: hfSelect.value,
      code: hfOpt.getAttribute('data-code'),
      name: hfOpt.getAttribute('data-name')
    };
    data.patient = { id: select.value, chfId, name, dob };

    resultBox.innerHTML = `<div class="flex items-center gap-2 text-sky-700 text-[11px] p-3 bg-sky-50 rounded-lg">
      <span class="animate-spin w-3.5 h-3.5 border-2 border-sky-600 border-t-transparent rounded-full"></span>
      Memanggil <code class="font-mono">policyEligibilityByInsuree</code> ...
    </div>`;

    try {
      const { policies, eligibility } = await OpenIMISApi.checkEligibility(chfId);
      const hasPolicy = policies && policies.length > 0;
      const policy = hasPolicy ? policies[0] : null;
      const serviceOk = eligibility ? eligibility.isServiceOk !== false : hasPolicy;
      const itemOk = eligibility ? eligibility.isItemOk !== false : hasPolicy;

      resultBox.innerHTML = `
        <div class="p-4 ${hasPolicy ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'} border rounded-xl space-y-2">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-2">
              <i data-lucide="${hasPolicy ? 'shield-check' : 'user-check'}"
                 class="w-4 h-4 ${hasPolicy ? 'text-emerald-600' : 'text-amber-600'}"></i>
              <span class="font-bold text-slate-800 text-[11px]">${SandboxUtil.esc(name)} (${SandboxUtil.esc(chfId)})</span>
            </div>
            ${hasPolicy
              ? '<span class="px-2 py-0.5 text-[10px] bg-emerald-600 text-white rounded-full font-bold">POLIS AKTIF - ELIGIBLE</span>'
              : '<span class="px-2 py-0.5 text-[10px] bg-amber-600 text-white rounded-full font-bold">BELUM ADA POLIS AKTIF</span>'}
          </div>

          ${hasPolicy ? `
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-emerald-200/60 text-[10.5px]">
              ${kv('Produk Jaminan', policy.productName || policy.productCode)}
              ${kv('Masa Berlaku', SandboxUtil.dateOnly(policy.expiryDate))}
              ${kv('Sisa Saldo', SandboxUtil.money(policy.balance), 'text-emerald-700')}
              ${kv('Jaminan Tindakan', serviceOk ? 'Dijamin' : 'Tidak', serviceOk ? 'text-emerald-700' : 'text-red-600')}
              ${kv('Jaminan Obat', itemOk ? 'Dijamin' : 'Tidak', itemOk ? 'text-emerald-700' : 'text-red-600')}
              ${kv('Status Polis', SandboxUtil.POLICY_STATUS[policy.status] ? SandboxUtil.POLICY_STATUS[policy.status].label : policy.status)}
            </div>` : `
            <div class="text-[10.5px] text-slate-600 space-y-1 pt-2 border-t border-amber-200/60">
              <p>Peserta terdaftar di master data, namun belum punya polis aktif / belum membayar iuran.
                 Di BPJS, kondisi ini setara dengan status <strong>NONAKTIF</strong>.</p>
              <p class="text-amber-800">Pelayanan tetap bisa dilanjutkan sebagai <strong>pasien umum (bayar mandiri)</strong>.</p>
            </div>`}

          <div class="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
            <span>Faskes: <strong>${SandboxUtil.esc(data.facility.name)}</strong></span>
            <span>Tanggal masuk: <strong>${SandboxUtil.dateOnly(SandboxUtil.today())}</strong></span>
          </div>

          <div class="flex justify-end">
            <button onclick="GraphQLHelp.previewLast('Query Cek Eligibilitas')"
              class="text-[10px] text-slate-500 hover:text-sky-600 underline">Lihat GraphQL</button>
          </div>
        </div>`;

      SandboxUtil.refreshIcons();
      const nextBtn = document.getElementById('sim-btn-step1-next');
      if (nextBtn) nextBtn.disabled = false;
      SandboxUtil.toast('Verifikasi pasien selesai', 'success');
    } catch (err) {
      resultBox.innerHTML = `<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800">
        Gagal memverifikasi: ${SandboxUtil.esc(err.message)}</div>`;
    }
  }

  function kv(label, value, cls = '') {
    return `<div>
      <span class="text-slate-500 block">${label}:</span>
      <strong class="${cls || 'text-slate-800'}">${SandboxUtil.esc(value)}</strong>
    </div>`;
  }

  // ---------------------------------------------------------
  // Step 2: clinical encounter
  // ---------------------------------------------------------
  function runStep2() {
    const diagSelect = document.getElementById('sim-diag-select');
    const complaints = SandboxUtil.val('sim-complaints');
    const opt = diagSelect.options[diagSelect.selectedIndex];

    data.diagnosis = {
      id: diagSelect.value,
      code: opt.getAttribute('data-code'),
      name: opt.getAttribute('data-name')
    };
    data.complaints = complaints;

    SandboxUtil.setHTML('sim-step2-summary', `
      <div class="p-3 bg-sky-50 border border-sky-200 rounded-xl text-[11px] space-y-1">
        <p><strong>Diagnosa Primer:</strong> [${SandboxUtil.esc(data.diagnosis.code)}] ${SandboxUtil.esc(data.diagnosis.name)}</p>
        <p><strong>Anamnesa:</strong> ${SandboxUtil.esc(complaints || 'Pemeriksaan rutin rawat jalan')}</p>
        <p class="text-slate-500">Kode ICD-10 ini akan disematkan ke klaim. Di BPJS, kode ini juga
           dipakai untuk verifikasi kesesuaian diagnosis dengan tindakan (anti-fraud).</p>
      </div>`);

    setStep(3);
    SandboxUtil.toast('Catatan pemeriksaan tersimpan', 'success');
  }

  // ---------------------------------------------------------
  // Step 3: billing
  // ---------------------------------------------------------
  function runStep3() {
    const services = [];
    document.querySelectorAll('input[name="sim-service"]:checked').forEach(cb => {
      services.push({
        serviceId: Number(cb.value),
        name: cb.getAttribute('data-name'),
        price: Number(cb.getAttribute('data-price'))
      });
    });

    const items = [];
    document.querySelectorAll('input[name="sim-item"]:checked').forEach(cb => {
      items.push({
        itemId: Number(cb.value),
        name: cb.getAttribute('data-name'),
        price: Number(cb.getAttribute('data-price'))
      });
    });

    if (!services.length && !items.length) {
      SandboxUtil.toast('Pilih minimal satu tindakan atau obat', 'error');
      return;
    }

    data.services = services;
    data.items = items;

    const totalService = services.reduce((s, x) => s + x.price, 0);
    const totalItem = items.reduce((s, x) => s + x.price, 0);
    data.grandTotal = totalService + totalItem;

    SandboxUtil.setHTML('sim-step3-bill', `
      <div class="p-4 bg-slate-900 text-white rounded-xl space-y-2 font-mono text-[11px]">
        <div class="flex justify-between border-b border-slate-700 pb-2 text-slate-400 text-[10px]">
          <span>ITEM / TINDAKAN</span><span>BIAYA</span>
        </div>
        ${services.map(s => `<div class="flex justify-between text-purple-300">
          <span>[Tindakan] ${SandboxUtil.esc(s.name)}</span>
          <span>${SandboxUtil.money(s.price)}</span>
        </div>`).join('')}
        ${items.map(i => `<div class="flex justify-between text-emerald-300">
          <span>[Farmasi] ${SandboxUtil.esc(i.name)}</span>
          <span>${SandboxUtil.money(i.price)}</span>
        </div>`).join('')}
        <div class="flex justify-between border-t border-slate-700 pt-2 font-bold text-sm text-yellow-400">
          <span>TOTAL KLAIM</span><span>${SandboxUtil.money(data.grandTotal)}</span>
        </div>
      </div>`);

    setStep(4);
    renderStep4Overview();
    SandboxUtil.toast('Tagihan dihitung', 'success');
  }

  function renderStep4Overview() {
    const box = document.getElementById('sim-step4-overview');
    if (!box) return;

    const today = SandboxUtil.today();
    box.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-3 gap-2 text-[10.5px]">
        ${ovBox('Kode Klaim', data.claimCode, 'font-mono text-sky-700')}
        ${ovBox('Faskes', data.facility ? data.facility.name : '-')}
        ${ovBox('Pasien', `${data.patient ? data.patient.name : ''} (${data.patient ? data.patient.chfId : ''})`)}
        ${ovBox('Diagnosa', data.diagnosis ? `[${data.diagnosis.code}] ${data.diagnosis.name}` : '-')}
        ${ovBox('Tanggal Rawat', today)}
        ${ovBox('Nilai Diklaim', SandboxUtil.money(data.grandTotal || 0), 'text-emerald-700 font-bold')}
      </div>
      <div class="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[10.5px] text-slate-600">
        Klaim akan dikirim lewat mutation <code class="font-mono">createClaim</code> beserta
        <strong>${data.services.length} tindakan</strong> dan <strong>${data.items.length} obat</strong>
        dalam satu request. Status awal: <strong>2 Entered</strong>.
      </div>`;
  }

  function ovBox(label, value, cls = '') {
    return `<div class="p-2 bg-slate-50 border border-slate-200 rounded-lg">
      <span class="text-slate-500 block text-[9.5px] uppercase">${label}</span>
      <span class="font-semibold text-slate-800 ${cls}">${SandboxUtil.esc(value)}</span>
    </div>`;
  }

  // ---------------------------------------------------------
  // Step 4: submit claim
  // ---------------------------------------------------------
  async function runStep4() {
    const btn = document.getElementById('sim-btn-submit-claim');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full mr-2"></span> Mengirim klaim...`;
    }

    const today = SandboxUtil.today();

    const input = {
      clientMutationId: 'sim-claim-' + Date.now(),
      code: data.claimCode,
      insureeId: SandboxUtil.relayToId(data.patient ? data.patient.id : null),
      healthFacilityId: SandboxUtil.relayToId(data.facility ? data.facility.id : null),
      icdId: SandboxUtil.relayToId(data.diagnosis ? data.diagnosis.id : null),
      dateFrom: today,
      dateTo: today,
      dateClaimed: today,
      visitType: 'O',
      careType: 'O'
    };

    if (data.services.length) {
      input.services = data.services.map(s => ({
        serviceId: s.serviceId,
        status: 1,
        qtyProvided: 1,
        priceAsked: String(s.price)
      }));
    }
    if (data.items.length) {
      input.items = data.items.map(i => ({
        itemId: i.itemId,
        status: 1,
        qtyProvided: 1,
        priceAsked: String(i.price)
      }));
    }

    try {
      await OpenIMISApi.createClaim(input);
      data.claimStatus = 2;

      // openIMIS mutations are async — poll until the claim appears.
      await refetchClaim();

      SandboxUtil.toast(`Klaim ${data.claimCode} tersimpan (status 2 Entered)`, 'success', 5000);
      setStep(5);
      renderStep5();
    } catch (err) {
      console.error('createClaim failed', err);

      // openIMIS 26.04 cannot persist claim lines (upstream Python 3.11 bug).
      // Retry once without them so the simulation can still complete.
      const canRetryWithoutLines = err.upstreamBug === 'claim-lines-datetime-safe'
        && (data.services.length || data.items.length);

      if (canRetryWithoutLines) {
        try {
          const fallback = Object.assign({}, input);
          delete fallback.services;
          delete fallback.items;
          await OpenIMISApi.createClaim(fallback);
          data.claimStatus = 2;
          await refetchClaim();

          SandboxUtil.toast(
            `Klaim ${data.claimCode} dibuat TANPA rincian tindakan/obat — ` +
            `openIMIS 26.04 tidak bisa menyimpan rincian klaim (bug upstream).`,
            'warning', 9000
          );
          setStep(5);
          renderStep5();
          return;
        } catch (retryErr) {
          SandboxUtil.toast(`Gagal mengajukan klaim: ${retryErr.message}`, 'error', 8000);
          return;
        }
      }

      SandboxUtil.toast(`Gagal mengajukan klaim: ${err.message}`, 'error', 8000);
      const box = document.getElementById('sim-step4-overview');
      if (box) {
        box.insertAdjacentHTML('beforeend', `
          <div class="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-[10.5px] text-red-800">
            <strong>Gagal:</strong> ${SandboxUtil.esc(err.message)}
          </div>`);
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="send" class="w-4 h-4 mr-1.5 inline"></i> Kirim Klaim ke OpenIMIS`;
        SandboxUtil.refreshIcons();
      }
    }
  }

  /** Poll openIMIS until the simulated claim is readable. */
  async function refetchClaim() {
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const conn = await OpenIMISApi.getClaims(3, { code: data.claimCode });
        const list = SandboxUtil.nodes(conn);
        if (list.length) {
          data.claimUuid = list[0].uuid;
          data.claimStatus = list[0].status;
          data.claimDetail = list[0];
          return list[0];
        }
      } catch (e) { /* keep polling */ }
      await new Promise(r => setTimeout(r, 700));
    }
    return null;
  }

  // ---------------------------------------------------------
  // Step 5: real adjudication
  // ---------------------------------------------------------
  function renderStep5() {
    const box = document.getElementById('sim-step5-details');
    if (!box) return;

    box.innerHTML = `
      <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 bg-sky-600 text-white rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">4</div>
          <div>
            <h4 class="font-bold text-slate-800 text-[12px]">Klaim tersimpan - status 2 Entered</h4>
            <p class="text-[10.5px] text-slate-600">
              Klaim <code class="bg-white px-1.5 py-0.5 rounded border font-mono">${SandboxUtil.esc(data.claimCode)}</code>
              sudah masuk ke <code>tblClaim</code>. Sekarang jalankan adjudikasi sungguhan:
              verifikasi lalu proses.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10.5px]">
          <div class="p-2.5 bg-white rounded-lg border border-slate-200">
            <div class="text-[9.5px] text-slate-500 uppercase">Status saat ini</div>
            <div class="mt-1">${SandboxUtil.claimStatusBadge(data.claimStatus || 2)}</div>
          </div>
          <div class="p-2.5 bg-white rounded-lg border border-slate-200">
            <div class="text-[9.5px] text-slate-500 uppercase">Nilai diklaim</div>
            <div class="font-mono font-bold text-slate-800">${SandboxUtil.money(data.claimDetail ? data.claimDetail.claimed : 0)}</div>
          </div>
          <div class="p-2.5 bg-white rounded-lg border border-slate-200">
            <div class="text-[9.5px] text-slate-500 uppercase">UUID</div>
            <div class="font-mono text-[9.5px] text-slate-600 truncate">${SandboxUtil.esc(data.claimUuid || 'belum tersedia')}</div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
          <button id="sim-btn-verify" onclick="HospitalSimulation.runVerify()"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-[11px] font-bold shadow flex items-center gap-1.5">
            <i data-lucide="check-check" class="w-3.5 h-3.5"></i>
            <span>1. Verifikasi (submitClaims)</span>
          </button>
          <button id="sim-btn-adjudicate" onclick="HospitalSimulation.runAdjudicate()" disabled
            class="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[11px] font-bold shadow flex items-center gap-1.5">
            <i data-lucide="gavel" class="w-3.5 h-3.5"></i>
            <span>2. Proses &amp; Adjudikasi (processClaims)</span>
          </button>
          <button onclick="GraphQLHelp.previewLast('Mutation Adjudikasi Klaim')"
            class="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-emerald-300 rounded-lg text-[10.5px] font-mono">
            Lihat GraphQL
          </button>
        </div>

        <div id="sim-adjudication-result"></div>
      </div>`;

    SandboxUtil.refreshIcons();
  }

  async function runVerify() {
    if (!data.claimUuid) {
      SandboxUtil.toast('UUID klaim belum tersedia. Coba kirim ulang atau cek menu Klaim.', 'warning', 6000);
      return;
    }

    const btn = document.getElementById('sim-btn-verify');
    const original = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = 'Memverifikasi...'; }

    try {
      await OpenIMISApi.submitClaims([data.claimUuid]);

      // openIMIS returns no statistics — read the claim back for its status.
      const fresh = await refetchClaim();
      const newStatus = fresh ? Number(fresh.status) : 4;
      data.claimStatus = newStatus;

      SandboxUtil.setHTML('sim-adjudication-result', `
        <div class="p-3 ${newStatus === 4 ? 'bg-blue-50 border-blue-200' : (newStatus === 1 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200')} border rounded-lg text-[10.5px] space-y-1">
          <div class="font-bold text-slate-800">Hasil submitClaims</div>
          <div>Status baru: ${SandboxUtil.claimStatusBadge(newStatus)}</div>
          <div class="text-slate-600">openIMIS memverifikasi klaim terhadap polis, plafon, dan aturan produk.</div>
        </div>`);

      if (newStatus === 4) {
        const adj = document.getElementById('sim-btn-adjudicate');
        if (adj) adj.disabled = false;
        SandboxUtil.toast('Klaim lolos verifikasi (status 4 Checked)', 'success');
      } else if (newStatus === 1) {
        SandboxUtil.toast('Klaim ditolak pada tahap verifikasi (status 1 Rejected)', 'warning', 6000);
      } else {
        SandboxUtil.toast(`Status klaim sekarang ${newStatus}`, 'info', 5000);
      }
    } catch (err) {
      SandboxUtil.toast(`Verifikasi gagal: ${err.message}`, 'error', 7000);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = original; }
    }
  }

  async function runAdjudicate() {
    if (!data.claimUuid) return;

    const btn = document.getElementById('sim-btn-adjudicate');
    const original = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = 'Memproses...'; }

    try {
      await OpenIMISApi.processClaims([data.claimUuid]);

      // openIMIS returns no statistics — read the claim back for status + amounts.
      const final = await refetchClaim();
      const newStatus = final ? Number(final.status) : 8;
      data.claimStatus = newStatus;

      SandboxUtil.setHTML('sim-adjudication-result', `
        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-[10.5px] space-y-2">
          <div class="font-bold text-slate-800">Hasil processClaims</div>
          <div>Status baru: ${SandboxUtil.claimStatusBadge(newStatus)}</div>
          ${final ? `
            <div class="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200">
              <div><span class="text-slate-500 block text-[9.5px]">Ditagih</span>
                <span class="font-mono font-bold">${SandboxUtil.money(final.claimed)}</span></div>
              <div><span class="text-slate-500 block text-[9.5px]">Disetujui</span>
                <span class="font-mono font-bold text-emerald-700">${SandboxUtil.money(final.approved)}</span></div>
              <div><span class="text-slate-500 block text-[9.5px]">Valuasi</span>
                <span class="font-mono font-bold text-sky-700">${SandboxUtil.money(final.valuated)}</span></div>
            </div>` : ''}
        </div>

        <div class="mt-3 p-3 bg-white/80 rounded-lg text-[10.5px] text-slate-600 border border-slate-200 space-y-1">
          <p class="font-semibold text-slate-800">Yang baru saja terjadi:</p>
          <p>1. <code class="font-mono">submitClaims</code> memvalidasi klaim terhadap polis, plafon, dan aturan produk &rarr; status <strong>4 Checked</strong>.</p>
          <p>2. <code class="font-mono">processClaims</code> menjalankan adjudikasi: menghitung penggantian per item/tindakan &rarr; status <strong>8 Processed</strong> lalu <strong>16 Valuated</strong>.</p>
          <p>3. Nilai <code>approved</code> dan <code>valuated</code> di atas adalah hasil perhitungan openIMIS, bukan angka yang kita kirim.</p>
        </div>

        <div class="flex flex-wrap gap-2 pt-2">
          <button onclick="AppRouter.navigate('claims')"
            class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10.5px] font-bold flex items-center gap-1.5">
            <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
            Lihat di menu Klaim
          </button>
          <button onclick="HospitalSimulation.reset()"
            class="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[10.5px] font-semibold">
            Ulangi Simulasi
          </button>
        </div>`);

      SandboxUtil.refreshIcons();
      SandboxUtil.toast(`Adjudikasi selesai - status ${newStatus}`, 'success', 5000);
    } catch (err) {
      SandboxUtil.toast(`Proses gagal: ${err.message}`, 'error', 7000);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = original; }
    }
  }

  // ---------------------------------------------------------
  // Controls
  // ---------------------------------------------------------
  function setStep(step) {
    currentStep = step;
    updateStepUI();
    setTimeout(() => SandboxUtil.refreshIcons(), 50);
  }

  function reset() {
    currentStep = 1;
    data = {
      patient: null, facility: null, diagnosis: null,
      services: [], items: [], complaints: '',
      claimCode: 'CLM-' + Date.now().toString().slice(-8),
      claimUuid: null, claimStatus: null, claimDetail: null,
      claimResult: null
    };

    ['sim-step1-result', 'sim-step2-summary', 'sim-step3-bill', 'sim-step4-overview', 'sim-step5-details']
      .forEach(id => SandboxUtil.setHTML(id, ''));

    document.querySelectorAll('input[name="sim-service"], input[name="sim-item"]').forEach(cb => cb.checked = false);

    const nextBtn = document.getElementById('sim-btn-step1-next');
    if (nextBtn) nextBtn.disabled = true;

    updateStepUI();
    SandboxUtil.toast('Simulasi di-reset', 'info');
  }

  return {
    init, reset, setStep,
    runStep1, runStep2, runStep3, runStep4,
    runVerify, runAdjudicate,
    getStep: () => currentStep,
    getData: () => data
  };
})();

window.HospitalSimulation = HospitalSimulation;
