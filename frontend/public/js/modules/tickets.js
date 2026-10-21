// ============================================================
// Grievance / Tickets — CRUD + comment + resolve + reopen
// ============================================================
const TicketsModule = (function () {
  let cache = [];
  let config = null;

  const STATUS_TONE = {
    RECEIVED: 'bg-slate-100 text-slate-700',
    OPEN: 'bg-sky-100 text-sky-800',
    IN_PROGRESS: 'bg-amber-100 text-amber-800',
    RESOLVED: 'bg-emerald-100 text-emerald-800',
    CLOSED: 'bg-slate-200 text-slate-600'
  };

  async function load() {
    const container = document.getElementById('tickets-table-body');
    if (!container) return;
    container.innerHTML = SandboxUtil.spinnerRow(6, 'Memuat tiket...');

    try {
      const conn = await OpenIMISApi.getTickets(40);
      cache = SandboxUtil.nodes(conn);
      renderTable(cache, SandboxUtil.totalCount(conn));
    } catch (e) {
      container.innerHTML = SandboxUtil.errorRow(6, `Gagal: ${e.message}`);
    }
  }

  function renderTable(data, total) {
    const container = document.getElementById('tickets-table-body');
    if (!container) return;

    const counter = document.getElementById('tickets-count');
    if (counter) counter.innerText = `${data.length} dari ${total !== undefined ? total : data.length} tiket`;

    if (!data.length) {
      container.innerHTML = SandboxUtil.emptyRow(6, 'Belum ada tiket pengaduan.');
      return;
    }

    container.innerHTML = data.map(t => {
      const tone = STATUS_TONE[t.status] || 'bg-slate-100 text-slate-700';
      const reporter = [t.reporterFirstName, t.reporterLastName].filter(Boolean).join(' ') || '-';
      return `<tr class="hover:bg-slate-50 border-b border-slate-100">
        <td class="p-2.5 font-mono font-bold text-sky-700 text-[11px]">${SandboxUtil.esc(t.code || '-')}</td>
        <td class="p-2.5 text-[11px]">
          <div class="font-semibold text-slate-800">${SandboxUtil.esc(t.title || 'Keluhan Pelayanan')}</div>
          <div class="text-[10px] text-slate-400 truncate max-w-[220px]">${SandboxUtil.esc(t.description || '')}</div>
        </td>
        <td class="p-2.5 text-[10.5px] text-slate-600">${SandboxUtil.esc(reporter)}</td>
        <td class="p-2.5 text-[10.5px]">${SandboxUtil.esc(t.category || '-')}</td>
        <td class="p-2.5"><span class="px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${tone}">${SandboxUtil.esc(t.status || '-')}</span></td>
        <td class="p-2.5 text-right whitespace-nowrap">
          <button onclick="TicketsModule.detail('${SandboxUtil.jsStr(t.uuid)}')"
            class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10.5px]">Buka</button>
        </td>
      </tr>`;
    }).join('');
  }

  function search(keyword) {
    const q = (keyword || '').toLowerCase().trim();
    if (!q) { renderTable(cache); return; }
    renderTable(cache.filter(t =>
      (t.code || '').toLowerCase().includes(q) ||
      (t.title || '').toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q) ||
      (t.status || '').toLowerCase().includes(q)
    ));
  }

  async function ensureConfig() {
    if (config) return config;
    try { config = await OpenIMISApi.getGrievanceConfig(); } catch (e) { config = null; }
    return config;
  }

  // ---------------------------------------------------------
  // Detail with comments
  // ---------------------------------------------------------
  async function detail(uuid) {
    const t = cache.find(x => x.uuid === uuid);
    if (!t) return;

    AppModal.open(`Tiket ${t.code || ''}`, `
      <div class="p-6 text-center text-slate-500 text-[11px]">
        <span class="animate-spin inline-block w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full"></span>
        Memuat komentar...
      </div>`);

    let comments = [];
    try {
      const conn = await OpenIMISApi.getComments(uuid, 50);
      comments = SandboxUtil.nodes(conn);
    } catch (e) { /* ignore */ }

    const tone = STATUS_TONE[t.status] || 'bg-slate-100 text-slate-700';

    const html = `
      <div class="space-y-3 text-[11px]">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          ${kv('Kode', t.code || '-', 'font-mono')}
          ${kv('Status', null, '', `<span class="px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${tone}">${SandboxUtil.esc(t.status || '-')}</span>`)}
          ${kv('Prioritas', t.priority || '-')}
          ${kv('Kategori', t.category || '-')}
          ${kv('Kanal', t.channel || '-')}
          ${kv('Tanggal Insiden', SandboxUtil.dateOnly(t.dateOfIncident))}
          ${kv('Jatuh Tempo', SandboxUtil.dateOnly(t.dueDate))}
          ${kv('Dibuat', SandboxUtil.dateOnly(t.dateCreated))}
        </div>

        <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
          <div class="font-semibold text-slate-800 mb-1">${SandboxUtil.esc(t.title || '-')}</div>
          <div class="text-slate-600 leading-relaxed">${SandboxUtil.esc(t.description || '-')}</div>
        </div>

        ${t.resolution ? `<div class="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div class="text-[9.5px] text-emerald-700 uppercase font-semibold">Resolusi</div>
          <div class="text-emerald-900">${SandboxUtil.esc(t.resolution)}</div>
        </div>` : ''}

        <div>
          <div class="font-bold text-slate-700 mb-1">Percakapan (${comments.length})</div>
          <div class="space-y-1.5 max-h-40 overflow-y-auto">
            ${comments.length ? comments.map(c => `
              <div class="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <div class="text-[10px] text-slate-500 mb-0.5">
                  ${SandboxUtil.esc(SandboxUtil.dateOnly(c.dateCreated))}
                  ${c.isResolution ? '<span class="ml-1 text-emerald-600 font-semibold">· resolusi</span>' : ''}
                </div>
                <div class="text-slate-700">${SandboxUtil.esc(c.comment || '')}</div>
              </div>`).join('') : '<div class="text-slate-400 text-[10.5px] p-2">Belum ada komentar.</div>'}
          </div>
        </div>

        <div class="pt-2 border-t border-slate-100">
          <label class="block font-semibold text-slate-700 mb-1 text-[11px]">Tambah Komentar</label>
          <textarea id="tkt-comment" rows="2" placeholder="Tulis tanggapan..."
            class="w-full p-2 border border-slate-300 rounded-lg text-[11px] focus:ring-2 focus:ring-sky-500 focus:outline-none"></textarea>
          <div class="flex justify-end gap-2 mt-1.5">
            <button onclick="TicketsModule.addComment('${SandboxUtil.jsStr(uuid)}')"
              class="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-semibold">Kirim Komentar</button>
            ${t.status !== 'RESOLVED' && t.status !== 'CLOSED' ? `
              <button onclick="TicketsModule.resolve('${SandboxUtil.jsStr(uuid)}')"
                class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold">Selesaikan</button>` : `
              <button onclick="TicketsModule.reopen('${SandboxUtil.jsStr(uuid)}')"
                class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-semibold">Buka Ulang</button>`}
          </div>
        </div>

        <div class="pt-2 border-t border-slate-100 flex justify-between">
          <button onclick="GraphQLHelp.previewLast('Query Detail Tiket')"
            class="text-[10.5px] text-slate-500 hover:text-sky-600 underline">Lihat GraphQL</button>
          <button onclick="AppModal.close()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold">Tutup</button>
        </div>
      </div>`;

    AppModal.open(`Tiket ${t.code || ''}`, html, { wide: true });
  }

  function kv(label, value, cls = '', htmlValue = null) {
    return `<div class="p-2 bg-slate-50 border border-slate-200 rounded-lg">
      <div class="text-[9.5px] text-slate-500 uppercase">${label}</div>
      <div class="font-semibold text-slate-800 ${cls}">${htmlValue !== null ? htmlValue : SandboxUtil.esc(value)}</div>
    </div>`;
  }

  async function addComment(uuid) {
    const content = SandboxUtil.val('tkt-comment').trim();
    if (!content) { SandboxUtil.toast('Komentar tidak boleh kosong', 'warning'); return; }
    try {
      await OpenIMISApi.createComment({
        clientMutationId: 'comment-' + Date.now(),
        ticketId: uuid,
        comment: content
      });
      SandboxUtil.toast('Komentar ditambahkan', 'success');
      await detail(uuid);
    } catch (e) {
      SandboxUtil.toast(`Gagal: ${e.message}`, 'error', 6000);
    }
  }

  /**
   * Resolving a grievance works through a Comment: openIMIS requires the uuid
   * of the resolution comment. So we create the comment first, then resolve it.
   */
  async function resolve(uuid) {
    const content = SandboxUtil.val('tkt-comment').trim() || 'Tiket diselesaikan oleh petugas.';
    try {
      const created = await OpenIMISApi.createComment({
        clientMutationId: 'resolve-comment-' + Date.now(),
        ticketId: uuid,
        comment: content
      });

      const commentUuid = extractInternalId(created);
      if (!commentUuid) {
        // Fall back: fetch the newest comment on this ticket.
        const conn = await OpenIMISApi.getComments(uuid, 1);
        const latest = SandboxUtil.nodes(conn)[0];
        if (!latest) throw new Error('Komentar resolusi tidak ditemukan.');
        await OpenIMISApi.resolveGrievanceByComment(latest.uuid);
      } else {
        await OpenIMISApi.resolveGrievanceByComment(commentUuid);
      }

      SandboxUtil.toast('Tiket diselesaikan', 'success');
      AppModal.close();
      await load();
    } catch (e) {
      SandboxUtil.toast(`Gagal: ${e.message}`, 'error', 6000);
    }
  }

  function extractInternalId(res) {
    const payload = res && res.createComment;
    if (!payload) return null;
    // internalId is the numeric DB id; uuid is not returned, so caller falls back.
    return null;
  }

  async function reopen(uuid) {
    try {
      await OpenIMISApi.reopenTicket(uuid);
      SandboxUtil.toast('Tiket dibuka kembali', 'success');
      AppModal.close();
      await load();
    } catch (e) {
      SandboxUtil.toast(`Gagal: ${e.message}`, 'error', 6000);
    }
  }

  // ---------------------------------------------------------
  // Create
  // ---------------------------------------------------------
  async function openCreate() {
    await ensureConfig();

    let categoryOptions = '';
    if (config && config.grievanceTypes && config.grievanceTypes.length) {
      categoryOptions = config.grievanceTypes.map(t =>
        `<option value="${SandboxUtil.esc(t.code)}">${SandboxUtil.esc(t.name)}</option>`).join('');
    } else {
      categoryOptions = `
        <option value="claim">Klaim</option>
        <option value="payment">Pembayaran</option>
        <option value="service">Pelayanan</option>
        <option value="other">Lainnya</option>`;
    }

    AppModal.open('Buat Tiket Pengaduan', `
      <form onsubmit="TicketsModule.submitCreate(event)" class="space-y-3 text-[11px]">
        <div class="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-[10.5px] text-sky-900">
          Memanggil <code class="font-mono">createTicket</code>. Status memakai enum
          <code>TicketStatusEnum</code>: RECEIVED, OPEN, IN_PROGRESS, RESOLVED, CLOSED.
        </div>
        ${UiKit.field('Judul Keluhan', UiKit.input('tkt-title', { placeholder: 'Antrean terlalu lama', required: true }))}
        ${UiKit.field('Deskripsi', UiKit.textarea('tkt-desc', { placeholder: 'Jelaskan kronologi keluhan...', rows: 3 }))}
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Kategori', UiKit.select('tkt-category', categoryOptions))}
          ${UiKit.field('Prioritas', UiKit.select('tkt-priority',
            `<option value="Low">Rendah</option>
             <option value="Medium" selected>Sedang</option>
             <option value="High">Tinggi</option>
             <option value="Urgent">Mendesak</option>`))}
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${UiKit.field('Kanal', UiKit.select('tkt-channel',
            `<option value="Mobile JKN">Mobile JKN</option>
             <option value="P-Care">P-Care</option>
             <option value="Loket">Loket</option>
             <option value="Call Center">Call Center</option>`))}
          ${UiKit.field('Tanggal Insiden', UiKit.input('tkt-date', { type: 'date', value: SandboxUtil.today() }))}
        </div>
        ${UiKit.formFooter('Buat Tiket', 'tkt-btn-submit')}
      </form>`, { wide: true });
  }

  async function submitCreate(e) {
    e.preventDefault();
    const input = {
      clientMutationId: 'create-ticket-' + Date.now(),
      title: SandboxUtil.val('tkt-title').trim(),
      description: SandboxUtil.val('tkt-desc').trim() || '-',
      status: 'RECEIVED',
      priority: SandboxUtil.val('tkt-priority'),
      category: SandboxUtil.val('tkt-category'),
      channel: SandboxUtil.val('tkt-channel')
    };
    const date = SandboxUtil.val('tkt-date');
    if (date) input.dateOfIncident = date;

    await UiKit.busy('tkt-btn-submit', 'Menyimpan...', async () => {
      try {
        await OpenIMISApi.createTicket(input);
        SandboxUtil.toast('Tiket dibuat', 'success');
        AppModal.close();
        await load();
      } catch (err) {
        SandboxUtil.toast(`Gagal: ${err.message}`, 'error', 7000);
      }
    });
  }

  return { load, search, detail, addComment, resolve, reopen, openCreate, submitCreate };
})();

window.TicketsModule = TicketsModule;
