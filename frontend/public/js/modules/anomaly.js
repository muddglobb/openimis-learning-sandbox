// ============================================================
// Deteksi Anomali Klaim
//   openIMIS claims (GraphQL) -> /api/anomaly/claims (Python) -> tabel
// ============================================================
const AnomalyModule = (function () {
  const REASON_LABEL = {
    flag_tagihan: 'Tagihan > harga katalog',
    flag_koreksi: 'Dikoreksi penjamin',
    flag_biaya: 'Biaya outlier (ICD)',
    flag_lama: 'Lama rawat ekstrem',
    flag_duplikat: 'Klaim ganda',
    flag_model: 'Pola aneh (model)'
  };

  function init() {
    const body = document.getElementById('anomaly-table-body');
    if (body && !body.innerHTML.trim()) {
      body.innerHTML = SandboxUtil.emptyRow(7, 'Klik "Analisis Klaim" untuk memulai.');
    }
  }

  // openIMIS membatasi `first` maksimal 100 per permintaan, jadi diambil per halaman.
  const PAGE_SIZE = 100;
  const MAX_PAGES = 10; // maks. 1000 klaim

  const CLAIM_QUERY = `
    query AnomalyClaims($first: Int, $after: String) {
      claims(first: $first, after: $after, orderBy: ["-dateClaimed", "-code"]) {
        pageInfo { hasNextPage endCursor }
        edges { node {
          id uuid code status dateFrom dateTo claimed approved
          icd { code }
          insuree { chfId }
          healthFacility { code }
          items { qtyProvided priceAsked item { price } }
          services { qtyProvided priceAsked service { price } }
        } }
      }
    }`;

  async function fetchClaims() {
    const all = [];
    let after = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const data = await OpenIMISApi.graphql(
        CLAIM_QUERY, { first: PAGE_SIZE, after }, 'Klaim untuk Deteksi Anomali');
      const conn = data.claims;
      all.push(...SandboxUtil.nodes(conn));
      if (!conn.pageInfo || !conn.pageInfo.hasNextPage) break;
      after = conn.pageInfo.endCursor;
    }
    return all;
  }

  async function run() {
    const body = document.getElementById('anomaly-table-body');
    const summaryEl = document.getElementById('anomaly-summary');
    const btn = document.getElementById('anomaly-run');
    if (!body) return;

    btn.disabled = true;
    body.innerHTML = SandboxUtil.spinnerRow(7, 'Mengambil klaim dan menganalisis...');
    summaryEl.innerHTML = '';

    try {
      const claims = await fetchClaims();

      const res = await fetch('/api/anomaly/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claims })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analisis gagal');

      render(data);
    } catch (err) {
      body.innerHTML = SandboxUtil.errorRow(7, `Gagal: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }

  function render(data) {
    const body = document.getElementById('anomaly-table-body');
    const summaryEl = document.getElementById('anomaly-summary');
    const s = data.summary;

    const badges = Object.keys(s.byReason || {}).map(k =>
      `<span class="inline-block px-2 py-0.5 mr-1 mb-1 bg-slate-100 rounded-full text-[10px]">
         ${SandboxUtil.esc(REASON_LABEL[k] || k)}: <b>${s.byReason[k]}</b></span>`).join('');
    summaryEl.innerHTML = `
      <div class="mb-1"><b>${s.flagged}</b> dari <b>${s.total}</b> klaim perlu dicek.
        ${s.modelRan ? '' : '<span class="text-amber-700">Model tidak dijalankan (klaim &lt; 30), hanya aturan.</span>'}</div>
      <div>${badges}</div>`;

    const flagged = data.results.filter(r => r.perluReview);
    if (!flagged.length) {
      body.innerHTML = SandboxUtil.emptyRow(7, 'Tidak ada klaim yang ditandai.');
      return;
    }
    body.innerHTML = flagged.map(r => `
      <tr class="hover:bg-slate-50/80 border-b border-slate-100">
        <td class="p-2.5 font-mono font-bold text-sky-700 text-[11px]">${SandboxUtil.esc(r.code)}</td>
        <td class="p-2.5 text-[11px]">${SandboxUtil.esc(r.icd)}</td>
        <td class="p-2.5 text-right font-mono text-[10.5px]">${SandboxUtil.money(r.claimed)}</td>
        <td class="p-2.5 text-right font-mono text-[10.5px]">${r.approved > 0 ? SandboxUtil.money(r.approved) : '-'}</td>
        <td class="p-2.5 text-[11px]">${r.los === null ? '-' : r.los + ' hari'}</td>
        <td class="p-2.5 font-mono text-[10.5px]">${Number(r.skor).toFixed(3)}</td>
        <td class="p-2.5 text-[10px] text-red-700">${SandboxUtil.esc(r.alasan)}</td>
      </tr>`).join('');
  }

  return { init, run };
})();
window.AnomalyModule = AnomalyModule;