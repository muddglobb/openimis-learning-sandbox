// ============================================================
// HL7 FHIR R4 Explorer
// ============================================================
const FhirModule = (function () {
  let activeResource = 'Patient';
  let lastResponse = null;
  let activeGroup = 'clinical';

  const GROUPS = {
    clinical: {
      label: 'Klinis & Kepesertaan',
      resources: ['Patient', 'Group', 'CoverageEligibilityRequest', 'Coverage', 'Contract']
    },
    claim: {
      label: 'Klaim',
      resources: ['Claim', 'ClaimResponse', 'Practitioner', 'PractitionerRole', 'Communication', 'CommunicationRequest']
    },
    master: {
      label: 'Master Data',
      resources: ['Organization', 'Location', 'InsurancePlan', 'Medication', 'ActivityDefinition']
    },
    finance: {
      label: 'Keuangan',
      resources: ['Invoice', 'PaymentNotice']
    },
    codesystem: {
      label: 'CodeSystem & ValueSet',
      resources: [
        'CodeSystem/diagnosis',
        'CodeSystem/medical-item',
        'CodeSystem/medical-service',
        'CodeSystem/organization-hf-legal-form',
        'CodeSystem/organization-hf-level',
        'CodeSystem/patient-education-level',
        'CodeSystem/patient-profession',
        'CodeSystem/patient-identification-type',
        'CodeSystem/patient-contact-relationship',
        'CodeSystem/group-type',
        'CodeSystem/group-confirmation-type',
        'CodeSystem/organization-ph-legal-form',
        'CodeSystem/organization-ph-activity',
        'ValueSet/items-pricelist',
        'ValueSet/services-pricelist'
      ]
    }
  };

  function renderResourceButtons() {
    const box = document.getElementById('fhir-resource-buttons');
    if (!box) return;

    box.innerHTML = `
      <div class="flex flex-wrap gap-1 mb-2">
        ${Object.entries(GROUPS).map(([key, g]) => `
          <button onclick="FhirModule.selectGroup('${key}')"
            class="px-2.5 py-1 text-[10.5px] rounded-md font-semibold ${key === activeGroup
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
            ${SandboxUtil.esc(g.label)}
          </button>`).join('')}
      </div>
      <div class="flex flex-wrap gap-1">
        ${GROUPS[activeGroup].resources.map(r => `
          <button onclick="FhirModule.load('${SandboxUtil.jsStr(r)}')"
            class="px-2.5 py-1 text-[10.5px] font-mono rounded-md ${r === activeResource
              ? 'bg-sky-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
            ${SandboxUtil.esc(r)}
          </button>`).join('')}
      </div>`;
  }

  function selectGroup(key) {
    activeGroup = key;
    renderResourceButtons();
  }

  async function load(resource = 'Patient') {
    activeResource = resource;

    // keep the group in sync when jumping in from the catalog
    for (const [key, g] of Object.entries(GROUPS)) {
      if (g.resources.includes(resource)) { activeGroup = key; break; }
    }
    renderResourceButtons();

    const viewer = document.getElementById('fhir-json-viewer');
    const urlBox = document.getElementById('fhir-current-url');
    const meta = document.getElementById('fhir-meta');

    if (urlBox) urlBox.innerText = `GET /api/api_fhir_r4/${resource}/`;
    if (viewer) viewer.innerHTML = `<span class="text-slate-400">Mengambil resource FHIR ${SandboxUtil.esc(resource)}...</span>`;
    if (meta) meta.innerHTML = '';

    try {
      const res = await OpenIMISApi.fhir(`${resource}/`, 'GET', null, `FHIR R4 GET ${resource}`);
      lastResponse = res;

      if (viewer) {
        viewer.innerText = JSON.stringify(res, null, 2);
      }

      if (meta) {
        const rt = res.resourceType || (res.entry ? 'Bundle' : '-');
        const count = res.total !== undefined ? res.total
          : (Array.isArray(res.entry) ? res.entry.length : (res.entry ? 1 : 0));
        meta.innerHTML = `
          <span class="px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-300 text-[10px] font-mono">200 OK</span>
          <span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">resourceType: ${SandboxUtil.esc(rt)}</span>
          <span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">entries: ${count}</span>`;
      }
    } catch (err) {
      if (viewer) viewer.innerText = `Gagal memuat ${resource}:\n${err.message}`;
      if (meta) meta.innerHTML = `<span class="px-1.5 py-0.5 rounded bg-red-900/50 text-red-300 text-[10px] font-mono">ERROR</span>`;
    }
  }

  /** Fetch one resource by id. */
  async function loadById() {
    const id = SandboxUtil.val('fhir-id-input').trim();
    if (!id) { SandboxUtil.toast('Masukkan ID resource', 'warning'); return; }

    const viewer = document.getElementById('fhir-json-viewer');
    const urlBox = document.getElementById('fhir-current-url');
    const path = `${activeResource}/${id}`;

    if (urlBox) urlBox.innerText = `GET /api/api_fhir_r4/${path}`;
    if (viewer) viewer.innerHTML = `<span class="text-slate-400">Mengambil ${path}...</span>`;

    try {
      const res = await OpenIMISApi.fhir(path, 'GET', null, `FHIR R4 GET ${path}`);
      lastResponse = res;
      if (viewer) viewer.innerText = JSON.stringify(res, null, 2);
    } catch (err) {
      if (viewer) viewer.innerText = `Gagal:\n${err.message}`;
    }
  }

  /** Search with a query string appended. */
  async function search() {
    const qs = SandboxUtil.val('fhir-search-input').trim();
    const count = SandboxUtil.val('fhir-count-input') || '10';
    const path = `${activeResource}/?${qs ? qs + '&' : ''}_count=${count}`;

    const viewer = document.getElementById('fhir-json-viewer');
    const urlBox = document.getElementById('fhir-current-url');
    if (urlBox) urlBox.innerText = `GET /api/api_fhir_r4/${path}`;
    if (viewer) viewer.innerHTML = `<span class="text-slate-400">Mencari...</span>`;

    try {
      const res = await OpenIMISApi.fhir(path, 'GET', null, `FHIR R4 SEARCH ${activeResource}`);
      lastResponse = res;
      if (viewer) viewer.innerText = JSON.stringify(res, null, 2);
    } catch (err) {
      if (viewer) viewer.innerText = `Gagal:\n${err.message}`;
    }
  }

  function copyJson() {
    if (!lastResponse) { SandboxUtil.toast('Belum ada respons', 'warning'); return; }
    navigator.clipboard.writeText(JSON.stringify(lastResponse, null, 2));
    SandboxUtil.toast('JSON disalin', 'success');
  }

  function copyCurl() {
    const path = activeResource;
    const curl = `curl -X GET "${window.location.origin}/api/api_fhir_r4/${path}/" \\
  -H "Accept: application/fhir+json" \\
  -H "Authorization: Bearer $OPENIMIS_TOKEN"`;
    navigator.clipboard.writeText(curl);
    SandboxUtil.toast('cURL disalin', 'success');
  }

  return { load, selectGroup, loadById, search, copyJson, copyCurl, renderResourceButtons };
})();

window.FhirModule = FhirModule;
