// ============================================================
// GraphQL Help & Operation Preview
// ------------------------------------------------------------
// 1. `GraphQLHelp.open(tab)`  -> full teaching modal about GraphQL
// 2. `GraphQLHelp.preview(...)` -> "Lihat GraphQL" popup for any action
// 3. `GraphQLHelp.sendToPlayground(...)` -> prefill the Playground
// ============================================================
const GraphQLHelp = (function () {
  const TABS = [
    { key: 'concept', label: 'Konsep' },
    { key: 'anatomy', label: 'Anatomi Query' },
    { key: 'relay', label: 'Relay Connection' },
    { key: 'mutation', label: 'Mutation' },
    { key: 'auth', label: 'Autentikasi' },
    { key: 'errors', label: 'Error Handling' },
    { key: 'filters', label: 'Filter & Urutan' },
    { key: 'fhir', label: 'GraphQL vs FHIR' }
  ];

  let activeTab = 'concept';

  // ---------------------------------------------------------
  // Code block renderer
  // ---------------------------------------------------------
  function code(text, lang = 'graphql') {
    return `<pre class="p-3 bg-slate-900 text-emerald-300 rounded-lg overflow-x-auto text-[11px] leading-relaxed font-mono whitespace-pre">${SandboxUtil.esc(text)}</pre>
      <div class="text-[10px] text-slate-400 mt-1 font-mono">${SandboxUtil.esc(lang)}</div>`;
  }

  function callout(text, tone = 'sky') {
    const tones = {
      sky: 'bg-sky-50 border-sky-200 text-sky-900',
      amber: 'bg-amber-50 border-amber-200 text-amber-900',
      emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      rose: 'bg-rose-50 border-rose-200 text-rose-900'
    };
    return `<div class="p-3 rounded-lg border ${tones[tone] || tones.sky} text-[11px] leading-relaxed">${text}</div>`;
  }

  function h(text) {
    return `<h4 class="font-bold text-slate-800 text-xs mt-1">${text}</h4>`;
  }

  function p(text) {
    return `<p class="text-slate-600 text-[11px] leading-relaxed">${text}</p>`;
  }

  // ---------------------------------------------------------
  // Tab contents
  // ---------------------------------------------------------
  const CONTENT = {
    concept: () => `
      ${h('GraphQL dalam satu paragraf')}
      ${p('GraphQL adalah bahasa query untuk API. Berbeda dengan REST yang punya banyak URL (<code>/patient</code>, <code>/claim</code>, <code>/policy</code>), GraphQL hanya punya <strong>satu endpoint</strong> — di openIMIS: <code>POST /api/graphql</code> — dan klien yang menentukan bentuk responsnya.')}

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div class="text-[10px] font-bold text-slate-500 uppercase mb-1">REST</div>
          ${code(`GET /api/insuree/123
GET /api/insuree/123/policies
GET /api/insuree/123/claims

-> 3 request, 3 bentuk respons
   (sering kebanyakan / kurang field)`, 'http')}
        </div>
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div class="text-[10px] font-bold text-slate-500 uppercase mb-1">GraphQL</div>
          ${code(`POST /api/graphql

{
  insurees(first: 1) {
    edges { node {
      chfId
      family { address }
      policies { productName }
    } }
  }
}

-> 1 request, hanya field yang diminta`, 'graphql')}
        </div>
      </div>

      ${callout(`<strong>Kunci:</strong> satu endpoint, banyak operasi. Klien mengirim dokumen GraphQL berisi <em>field</em> yang diinginkan, server menjawab dengan JSON yang bentuknya persis mengikuti dokumen itu.`, 'sky')}

      ${h('Dua jenis operasi')}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div class="font-bold text-emerald-900 text-[11px] mb-1">query — membaca</div>
          <p class="text-[11px] text-emerald-800">Tidak mengubah data. Aman diulang. Contoh: <code>insurees</code>, <code>claims</code>, <code>policies</code>.</p>
        </div>
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div class="font-bold text-amber-900 text-[11px] mb-1">mutation — menulis</div>
          <p class="text-[11px] text-amber-800">Mengubah data & tercatat di <code>MutationLog</code>. Contoh: <code>createInsuree</code>, <code>processClaims</code>.</p>
        </div>
      </div>

      ${h('Skema adalah kontrak')}
      ${p('Server GraphQL mempublikasikan skemanya. Kamu bisa memintanya sendiri dengan introspection, dan itulah yang dipakai tombol <strong>Schema Browser</strong> di Playground:')}
      ${code(`{
  __schema {
    queryType { name }
    types { name kind fields { name } }
  }
}`, 'graphql')}
    `,

    anatomy: () => `
      ${h('Membedah satu query')}
      ${code(`query DaftarPeserta($first: Int, $status: String) {   <-- 1. operation + nama + deklarasi variabel
  peserta: insurees(first: $first, status: $status) {          <-- 2. alias + field + argumen
    totalCount                                                  <-- 3. field skalar
    edges {                                                     <-- 4. field objek
      node {                                                    <-- 5. selection set
        chfId
        nama: otherNames                                        <-- 6. alias pada field
        gender { code }                                         <-- 7. sub-selection
      }
    }
  }
}`, 'graphql')}

      <div class="mt-2 space-y-1.5 text-[11px] text-slate-600">
        <div><strong>1. Operation</strong> — <code>query</code> atau <code>mutation</code>, boleh diberi nama. Nama berguna untuk debugging & logging.</div>
        <div><strong>2. Field + argumen</strong> — <code>insurees</code> adalah field; <code>first</code> dan <code>status</code> adalah argumennya. Argumen di sini setara dengan query string di REST.</div>
        <div><strong>3. Field skalar</strong> — nilai tunggal: <code>String</code>, <code>Int</code>, <code>Boolean</code>, <code>Date</code>.</div>
        <div><strong>4. Field objek</strong> — nilainya objek lain, wajib punya selection set <code>{ ... }</code>.</div>
        <div><strong>5. Selection set</strong> — daftar field yang kamu minta. Hanya ini yang dikirim balik.</div>
        <div><strong>6. Alias</strong> — <code>nama: otherNames</code> mengganti nama field di respons. Berguna untuk memanggil field yang sama dua kali dengan argumen berbeda.</div>
        <div><strong>7. Sub-selection</strong> — <code>gender { code }</code> menelusuri relasi.</div>
      </div>

      ${h('Variabel: jangan menyisipkan nilai ke string query')}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div class="text-[10px] font-bold text-rose-600 mb-1">✗ Hindari (rawan injeksi & sulit di-cache)</div>
          ${code(`{
  insurees(chfId: "070707070") { edges { node { chfId } } }
}`, 'graphql')}
        </div>
        <div>
          <div class="text-[10px] font-bold text-emerald-600 mb-1">✓ Pakai variabel</div>
          ${code(`query Cari($chfId: String!) {
  insurees(chfId: $chfId) { edges { node { chfId } } }
}

// variables
{ "chfId": "070707070" }`, 'graphql')}
        </div>
      </div>

      ${h('Fragment: potongan field yang dipakai ulang')}
      ${code(`fragment PesertaRingkas on InsureeGQLType {
  chfId
  lastName
  otherNames
}

query {
  a: insurees(first: 5)  { edges { node { ...PesertaRingkas } } }
  b: insurees(first: 5, head: true) { edges { node { ...PesertaRingkas } } }
}`, 'graphql')}

      ${h('Directive')}
      ${code(`query ($withPhone: Boolean!) {
  insurees(first: 5) {
    edges { node {
      chfId
      phone @include(if: $withPhone)
    } }
  }
}`, 'graphql')}
      ${callout('Directive <code>@include</code> / <code>@skip</code> membuat satu query bisa dipakai untuk beberapa kebutuhan tanpa menulis dokumen baru.', 'emerald')}
    `,

    relay: () => `
      ${h('Kenapa hasilnya selalu edges { node { ... } } ?')}
      ${p('openIMIS memakai <strong>Relay Connection</strong> — spesifikasi paginasi berbasis cursor. Strukturnya selalu sama untuk semua daftar:')}
      ${code(`{
  insurees(first: 10, after: "YXJyYXljb25uZWN0aW9uOjk=") {
    totalCount          # total seluruh record (bukan hanya halaman ini)
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    edges {
      cursor            # penanda posisi record ini
      node { chfId lastName }
    }
  }
}`, 'graphql')}

      <div class="mt-2 space-y-1.5 text-[11px] text-slate-600">
        <div><strong>edges</strong> — "sisi" penghubung antara halaman dan objek. Berisi <code>cursor</code> + <code>node</code>.</div>
        <div><strong>node</strong> — objek sebenarnya (Insuree, Claim, Policy, ...).</div>
        <div><strong>cursor</strong> — string opaque penanda posisi. Jangan ditebak isinya, cukup diteruskan ke <code>after</code>.</div>
        <div><strong>totalCount</strong> — tambahan khas openIMIS (<code>ExtendedConnection</code>) untuk menghitung total baris.</div>
      </div>

      ${callout(`<strong>Paginasi:</strong> halaman 1 → <code>first: 10</code>. Halaman 2 → <code>first: 10, after: endCursor</code>. Ulangi selama <code>pageInfo.hasNextPage</code> bernilai <code>true</code>.`, 'sky')}

      ${h('Relay Global ID — jebakan paling sering di openIMIS')}
      ${p('Query mengembalikan <code>id</code> berupa string base64, sedangkan mutation meminta <strong>integer</strong>. Ini sumber error "invalid id" yang paling umum.')}
      ${code(`// Query mengembalikan:
"id": "VHlwZToxMjM="

// Decode base64 -> "Type:123"
atob("VHlwZToxMjM=")   // => "Type:123"

// Mutation meminta:
{ insureeId: 123 }     // integer, bukan "VHlwZToxMjM="`, 'javascript')}
      ${callout(`Di sandbox ini semua konversi ditangani <code>SandboxUtil.relayToId()</code>. Coba sendiri di Console: <code>SandboxUtil.relayToId("VHlwZToxMjM=")</code> → <code>123</code>.`, 'amber')}

      ${h('Kapan pakai query mana?')}
      <div class="overflow-x-auto">
        <table class="w-full text-[11px] border border-slate-200 rounded">
          <thead class="bg-slate-50 text-slate-600"><tr>
            <th class="p-2 text-left">Kebutuhan</th><th class="p-2 text-left">Field</th><th class="p-2 text-left">Catatan</th>
          </tr></thead>
          <tbody class="text-slate-600">
            <tr class="border-t border-slate-100"><td class="p-2">Daftar dengan paginasi</td><td class="p-2 font-mono">insurees</td><td class="p-2">Relay Connection</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2">Pencarian bebas</td><td class="p-2 font-mono">diagnosesStr</td><td class="p-2">varian <code>*Str</code></td></tr>
            <tr class="border-t border-slate-100"><td class="p-2">Satu record by id</td><td class="p-2 font-mono">claim(id:)</td><td class="p-2">bukan connection</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2">Data ringkas non-tabel</td><td class="p-2 font-mono">policyEligibilityByInsuree</td><td class="p-2">objek tunggal</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2">Referensi kecil</td><td class="p-2 font-mono">insureeGenders</td><td class="p-2">List biasa</td></tr>
          </tbody>
        </table>
      </div>
    `,

    mutation: () => `
      ${h('Pola mutation openIMIS')}
      ${p('Hampir semua mutation mengikuti pola yang sama: satu argumen <code>input</code> bertipe <code>*MutationInput!</code>, dan hasilnya berisi <code>clientMutationId</code> + <code>internalId</code>.')}
      ${code(`mutation NamaOperasi($input: CreateInsureeMutationInput!) {
  createInsuree(input: $input) {
    clientMutationId   # dikembalikan apa adanya, untuk mencocokkan request & response
    internalId         # id internal record yang baru dibuat
  }
}

// variables
{
  "input": {
    "clientMutationId": "insuree-1",
    "lastName": "Pratama",
    "otherNames": "Budi",
    "genderId": "M",
    "dob": "1995-05-15"
  }
}`, 'graphql')}

      ${h('Kenapa clientMutationId penting?')}
      ${p('openIMIS memproses mutation secara <strong>asinkron</strong>: request diterima, dicatat ke <code>MutationLog</code>, lalu dieksekusi. <code>clientMutationId</code> adalah kunci untuk menanyakan "apakah mutation saya sudah selesai?" — kamu bisa memakainya sebagai filter di query, misalnya <code>insurees(clientMutationId: "insuree-1")</code>.')}
      ${callout(`<strong>Praktik baik:</strong> selalu isi <code>clientMutationId</code> dengan string unik (mis. <code>nama-op + timestamp</code>). Tanpa itu, sulit memastikan mutation mana yang berhasil ketika ada beberapa request paralel.`, 'amber')}

      ${h('Urutan field tidak penting, tapi kelengkapan iya')}
      ${p('Graphene (library GraphQL Django yang dipakai openIMIS) mengisi field yang <em>tidak dikirim</em> dengan <code>null</code> pada saat update. Karena itu, saat <code>updateInsuree</code> sebaiknya kirim ulang seluruh field wajib, bukan hanya yang berubah.')}
      ${code(`// ✗ Berisiko: field lain bisa ter-null-kan
{ uuid: "...", phone: "08123" }

// ✓ Aman: kirim ulang field wajib
{
  uuid: "...",
  lastName: "Pratama",
  otherNames: "Budi",
  genderId: "M",
  dob: "1995-05-15",
  phone: "08123"
}`, 'json')}

      ${h('Mutasi berantai: adjudikasi klaim')}
      ${p('Siklus hidup klaim di openIMIS terdiri dari beberapa mutation berurutan. Status berubah di setiap langkah:')}
      ${code(`createClaim      -> status 2  (Entered)
submitClaims     -> status 4  (Checked)   atau 1 (Rejected)
selectClaimsForReview  -> tandai untuk review manual
saveClaimReview        -> simpan keputusan reviewer
processClaims    -> status 8  (Processed) -> 16 (Valuated)`, 'text')}
      ${callout('Setiap mutation mengembalikan statistik (<code>submitted</code>, <code>checked</code>, <code>processed</code>, <code>valuated</code>, <code>rejected</code>). Gunakan angka itu untuk menampilkan hasil ke pengguna, jangan menebak.', 'emerald')}

      ${h('Mutation juga bisa "gagal dengan sukses"')}
      ${p('Perhatikan: HTTP tetap 200, <code>errors</code> mungkin kosong, tetapi <code>internalId</code> tidak ada dan ada pesan di <code>errors[].message</code>. Selalu periksa <code>errors</code> sebelum menganggap operasi berhasil.')}
    `,

    auth: () => `
      ${h('Alur autentikasi openIMIS')}
      ${code(`1. POST /api/graphql
   mutation { tokenAuth(username: "Admin", password: "admin123") { token refreshToken } }

2. Simpan token

3. Setiap request berikutnya:
   Authorization: Bearer <token>`, 'text')}

      ${h('Login')}
      ${code(`mutation Login($username: String!, $password: String!) {
  tokenAuth(username: $username, password: $password) {
    token
    refreshToken
    payload          # isi JWT yang sudah di-decode
    refreshExpiresIn # detik sampai refresh token kedaluwarsa
  }
}`, 'graphql')}

      ${h('Isi JWT')}
      ${p('JWT terdiri dari tiga bagian dipisah titik: <code>header.payload.signature</code>. Bagian <code>payload</code> bisa dibaca tanpa secret — jangan pernah menaruh data sensitif di sana.')}
      ${code(`eyJhbGciOiJIUzI1NiJ9  .  eyJ1c2VybmFtZSI6...  .  signature
      header                   payload                signature

// payload setelah di-decode:
{
  "username": "Admin",
  "exp": 1790000000,
  "origIat": 1789900000
}`, 'text')}

      ${h('Perpanjang sesi')}
      ${code(`mutation Refresh($refreshToken: String!) {
  refreshToken(refreshToken: $refreshToken) { token refreshToken }
}`, 'graphql')}

      ${h('Cek & cabut token')}
      ${code(`mutation Verify($token: String!) { verifyToken(token: $token) { payload } }
mutation Revoke($refreshToken: String!) { revokeToken(refreshToken: $refreshToken) { revoked } }`, 'graphql')}

      ${callout(`<strong>Di sandbox ini:</strong> token disimpan di <code>localStorage</code> dan otomatis disisipkan oleh <code>OpenIMISApi</code>. Buka panel <strong>Inspeksi API</strong> di kanan atas untuk melihat token aktif dan menyalinnya.`, 'sky')}

      ${h('Izin (permission), bukan hanya autentikasi')}
      ${p('Banyak field dilindungi permission granular, misalnya <code>gql_query_claims_perms</code>. Bila token valid tetapi tidak punya hak, server menjawab:')}
      ${code(`{
  "errors": [{ "message": "unauthorized" }],
  "data": { "claims": null }
}`, 'json')}
      ${callout('Akun demo <code>Admin / admin123</code> memiliki hampir semua hak, sehingga cocok untuk eksplorasi. Bila memakai akun terbatas, sebagian query di API Catalog akan gagal — itu perilaku yang benar, bukan bug.', 'amber')}
    `,

    errors: () => `
      ${h('Tiga jenis kegagalan')}
      <div class="space-y-2">
        <div class="p-3 bg-rose-50 border border-rose-200 rounded-lg">
          <div class="font-bold text-rose-900 text-[11px]">1. Error transport</div>
          <p class="text-[11px] text-rose-800">Server tidak terjangkau, timeout, atau respons bukan JSON. Biasanya berarti OpenIMIS/Docker belum berjalan.</p>
        </div>
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div class="font-bold text-amber-900 text-[11px]">2. Error GraphQL</div>
          <p class="text-[11px] text-amber-800">HTTP 200 tetapi ada array <code>errors</code>. Bisa karena field salah, tipe salah, atau permission kurang.</p>
        </div>
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div class="font-bold text-slate-900 text-[11px]">3. Error aplikasi (di dalam mutation)</div>
          <p class="text-[11px] text-slate-700">Mutation selesai tanpa exception, tetapi mengembalikan daftar kesalahan validasi bisnis.</p>
        </div>
      </div>

      ${h('Bentuk error GraphQL')}
      ${code(`{
  "errors": [
    {
      "message": "unauthorized",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["claims"]
    }
  ],
  "data": { "claims": null }
}`, 'json')}
      ${callout('<strong>Penting:</strong> <code>data</code> bisa berisi sebagian hasil meskipun ada <code>errors</code>. Selalu periksa <code>errors</code> lebih dulu, lalu tetap gunakan <code>data</code> yang tidak null.', 'sky')}

      ${h('Error validasi mutation')}
      ${p('openIMIS mengembalikan pesan yang bisa diterjemahkan, sering dalam bentuk kunci i18n:')}
      ${code(`{
  "errors": [{
    "message": "insuree.mutation.failed_to_create_insuree",
    "detail": "Duplicate CHFID 070707070"
  }]
}`, 'json')}

      ${h('Kesalahan yang paling sering terjadi di praktik')}
      <div class="overflow-x-auto">
        <table class="w-full text-[11px] border border-slate-200 rounded">
          <thead class="bg-slate-50 text-slate-600"><tr>
            <th class="p-2 text-left">Gejala</th><th class="p-2 text-left">Penyebab</th><th class="p-2 text-left">Solusi</th>
          </tr></thead>
          <tbody class="text-slate-600">
            <tr class="border-t border-slate-100"><td class="p-2 font-mono">Cannot query field "x"</td><td class="p-2">Nama field salah / modul tidak terpasang</td><td class="p-2">Cek Schema Browser</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2 font-mono">unauthorized</td><td class="p-2">Token tidak ada / hak kurang</td><td class="p-2">Login ulang, cek permission</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2 font-mono">Field "x" of required type</td><td class="p-2">Variabel wajib tidak dikirim</td><td class="p-2">Lengkapi variables</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2 font-mono">invalid id / does not exist</td><td class="p-2">Mengirim Relay ID ke mutation</td><td class="p-2">Pakai <code>relayToId()</code></td></tr>
            <tr class="border-t border-slate-100"><td class="p-2 font-mono">Variable "$x" of type String used in position expecting Int</td><td class="p-2">Tipe variabel salah</td><td class="p-2">Perbaiki deklarasi tipe</td></tr>
          </tbody>
        </table>
      </div>
    `,

    filters: () => `
      ${h('Konvensi filter openIMIS')}
      ${p('openIMIS memakai <code>django-filter</code> yang diekspos ke GraphQL. Nama filter adalah <code>nama_field</code> + <code>_</code> + operator, dan GraphQL mengubahnya menjadi camelCase.')}

      ${code(`# Di Django filter_fields:
"chf_id": ["exact", "istartswith", "icontains"]

# Menjadi argumen GraphQL:
chfId              # exact   (operator default dihilangkan)
chfId_Istartswith  # prefix
chfId_Icontains    # mengandung (case-insensitive)`, 'text')}

      ${h('Operator yang tersedia')}
      <div class="overflow-x-auto">
        <table class="w-full text-[11px] border border-slate-200 rounded">
          <thead class="bg-slate-50 text-slate-600"><tr>
            <th class="p-2 text-left">Suffix</th><th class="p-2 text-left">Arti</th><th class="p-2 text-left">Contoh</th>
          </tr></thead>
          <tbody class="text-slate-600">
            <tr class="border-t border-slate-100"><td class="p-2 font-mono">(tanpa)</td><td class="p-2">sama dengan</td><td class="p-2 font-mono">status: 2</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2 font-mono">_Icontains</td><td class="p-2">mengandung, abaikan huruf besar/kecil</td><td class="p-2 font-mono">lastName_Icontains: "budi"</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2 font-mono">_Istartswith</td><td class="p-2">diawali</td><td class="p-2 font-mono">code_Istartswith: "CLM"</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2 font-mono">_Gte / _Lte</td><td class="p-2">≥ / ≤</td><td class="p-2 font-mono">dateClaimed_Gte: "2026-01-01"</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2 font-mono">_Gt / _Lt</td><td class="p-2">&gt; / &lt;</td><td class="p-2 font-mono">claimed_Gt: 0</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2 font-mono">_Isnull</td><td class="p-2">null atau tidak</td><td class="p-2 font-mono">phone_Isnull: true</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2 font-mono">_In</td><td class="p-2">salah satu dari daftar</td><td class="p-2 font-mono">status_In: [2, 4]</td></tr>
          </tbody>
        </table>
      </div>

      ${h('Filter pada relasi')}
      ${p('Relasi ditelusuri dengan <code>__</code> di Django, menjadi <code>_</code> di GraphQL:')}
      ${code(`{
  claims(first: 10, insuree_ChfId: "070707070") {
    edges { node { code status } }
  }
}

{
  claims(first: 10, healthFacility_Code: "RS001") {
    edges { node { code } }
  }
}`, 'graphql')}

      ${h('Urutan: orderBy')}
      ${code(`{
  claims(first: 20, orderBy: ["-dateClaimed", "code"]) {
    edges { node { code dateClaimed } }
  }
}

# "-dateClaimed" -> DESC
#  "code"        -> ASC`, 'graphql')}
      ${callout('Tanda minus di depan nama field berarti <em>descending</em>. Beberapa field memakai <code>order_by</code> (snake_case) alih-alih <code>orderBy</code> — perhatikan skemanya, mis. <code>policiesByInsuree(order_by:)</code>.', 'amber')}

      ${h('Hati-hati query tanpa first')}
      ${p('Tanpa <code>first</code>, server bisa mengembalikan seluruh tabel. Di dataset demo mungkin aman, tapi di produksi ini penyebab timeout paling umum. Selalu batasi.')}
      ${code(`# ✗ Berisiko
{ insurees { edges { node { chfId } } } }

# ✓ Batasi
{ insurees(first: 25) { edges { node { chfId } } } }`, 'graphql')}
    `,

    fhir: () => `
      ${h('Dua pintu masuk ke data yang sama')}
      ${p('openIMIS menyediakan dua API: <strong>GraphQL</strong> (native, lengkap, untuk aplikasi openIMIS sendiri) dan <strong>HL7 FHIR R4</strong> (standar internasional, untuk interoperabilitas dengan sistem lain seperti EMR/HIS/SatuSehat).')}

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="p-3 bg-sky-50 border border-sky-200 rounded-lg">
          <div class="font-bold text-sky-900 text-[11px] mb-1">GraphQL</div>
          <p class="text-[11px] text-sky-800 mb-1"><code>POST /api/graphql</code></p>
          <ul class="text-[11px] text-sky-800 list-disc pl-4 space-y-0.5">
            <li>Akses penuh ke semua modul</li>
            <li>Mutation untuk tulis data</li>
            <li>Bentuk respons bebas ditentukan klien</li>
            <li>Dipakai frontend openIMIS sendiri</li>
          </ul>
        </div>
        <div class="p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <div class="font-bold text-orange-900 text-[11px] mb-1">FHIR R4</div>
          <p class="text-[11px] text-orange-800 mb-1"><code>/api/api_fhir_r4/&lt;Resource&gt;/</code></p>
          <ul class="text-[11px] text-orange-800 list-disc pl-4 space-y-0.5">
            <li>Resource terstandar (Patient, Claim, Coverage...)</li>
            <li>Cocok untuk integrasi lintas organisasi</li>
            <li>Bentuk respons ditentukan standar</li>
            <li>Tidak semua modul terekspos</li>
          </ul>
        </div>
      </div>

      ${h('Padanan resource')}
      <div class="overflow-x-auto">
        <table class="w-full text-[11px] border border-slate-200 rounded">
          <thead class="bg-slate-50 text-slate-600"><tr>
            <th class="p-2 text-left">Konsep openIMIS</th><th class="p-2 text-left">FHIR Resource</th><th class="p-2 text-left">GraphQL</th>
          </tr></thead>
          <tbody class="text-slate-600">
            <tr class="border-t border-slate-100"><td class="p-2">Insuree</td><td class="p-2 font-mono">Patient</td><td class="p-2 font-mono">insurees</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2">Family</td><td class="p-2 font-mono">Group</td><td class="p-2 font-mono">families</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2">Policy</td><td class="p-2 font-mono">Coverage</td><td class="p-2 font-mono">policies</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2">Claim</td><td class="p-2 font-mono">Claim</td><td class="p-2 font-mono">claims</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2">Adjudikasi</td><td class="p-2 font-mono">ClaimResponse</td><td class="p-2 font-mono">processClaims</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2">HealthFacility</td><td class="p-2 font-mono">Organization</td><td class="p-2 font-mono">healthFacilities</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2">Location</td><td class="p-2 font-mono">Location</td><td class="p-2 font-mono">locations</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2">Product</td><td class="p-2 font-mono">InsurancePlan</td><td class="p-2 font-mono">products</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2">MedicalItem</td><td class="p-2 font-mono">Medication</td><td class="p-2 font-mono">medicalItems</td></tr>
            <tr class="border-t border-slate-100"><td class="p-2">MedicalService</td><td class="p-2 font-mono">ActivityDefinition</td><td class="p-2 font-mono">medicalServices</td></tr>
          </tbody>
        </table>
      </div>

      ${h('Contoh: peserta yang sama, dua cara')}
      ${code(`# GraphQL
{ insurees(first: 1, chfId: "070707070") {
    edges { node { chfId lastName otherNames dob } } } }

# FHIR R4
GET /api/api_fhir_r4/Patient/?identifier=070707070`, 'text')}

      ${h('CodeSystem & ValueSet')}
      ${p('FHIR juga mengekspos kamus referensi openIMIS sebagai <code>CodeSystem</code> dan <code>ValueSet</code>, sehingga sistem lain bisa menyelaraskan kode diagnosis, obat, tindakan, dan tipe identitas:')}
      ${code(`GET /api/api_fhir_r4/CodeSystem/diagnosis
GET /api/api_fhir_r4/CodeSystem/medical-item
GET /api/api_fhir_r4/CodeSystem/medical-service
GET /api/api_fhir_r4/ValueSet/items-pricelist
GET /api/api_fhir_r4/ValueSet/services-pricelist`, 'http')}

      ${callout(`<strong>Catatan penting:</strong> FHIR di openIMIS bersifat <em>read-oriented</em> untuk sebagian besar resource. Untuk menulis data (klaim, polis, peserta), gunakan GraphQL mutation.`, 'amber')}
    `
  };

  // ---------------------------------------------------------
  // Public modal
  // ---------------------------------------------------------
  function renderTabs() {
    return `<div class="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl mb-3">
      ${TABS.map(t => `<button onclick="GraphQLHelp.open('${t.key}')"
        class="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg ${t.key === activeTab
          ? 'bg-sky-600 text-white shadow-sm'
          : 'bg-white text-slate-600 hover:bg-slate-50'}">${t.label}</button>`).join('')}
    </div>`;
  }

  function open(tab = 'concept') {
    activeTab = tab;
    const body = (CONTENT[tab] || CONTENT.concept)();
    const html = `
      <div class="space-y-3">
        ${renderTabs()}
        <div class="space-y-2 max-h-[58vh] overflow-y-auto pr-1">${body}</div>
        <div class="pt-2 border-t border-slate-100 flex justify-between items-center">
          <span class="text-[10px] text-slate-400 font-mono">openIMIS 26.04 · GraphQL + FHIR R4</span>
          <div class="flex gap-2">
            <button onclick="GraphQLHelp.openPlayground()" class="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-semibold">
              Buka Playground →
            </button>
            <button onclick="AppModal.close()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold">
              Tutup
            </button>
          </div>
        </div>
      </div>
    `;
    window.AppModal.open('Cara Kerja GraphQL', html, { wide: true });
  }

  function openPlayground() {
    window.AppModal.close();
    window.AppRouter.navigate('api-explorer');
  }

  // ---------------------------------------------------------
  // "Lihat GraphQL" preview for any action
  // ---------------------------------------------------------
  /**
   * @param {object} opts
   *   title    {string}  e.g. "Cek Eligibilitas Peserta"
   *   endpoint {string}  default "/api/graphql"
   *   query    {string}  GraphQL document
   *   variables{object}  variables map
   *   response {object}  optional result to display
   *   notes    {string}  optional explanation
   */
  function preview(opts) {
    const { title, query, variables, response, notes, endpoint } = opts;
    const variablesJson = JSON.stringify(variables || {}, null, 2);
    const responseJson = response ? JSON.stringify(response, null, 2) : null;
    const id = 'gqlprev-' + Math.random().toString(36).slice(2, 8);

    const html = `
      <div class="space-y-3">
        <div class="p-2.5 bg-slate-900 rounded-lg flex items-center justify-between text-[11px] font-mono">
          <span class="text-emerald-400">POST ${SandboxUtil.esc(endpoint || '/api/graphql')}</span>
          <span class="text-slate-400">Authorization: Bearer ••••</span>
        </div>

        ${notes ? `<div class="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-[11px] text-sky-900 leading-relaxed">${notes}</div>` : ''}

        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-[11px] font-bold text-slate-700">GraphQL Operation</span>
            <button onclick="GraphQLHelp.copy('${id}-query')" class="text-[10px] text-sky-600 hover:underline">Salin</button>
          </div>
          <pre id="${id}-query" class="p-3 bg-slate-900 text-emerald-300 rounded-lg overflow-x-auto text-[10.5px] leading-relaxed font-mono whitespace-pre max-h-64">${SandboxUtil.esc(query.trim())}</pre>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-[11px] font-bold text-slate-700">Variables</span>
            <button onclick="GraphQLHelp.copy('${id}-vars')" class="text-[10px] text-sky-600 hover:underline">Salin</button>
          </div>
          <pre id="${id}-vars" class="p-3 bg-slate-950 text-sky-300 rounded-lg overflow-x-auto text-[10.5px] leading-relaxed font-mono whitespace-pre max-h-40">${SandboxUtil.esc(variablesJson)}</pre>
        </div>

        ${responseJson ? `
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-[11px] font-bold text-slate-700">Response</span>
            <button onclick="GraphQLHelp.copy('${id}-res')" class="text-[10px] text-sky-600 hover:underline">Salin</button>
          </div>
          <pre id="${id}-res" class="p-3 bg-slate-950 text-amber-200 rounded-lg overflow-auto text-[10.5px] leading-relaxed font-mono whitespace-pre max-h-56">${SandboxUtil.esc(responseJson)}</pre>
        </div>` : ''}

        <div class="pt-2 border-t border-slate-100 flex justify-between items-center gap-2">
          <button onclick="GraphQLHelp.open('concept')" class="text-[10px] text-slate-500 hover:text-sky-600 underline">Apa itu GraphQL?</button>
          <div class="flex gap-2">
            <button onclick="GraphQLHelp.copyRequest('${id}')" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold">
              Salin cURL
            </button>
            <button onclick="GraphQLHelp.sendToPlayground('${id}')" class="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-semibold">
              Buka di Playground →
            </button>
          </div>
        </div>
      </div>
    `;

    // Stash the payload so the buttons can read it back.
    previewStore[id] = { query: query.trim(), variables: variables || {} };
    window.AppModal.open(title || 'GraphQL Operation', html, { wide: true });
  }

  const previewStore = {};

  function copy(elementId) {
    const node = document.getElementById(elementId);
    if (!node) return;
    const text = node.innerText;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => SandboxUtil.toast('Disalin ke clipboard', 'success', 1800),
        () => SandboxUtil.toast('Gagal menyalin', 'error')
      );
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      SandboxUtil.toast('Disalin ke clipboard', 'success', 1800);
    }
  }

  function copyRequest(id) {
    const item = previewStore[id];
    if (!item) return;
    const body = JSON.stringify({ query: item.query, variables: item.variables });
    const curl = `curl -X POST "${window.location.origin}/api/graphql" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $OPENIMIS_TOKEN" \\
  -d '${body.replace(/'/g, "'\\''")}'`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(curl).then(
        () => SandboxUtil.toast('cURL disalin', 'success', 1800),
        () => SandboxUtil.toast('Gagal menyalin', 'error')
      );
    }
  }

  function sendToPlayground(id) {
    const item = previewStore[id];
    if (!item) return;
    window.AppModal.close();
    window.AppRouter.navigate('api-explorer');
    setTimeout(() => {
      if (window.ApiExplorerModule) {
        window.ApiExplorerModule.loadQuery(item.query, item.variables);
      }
    }, 120);
  }

  /** Convenience: build a preview straight from the last API operation. */
  function previewLast(title, notes) {
    const op = window.OpenIMISApi.getLastOperation();
    if (!op) {
      SandboxUtil.toast('Belum ada operasi API untuk ditampilkan.', 'warning');
      return;
    }
    if (op.kind === 'fhir') {
      const html = `
        <div class="space-y-3">
          <div class="p-2.5 bg-slate-900 rounded-lg text-[11px] font-mono">
            <span class="text-orange-400">${SandboxUtil.esc(op.method)}</span>
            <span class="text-slate-300"> /api/api_fhir_r4/${SandboxUtil.esc(op.path)}</span>
          </div>
          ${notes ? `<div class="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-[11px] text-sky-900">${notes}</div>` : ''}
          <pre class="p-3 bg-slate-950 text-emerald-300 rounded-lg text-[10.5px] font-mono whitespace-pre overflow-x-auto max-h-64">${SandboxUtil.esc(JSON.stringify(op.data || {}, null, 2))}</pre>
          <div class="pt-2 border-t border-slate-100 flex justify-end">
            <button onclick="GraphQLHelp.open('fhir')" class="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-[11px] font-semibold">GraphQL vs FHIR</button>
          </div>
        </div>`;
      window.AppModal.open(title || 'FHIR Request', html, { wide: true });
      return;
    }
    preview({ title, query: op.query, variables: op.variables, notes });
  }

  return { open, preview, previewLast, copy, copyRequest, sendToPlayground, openPlayground, TABS };
})();

window.GraphQLHelp = GraphQLHelp;
