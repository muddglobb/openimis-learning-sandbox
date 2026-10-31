# OpenIMIS Hospital & Insurance Learning Sandbox

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

Sandbox pembelajaran interaktif di atas **openIMIS 26.04**. Menyediakan simulasi alur rumah sakit,
**Mobile JKN**, **P-Care (FKTP)**, GraphQL Playground lengkap dengan dokumentasi skema, katalog
seluruh API openIMIS, dan penjelajah **HL7 FHIR R4**.

Seluruh data berasal dari instance openIMIS milikmu sendiri — tidak ada data tiruan.

> ### Atribusi & Lisensi
>
> Proyek ini adalah **karya turunan** dari [openIMIS](https://openimis.org) —
> [openimis/openimis-dist_dkr](https://github.com/openimis/openimis-dist_dkr) —
> © openIMIS contributors, dilisensikan di bawah **GNU Affero General Public License v3.0**.
>
> Seluruh isi folder `frontend/` dibangun di atas dan mengikuti lisensi yang sama.
> Karena AGPL v3 bersifat *copyleft jaringan*, siapa pun yang menjalankan versi modifikasi
> dari perangkat lunak ini sebagai layanan jaringan wajib menyediakan source code-nya.
>
> Teks lisensi lengkap: [`LICENSE.md`](../LICENSE.md) dan
> [`GNU AFFERO GENERAL PUBLIC LICENSE.md`](../GNU%20AFFERO%20GENERAL%20PUBLIC%20LICENSE.md).

---

## Daftar Isi

1. [Fitur](#fitur)
2. [Prasyarat](#prasyarat)
3. [Menjalankan](#menjalankan)
4. [Struktur Proyek](#struktur-proyek)
5. [Cara Kerja GraphQL di Sandbox Ini](#cara-kerja-graphql-di-sandbox-ini)
6. [Mobile JKN](#mobile-jkn)
7. [P-Care](#p-care)
8. [Katalog API](#katalog-api)
9. [FHIR R4](#fhir-r4)
10. [Verifikasi](#verifikasi)
11. [Batasan](#batasan)

---

## Fitur

### Simulasi bisnis (memanggil API openIMIS sungguhan)

| Modul | Tahap | API yang dipakai |
|---|---|---|
| **Alur Rumah Sakit** | 5 tahap: admisi → diagnosa → billing → klaim → adjudikasi | `insurees`, `policyEligibilityByInsuree`, `diagnoses`, `medicalServices`, `medicalItems`, `createClaim`, `submitClaims`, `processClaims` |
| **Mobile JKN** | 8 tahap: login peserta → status → manfaat → iuran → FKTP → antrean → riwayat → aduan | `insurees`, `policyEligibilityByInsuree`, `policiesByInsuree`, `premiums`, `healthFacilities`, `updateInsuree`, `claims`, `createTicket` |
| **P-Care (FKTP)** | 9 tahap: login faskes → cari peserta → eligibilitas → kunjungan → tindakan → resep → rujukan → kirim klaim → ringkasan | `healthFacilities`, `insurees`, `checkEligibility`, `createClaim`, `updateClaim`, `submitClaims`, `processClaims` |

### Modul CRUD penuh

- **Pasien & Peserta** — daftar, cari, detail (polis + riwayat klaim), tambah, edit, hapus
- **Keluarga (KK)** — daftar, anggota, tambah, edit, hapus, jadikan kepala keluarga
- **Klaim & Adjudikasi** — daftar, filter status/tanggal/CHFID, detail (item + tindakan + riwayat), buat, verifikasi, proses, hapus
- **Produk & Polis** — CRUD produk, terbitkan polis, perpanjang, suspend
- **Katalog Medis** — diagnosa ICD-10, CRUD obat, CRUD tindakan
- **Pricelist** — daftar harga obat & tindakan
- **Faskes & Wilayah** — CRUD faskes, CRUD wilayah
- **Iuran & Premi** — daftar, catat, edit, hapus
- **Tiket & Aduan** — daftar, detail, komentar, selesaikan, buka ulang, buat

### Developer tools

- **GraphQL Playground v2** — editor query + editor variables + panel respons, template per modul, schema browser via introspection, query tersimpan, ekspor cURL, `Ctrl+Enter`
- **Katalog API** — 160 operasi GraphQL + 34 resource FHIR, filter per modul/tipe, tombol "Coba" langsung ke Playground
- **Pop-up "Cara Kerja GraphQL"** — 8 tab materi: konsep, anatomi query, Relay connection, mutation, autentikasi, error handling, filter & urutan, GraphQL vs FHIR
- **"Lihat GraphQL" di setiap aksi** — menampilkan dokumen GraphQL + variables + respons yang benar-benar dikirim, bisa disalin atau dibuka di Playground
- **API Inspector** — token JWT aktif + riwayat request/response real-time

---

## Prasyarat

1. **Docker Desktop** berjalan
2. **openIMIS** berjalan di `http://localhost`
3. **Node.js 18+**

---

## Menjalankan

### 1. Nyalakan openIMIS

```bash
cd openimis-dist_dkr
docker compose up -d
```

Tunggu sampai `http://localhost/api/graphql` merespons. Cek dengan:

```bash
curl -s -X POST http://localhost/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'
```

### 2. Nyalakan sandbox

```bash
cd frontend
npm install
npm start
```

Buka **http://localhost:3000**

Sandbox akan login otomatis dengan akun demo `Admin / admin123`.

### Variabel lingkungan

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `3000` | Port sandbox |
| `OPENIMIS_HOST` | `http://localhost` | Base URL openIMIS |
| `OPENIMIS_USER` | `Admin` | Akun untuk smoke test |
| `OPENIMIS_PASS` | `admin123` | Password untuk smoke test |

Contoh:

```bash
OPENIMIS_HOST=http://192.168.1.10 PORT=8080 npm start
```

---

## Struktur Proyek

```
frontend/
├── server.js                     Express: static + proxy GraphQL/FHIR + health
├── public/
│   ├── index.html                16 view
│   ├── css/styles.css
│   └── js/
│       ├── util.js               Helper: Relay ID, format, escape, badge status
│       ├── api.js                Klien API: 143 fungsi (semua modul openIMIS)
│       ├── api-catalog-data.js   Metadata 160 operasi + 34 resource FHIR
│       ├── graphql-help.js       Pop-up edukasi GraphQL + preview operasi
│       ├── app.js                Router, modal, toast, UiKit
│       └── modules/
│           ├── simulation.js     Alur RS 5 tahap
│           ├── mobile-jkn.js     Mobile JKN 8 tahap
│           ├── pcare.js          P-Care 9 tahap
│           ├── patients.js       CRUD peserta
│           ├── families.js       CRUD keluarga
│           ├── claims.js         Klaim + adjudikasi
│           ├── policies.js       Produk & polis
│           ├── medical.js        Katalog medis
│           ├── pricelist.js      Pricelist
│           ├── facilities.js     Faskes & wilayah
│           ├── finance.js        Premi
│           ├── tickets.js        Grievance
│           ├── fhir.js           FHIR explorer
│           ├── api-explorer.js   GraphQL Playground
│           └── api-catalog.js    Halaman katalog
└── scripts/
    ├── smoke-test.js             Uji semua operasi ke openIMIS hidup
    ├── ui-test.js                Uji render 16 tab (headless Chrome)
    ├── validate-graphql.js       Validasi sintaks semua dokumen GraphQL
    ├── schema-contract.js        Validasi field vs snapshot skema 26.04
    └── capture-queries.js        Rekam request nyata lewat mock openIMIS
```

---

## Cara Kerja GraphQL di Sandbox Ini

Buka tombol **"Cara Kerja GraphQL"** di header, atau tombol `?` di setiap halaman.

### Materi yang tersedia

| Tab | Isi |
|---|---|
| **Konsep** | GraphQL vs REST, satu endpoint, query vs mutation, skema sebagai kontrak |
| **Anatomi Query** | operation, field, argumen, selection set, alias, variabel, fragment, directive |
| **Relay Connection** | kenapa `edges { node { } }`, `pageInfo`, cursor, dan cara decode Relay ID |
| **Mutation** | pola `input: XxxMutationInput!`, `clientMutationId`, mutation asinkron, mutasi berantai |
| **Autentikasi** | `tokenAuth` → Bearer, isi JWT, refresh, permission granular |
| **Error Handling** | 3 jenis kegagalan, bentuk `errors[]`, kesalahan yang paling sering |
| **Filter & Urutan** | konvensi `_Icontains`, `_Gte`, `orderBy` dengan tanda minus |
| **GraphQL vs FHIR** | kapan pakai yang mana, tabel padanan resource |

### "Lihat GraphQL" di setiap aksi

Setiap operasi tulis/baca menampilkan pop-up berisi:

- endpoint + header (token di-mask)
- dokumen GraphQL lengkap
- blok `variables` JSON
- respons yang diterima
- tombol **Salin**, **Salin cURL**, **Buka di Playground**

Implementasinya: `OpenIMISApi` menyimpan `lastOperation`, lalu `GraphQLHelp.previewLast()`
membacanya kembali.

### Playground

- **Template per modul** — klik modul lalu pilih operasi
- **Schema browser** — `__schema` introspection, klik field untuk menyisipkan
- **Variables editor** — JSON terpisah dari query
- **Query tersimpan** — disimpan di `localStorage`
- **Ekspor cURL** — siap tempel di terminal
- **`Ctrl+Enter`** untuk menjalankan

---

## Mobile JKN

> **Disclaimer:** Mobile JKN adalah aplikasi BPJS Kesehatan. Sandbox ini **tidak** terhubung ke
> API BPJS. Mobile JKN diperankan sebagai aktor; setiap aksinya diterjemahkan ke GraphQL openIMIS.

### Peta konsep

```
PESERTA                 MOBILE JKN              OPENIMIS
----------------------  ----------------------  -----------------------------------
Login (No. Kartu/NIK)   -> Peserta/{noKartu}    -> insurees(chfId)
Status kepesertaan      -> Status Peserta       -> policyEligibilityByInsuree
Kelas & hak manfaat     -> Kelas I/II/III       -> Product.code + Policy.ceiling
Tagihan iuran           -> VA / Kode Billing    -> Premium (receipt, amount, payDate)
Ganti FKTP              -> Pindah Faskes        -> updateInsuree(healthFacilityId)
Antrean online          -> Antrean              -> (tidak ada di openIMIS)
Riwayat pelayanan       -> Riwayat Pelayanan    -> claims(insuree_ChfId)
Pengaduan               -> Pengaduan            -> createTicket
```

### Yang punya padanan vs tidak

| Punya padanan | Tidak ada di openIMIS |
|---|---|
| Identitas & data peserta | Antrean online |
| Status kepesertaan / eligibilitas | Virtual Account / kode billing |
| Hak manfaat & plafon | SEP & nomor rujukan VClaim |
| Riwayat pembayaran iuran | Kelas rawat sebagai field khusus |
| Penetapan FKTP | Integrasi SatuSehat |
| Riwayat pelayanan (klaim) | |
| Pengaduan | |

---

## P-Care

> **Disclaimer:** P-Care adalah aplikasi BPJS untuk FKTP. Sandbox ini **tidak** terhubung ke
> API P-Care. Nomor SEP dan nomor rujukan disimpan sebagai string di klaim, bukan diterbitkan VClaim.

### Tabel pemetaan field

| Konsep BPJS / P-Care | Field openIMIS | Catatan |
|---|---|---|
| No. Kartu Peserta | `Insuree.chfId` | 13 digit |
| NIK | `Insuree.passport` / `jsonExt` | Tidak ada field NIK native |
| PISA (1=Peserta, 2=Istri, 3=Suami, 4=Anak) | `Insuree.relationshipId` | via `relations` |
| Kelas Perawatan I/II/III | `Product.code` | Dipetakan ke produk |
| FKTP | `HealthFacility` (level `C`) | Puskesmas / klinik |
| FKRTL / RS Rujukan | `HealthFacility` (level `H`) | Rumah sakit |
| SEP | `Claim.guaranteeId` + `referralCode` | SEP bukan entitas tersendiri |
| Diagnosa ICD-10 | `Claim.icd` / `icd1..icd4` | Primer & sekunder |
| Tindakan | `ClaimService.service` | Harga dari pricelist |
| Obat | `ClaimItem.item` | Formularium nasional |
| Kunjungan | `Claim` (`visitType`, `careType`) | `O` = rawat jalan |
| Status Klaim | `Claim.status` | 1/2/4/8/16 |
| Nomor Rujukan | `Claim.referralCode` | String, bukan dari VClaim |

### Status klaim openIMIS

| Kode | Status | Arti |
|---|---|---|
| `1` | Rejected | Ditolak saat verifikasi |
| `2` | Entered | Baru dimasukkan faskes |
| `4` | Checked | Lolos verifikasi administratif |
| `8` | Processed | Sudah diadjudikasi |
| `16` | Valuated | Nilai penggantian final ditetapkan |

Alur: `createClaim` (2) → `submitClaims` (4 atau 1) → `processClaims` (8 → 16).

---

## Katalog API

Halaman **Katalog API** memuat 160 operasi GraphQL dari 24 modul openIMIS 26.04, ditandai:

- **dipakai UI** — punya halaman sendiri di sandbox
- **katalog** — bisa dijalankan dari Playground

Cakupan per modul:

| Modul | Query | Mutation |
|---|---|---|
| core | `user`, `users`, `role`, `roleRight`, `claimAdmins`, `enrolmentOfficers`, `mutationLogs`, `moduleConfigurations`, `modulesPermissions`, `languages`, `passwordPolicy` | `tokenAuth`, `refreshToken`, `verifyToken`, `revokeToken`, `changePassword`, `createUser`, `createRole` |
| insuree | `insurees`, `families`, `familyMembers`, `insureeGenders`, `relations`, `familyTypes`, `professions`, `educations`, `identificationTypes`, `insureeStatusReasons`, `canAddInsuree`, `insureeNumberValidity` | `createInsuree`, `updateInsuree`, `deleteInsurees`, `removeInsurees`, `createFamily`, `updateFamily`, `deleteFamilies`, `setFamilyHead`, `changeInsureeFamily` |
| policy | `policies`, `policiesByInsuree`, `policiesByFamily`, `policyEligibilityByInsuree`, `policyItemEligibilityByInsuree`, `policyServiceEligibilityByInsuree`, `policyValues` | `createPolicy`, `updatePolicy`, `renewPolicy`, `suspendPolicies`, `deletePolicies` |
| product | `products`, `product`, `validateProductCode` | `createProduct`, `updateProduct`, `duplicateProduct`, `deleteProduct` |
| medical | `diagnoses`, `diagnosesStr`, `medicalItems`, `medicalItemsStr`, `medicalServices`, `medicalServicesStr`, `validateItemCode`, `validateServiceCode` | `createItem`, `updateItem`, `deleteItem`, `createService`, `updateService`, `deleteService` |
| medical_pricelist | `itemsPricelists`, `servicesPricelists` | `createItemsPricelist`, `createServicesPricelist` |
| claim | `claims`, `claim`, `claimHistory`, `claimAttachments`, `claimAttachmentType`, `insureeNameByChfid`, `validateClaimCode` | `createClaim`, `updateClaim`, `submitClaims`, `selectClaimsForReview`, `saveClaimReview`, `processClaims`, `deleteClaims`, `createClaimAttachment` |
| location | `healthFacilities`, `locations`, `locationsAll`, `userDistricts`, `validateHealthFacilityCode`, `validateLocationCode` | `createHealthFacility`, `updateHealthFacility`, `deleteHealthFacility`, `createLocation`, `updateLocation`, `deleteLocation`, `moveLocation` |
| contribution | `premiums`, `premiumsByPolicies`, `validatePremiumCode` | `createPremium`, `updatePremium`, `deletePremium` |
| payer | `payer`, `funding` | `createPayer`, `addFunding` |
| contribution_plan | `contributionPlan`, `paymentPlan`, `contributionPlanBundle` | `createContributionPlan`, `createPaymentPlan`, `createContributionPlanBundle` |
| payment | `payments`, `paymentDetails` | `createPayment` |
| invoice | — | `generateInvoicesForTimePeriod`, `createBill`, `createPaymentInvoice` |
| contract | `validateContractCode` | `createContract`, `submitContract`, `approveContract` |
| policyholder | `validatePolicyHolderCode` | `createPolicyHolder`, `createPolicyHolderInsuree` |
| grievance | `tickets`, `ticketDetails`, `comments`, `grievanceConfig` | `createTicket`, `updateTicket`, `deleteTicket`, `createComment`, `resolveGrievanceByComment`, `reopenTicket` |
| tasks_management | — | `createTaskGroup`, `updateTask`, `resolveTask` |
| claim_batch | `batchRuns` | `processBatch` |
| individual / social_protection / payment_cycle / payroll | semua | semua |

---

## FHIR R4

Explorer menampilkan 34 resource, dikelompokkan:

- **Klinis & Kepesertaan** — `Patient`, `Group`, `CoverageEligibilityRequest`, `Coverage`, `Contract`
- **Klaim** — `Claim`, `ClaimResponse`, `Practitioner`, `PractitionerRole`, `Communication`, `CommunicationRequest`
- **Master Data** — `Organization`, `Location`, `InsurancePlan`, `Medication`, `ActivityDefinition`
- **Keuangan** — `Invoice`, `PaymentNotice`
- **CodeSystem & ValueSet** — 15 endpoint referensi

Fitur: GET by ID, search dengan query string, `_count`, salin JSON, salin cURL.

### Padanan GraphQL ↔ FHIR

| openIMIS | FHIR Resource | GraphQL |
|---|---|---|
| Insuree | `Patient` | `insurees` |
| Family | `Group` | `families` |
| Policy | `Coverage` | `policies` |
| Claim | `Claim` | `claims` |
| Adjudikasi | `ClaimResponse` | `processClaims` |
| HealthFacility | `Organization` | `healthFacilities` |
| Location | `Location` | `locations` |
| Product | `InsurancePlan` | `products` |
| MedicalItem | `Medication` | `medicalItems` |
| MedicalService | `ActivityDefinition` | `medicalServices` |

---

## Verifikasi

Enam rangkaian uji, dari yang paling murah ke paling menyeluruh.

```bash
# 1. Sintaks semua dokumen GraphQL (tanpa jaringan)
npm run verify:graphql

# 2. Kontrak field vs snapshot skema openIMIS 26.04 (tanpa jaringan)
npm run verify:schema

# 3. Render 16 tab di headless Chrome (butuh Chrome)
npm run verify:ui

# 4. Rekam request nyata lewat mock openIMIS (butuh Chrome)
npm run verify:capture

# 5. Siklus klaim penuh: create -> submit -> process -> delete
npm run verify:e2e

# 6. Uji ke openIMIS HIDUP — semua operasi (butuh Docker berjalan)
npm run verify
```

Semua sekaligus (kecuali #6):

```bash
npm run verify:all
```

Utilitas tambahan:

```bash
npm run schema:fetch      # unduh skema live ke schema-snapshot.json
npm run schema:inspect -- ItemGQLType   # tampilkan field sebuah tipe
npm run shots             # screenshot semua view
```

### Hasil nyata pada openIMIS 26.04

```
  Health check ... OK (graphql=true, fhir=true, 24ms)
  Login ... OK (JWT diterima)

  GraphQL operations
  ──────────────────────────────────────────────────────────────
  PASS  core/user
  PASS  insuree/insurees
  PASS  policy/policies
  PASS  claim/claims
  ...
  SKIP  policy/policyValues       openIMIS 26.04: returns policy=null
  SKIP  payer/funding             payer has no funding record

  FHIR R4 resources
  ──────────────────────────────────────────────────────────────
  PASS  fhir/Patient              Bundle total=63
  PASS  fhir/Medication           Bundle total=257
  PASS  fhir/ActivityDefinition   Bundle total=81
  ...
  SKIP  fhir/ValueSet/items-pricelist   openIMIS bug: ValueSet viewset

  PASS 70   SKIP 3   FAIL 0
```

`SKIP` berarti operasi butuh hak akses khusus, datanya tidak ada, atau terkena bug upstream
yang sudah didokumentasikan di bagian berikutnya — **bukan** kegagalan sandbox.

### Uji siklus klaim

```
  PASS  createClaim                code=E2E-39092356
  PASS  claim visible              status=2 claimed=0.00
  PASS  initial status is 2 (Entered)
  PASS  submitClaims               internalId=f3ca2390-...
  PASS  processClaims              internalId=387e8ec0-...
  PASS  final state                status=1
  PASS  deleteClaims (cleanup)

  Lifecycle verified: create -> submit -> process -> delete
```

Status akhir `1` (Rejected) memang wajar: klaim dibuat tanpa rincian tindakan/obat, sehingga
adjudikasi menolaknya. Lihat bug #1 di bawah untuk alasannya.

---

## Deteksi Anomali Klaim

Tab **Deteksi Anomali Klaim** mengambil klaim dari openIMIS (`claims`), mengirimkannya ke
`POST /api/anomaly/claims`, lalu skrip Python `ai/claim_anomaly.py` menandai klaim yang perlu dicek.

| Sinyal | Cara kerja |
|---|---|
| Tagihan di atas katalog | diklaim > 1,2 × jumlah (qty × harga katalog) item/tindakan |
| Dikoreksi penjamin | disetujui / diklaim < 0,8 (klaim berstatus 8/16) |
| Biaya outlier | robust z-score (median/MAD) biaya per diagnosa ICD > 5 |
| Lama rawat ekstrem | robust z-score lama rawat per diagnosa > 5 |
| Klaim ganda | peserta + diagnosa sama, tanggal mulai ≤ 7 hari |
| Pola aneh | IsolationForest dilatih per-batch pada klaim yang dikirim (min. 30 klaim) |

Prasyarat: Python 3.10+ dengan `pip install -r ai/requirements.txt`. Atur `PYTHON_BIN` bila
perintahnya bukan `python3`. Ambang ada di `RULES` pada `ai/claim_anomaly.py`.

Catatan: aturan "tagihan di atas katalog" hanya berlaku untuk klaim yang punya rincian
item/tindakan, sedangkan openIMIS 26.04 tidak dapat menyimpan klaim dengan rincian (lihat
bagian Bug). Pada klaim tanpa rincian, sinyal lain tetap berjalan. Ambang belum divalidasi
pada data klaim nyata.

---

## Batasan

1. **Tidak ada koneksi ke BPJS.** Mobile JKN, P-Care, VClaim, SEP, dan antrean hanya disimulasikan.
2. **Tidak ada koneksi ke SatuSehat.** FHIR di sini adalah FHIR milik openIMIS, bukan Kemenkes.
3. **Mutasi asinkron.** openIMIS memproses mutation lewat `MutationLog`, jadi record baru bisa
   butuh beberapa ratus milidetik untuk muncul. Sandbox melakukan polling singkat.
4. **Permission.** Beberapa query (`users`, `role`, `mutationLogs`) butuh hak khusus. Akun `Admin`
   demo biasanya punya, tapi bila tidak, operasi akan `SKIP` di smoke test.
5. **`individual` & `social_protection`** memakai model berbeda (bukan `tblInsuree`), jadi hanya
   masuk katalog tanpa UI.
6. **Relay ID.** Query mengembalikan `id` base64, mutation meminta integer. Sandbox menangani ini
   lewat `SandboxUtil.relayToId()`.

---

## Bug openIMIS 26.04 yang ditemukan saat pengujian

Semua temuan di bawah berasal dari pengujian terhadap instance openIMIS 26.04 yang berjalan
(`openimis-be-claim 1.11.0`, Django 4.2.30, Python 3.11). **Ini bukan bug sandbox** — sandbox
sudah menyesuaikan diri dan memberi pesan yang jelas.

### 1. Klaim tidak bisa disimpan dengan rincian tindakan/obat

```
super(type, obj): obj must be an instance or subtype of type
```

**Penyebab.** `claim/service.py` memformat tanggal lewat
`django.utils.datetime_safe.strftime()`, yang masih memakai idiom Python 2:

```python
# django/utils/datetime_safe.py
def strftime(dt, fmt):
    if dt.year >= 1000:
        return super(type(dt), dt).strftime(fmt)   # <- rusak di Python 3
```

Pola `super(type(dt), dt)` tidak valid di Python 3 dan selalu melempar `TypeError`.
Karena tanggal klaim selalu ≥ tahun 1000, cabang ini **selalu** dieksekusi begitu ada baris
rincian (`services`/`items`).

**Dampak.**
- `createClaim` **tanpa** `services`/`items` → berhasil.
- `createClaim` **dengan** `services`/`items` → gagal.
- `updateClaim` menambahkan rincian ke klaim yang sudah ada → gagal juga.

**Perilaku sandbox.** `createClaim`/`updateClaim` mendeteksi pola error ini dan mengembalikan
pesan yang bisa ditindaklanjuti (bukan stack-trace mentah). Simulasi RS otomatis mencoba ulang
tanpa rincian agar alur tetap bisa diselesaikan, dan menandainya dengan toast peringatan.

**Perbaikan (sisi openIMIS).** Ganti `super(type(dt), dt).strftime(fmt)` dengan `dt.strftime(fmt)`,
atau upgrade Django ke versi yang sudah membuang `datetime_safe`.

### 2. `policyValues` selalu mengembalikan `policy: null`

```
Cannot return null for non-nullable field PolicyGQLType.uuid
```

Diuji pada 10 keluarga × beberapa produk × `stage` `N`/`R` × 3 tanggal berbeda — semuanya `null`.
Sandbox menangkapnya dan mengembalikan `{ policy: null, knownIssue: ... }` alih-alih melempar.

### 3. `ValueSet/*` mengembalikan HTTP 500

```
{"resourceType":"OperationOutcome","issue":[{"details":{"text":"'function' object has no attribute 'model'"}}]}
```

Berlaku untuk `ValueSet/items-pricelist` dan `ValueSet/services-pricelist`. `CodeSystem/*` normal.
Smoke test menandainya `SKIP` dengan label "openIMIS bug: ValueSet viewset".

### 4. `payer(uuid:)` dan `funding(uuid:)` tidak menghormati argumen opsional

Skema mendeklarasikan `payer(uuid: UUID)` sebagai opsional, tetapi resolver-nya:

```
Query.resolve_payer() missing 1 required positional argument: 'uuid'
```

Artinya field ini **wajib** diberi UUID. Sandbox selalu menyuplai UUID yang diambil dari
`premiums.payer`.

### 5. `submitClaims` / `processClaims` tidak mengembalikan statistik

Skema hanya mengekspos `internalId` dan `clientMutationId` pada payload-nya — tidak ada
`submitted`/`checked`/`processed`/`valuated`/`rejected` seperti yang didokumentasikan di sebagian
panduan. Sandbox membaca ulang klaim untuk memperoleh status sebenarnya.

### 6. Ketidakcocokan nama field antara skema dan sumber

Beberapa field berbeda dari yang tertulis di `schema.py` modul:

| Dikira | Kenyataan |
|---|---|
| `RelationGQLType.relationship` | `relation` |
| `FamilyTypeGQLType.familyType` | `type` |
| `ConfirmationTypeGQLType.confirmationType` | `confirmationtype` (t huruf kecil) |
| `ProfessionGQLType.code` | tidak ada; hanya `id` + `profession` |
| `EducationGQLType.code` | tidak ada; hanya `id` + `education` |
| `IdentificationTypeGQLType.name` | `identificationType` |
| `GenderGQLType.id` | tidak ada; hanya `code` + `gender` |
| `TicketGQLType.uuid` | `id` (UUID) |
| `LocationGQLTypeConnection.totalCount` | tidak ada; hanya `pageInfo` + `edges` |
| `PolicyGQLType.ceiling` / `.deductible` | ada di `Product`, bukan `Policy` |
| `DiagnosisGQLType.uuid` | tidak ada |
| `ItemsPricelistGQLType.itemsPricelistDetails` | `details` (Relay connection) |
| `PricelistDetail.price` | `priceOverrule` |
| `TokenPayload.refreshToken` | tidak dikembalikan |

Semuanya sudah disesuaikan di `api.js`. Skrip `npm run verify:schema` menjaga agar tidak
kambuh — namun perlu dicatat bahwa skrip itu memakai snapshot statis, sehingga
`npm run verify` (ke server hidup) tetap menjadi sumber kebenaran.

---

## Lisensi

ISC — lihat `LICENSE.md` di root repositori.
