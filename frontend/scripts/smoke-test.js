#!/usr/bin/env node
/**
 * Smoke test for the OpenIMIS sandbox API layer.
 *
 * Logs in with the demo admin account, then runs every read-only
 * operation declared in the static API catalog, plus a sample of
 * FHIR resources. Prints PASS / SKIP / FAIL per operation.
 *
 * Usage:
 *   npm run verify
 *   npm run verify -- --host http://localhost:3000
 *   npm run verify -- --filter claim
 *   npm run verify -- --fhir
 */

const DEFAULT_HOST = process.env.SANDBOX_HOST || 'http://localhost:3000';
const USER = process.env.OPENIMIS_USER || 'Admin';
const PASS = process.env.OPENIMIS_PASS || 'admin123';

const args = process.argv.slice(2);
function flag(name) { return args.includes(`--${name}`); }
function opt(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const HOST = opt('host', DEFAULT_HOST);
const FILTER = opt('filter', '').toLowerCase();
const ONLY_FHIR = flag('fhir');
const VERBOSE = flag('verbose');

// ------------------------------------------------------------
// Operations to exercise. Only read-only (query) operations are
// included so the smoke test never mutates the demo dataset.
// ------------------------------------------------------------
const QUERIES = [
  // core
  { module: 'core', name: 'user', query: `query { user { username } }` },
  { module: 'core', name: 'moduleConfigurations', query: `query { moduleConfigurations { module } }` },
  { module: 'core', name: 'languages', query: `query { languages { code name } }` },
  { module: 'core', name: 'passwordPolicy', query: `query { passwordPolicy }` },
  { module: 'core', name: 'users', query: `query { users(first: 1) { totalCount } }`, perm: true },
  { module: 'core', name: 'role', query: `query { role(first: 1) { totalCount } }`, perm: true },
  { module: 'core', name: 'roleRight', query: `query { roleRight { edges { node { id } } } }`, perm: true },
  { module: 'core', name: 'claimAdmins', query: `query { claimAdmins(first: 1) { edges { node { id } } } }`, perm: true },
  { module: 'core', name: 'enrolmentOfficers', query: `query { enrolmentOfficers(first: 1) { edges { node { id } } } }`, perm: true },
  { module: 'core', name: 'mutationLogs', query: `query { mutationLogs(first: 1) { totalCount } }`, perm: true },
  { module: 'core', name: 'modulesPermissions', query: `query { modulesPermissions { modulePermsList { moduleName } } }`, perm: true },

  // insuree
  { module: 'insuree', name: 'insurees', query: `query { insurees(first: 2) { totalCount edges { node { chfId lastName } } } }` },
  { module: 'insuree', name: 'families', query: `query { families(first: 2) { totalCount edges { node { uuid address } } } }` },
  { module: 'insuree', name: 'familyMembers', query: `query ($familyUuid: String!) { familyMembers(familyUuid: $familyUuid, first: 2) { totalCount } }`, needsFamily: true },
  { module: 'insuree', name: 'insureeGenders', query: `query { insureeGenders { code gender } }` },
  { module: 'insuree', name: 'relations', query: `query { relations { id relation sortOrder } }` },
  { module: 'insuree', name: 'familyTypes', query: `query { familyTypes { code type sortOrder } }` },
  { module: 'insuree', name: 'confirmationTypes', query: `query { confirmationTypes { code confirmationtype } }` },
  { module: 'insuree', name: 'professions', query: `query { professions { id profession } }` },
  { module: 'insuree', name: 'educations', query: `query { educations { id education } }` },
  { module: 'insuree', name: 'identificationTypes', query: `query { identificationTypes { code identificationType } }` },
  { module: 'insuree', name: 'insureeStatusReasons', query: `query { insureeStatusReasons(first: 2) { edges { node { id } } } }` },

  // policy
  { module: 'policy', name: 'policies', query: `query { policies(first: 2) { totalCount edges { node { uuid status } } } }` },
  { module: 'policy', name: 'policyValues', query: `query ($f: Int!, $d: DateTime!, $s: String!, $p: Int) { policyValues(familyId: $f, enrollDate: $d, stage: $s, productId: $p) { policy { uuid } } }`, needsPolicyValues: true, knownBroken: 'openIMIS 26.04: policyValues returns policy=null for every family/product pair' },

  // product
  { module: 'product', name: 'products', query: `query { products(first: 2) { totalCount edges { node { code name } } } }` },

  // medical
  { module: 'medical', name: 'diagnoses', query: `query { diagnoses(first: 2) { totalCount edges { node { code name } } } }` },
  { module: 'medical', name: 'diagnosesStr', query: `query { diagnosesStr(str: "a", first: 2) { totalCount } }` },
  { module: 'medical', name: 'medicalItems', query: `query { medicalItems(first: 2) { totalCount edges { node { code name } } } }` },
  { module: 'medical', name: 'medicalServices', query: `query { medicalServices(first: 2) { totalCount edges { node { code name } } } }` },
  { module: 'medical', name: 'medicalItemsStr', query: `query { medicalItemsStr(str: "a", first: 2) { totalCount } }` },
  { module: 'medical', name: 'medicalServicesStr', query: `query { medicalServicesStr(str: "a", first: 2) { totalCount } }` },

  // medical_pricelist
  { module: 'medical_pricelist', name: 'itemsPricelists', query: `query { itemsPricelists(first: 2) { totalCount } }` },
  { module: 'medical_pricelist', name: 'servicesPricelists', query: `query { servicesPricelists(first: 2) { totalCount } }` },

  // claim
  { module: 'claim', name: 'claims', query: `query { claims(first: 2) { totalCount edges { node { code status } } } }` },
  { module: 'claim', name: 'claimAttachmentType', query: `query { claimAttachmentType(first: 2) { totalCount } }` },

  // claim_batch
  { module: 'claim_batch', name: 'batchRuns', query: `query { batchRuns(first: 2) { totalCount } }`, perm: true },

  // location
  { module: 'location', name: 'healthFacilities', query: `query { healthFacilities(first: 2) { totalCount edges { node { code name level } } } }` },
  { module: 'location', name: 'locations', query: `query { locations(first: 2) { pageInfo { hasNextPage } edges { node { code name type } } } }` },
  { module: 'location', name: 'locationsAll', query: `query { locationsAll(first: 2) { edges { node { code name } } } }` },
  { module: 'location', name: 'userDistricts', query: `query { userDistricts { id } }` },

  // contribution
  { module: 'contribution', name: 'premiums', query: `query { premiums(first: 2) { totalCount edges { node { uuid amount } } } }` },

  // payer
  { module: 'payer', name: 'payer', query: `query ($uuid: UUID) { payer(uuid: $uuid) { uuid name type } }`, needsPayer: true },
  { module: 'payer', name: 'funding', query: `query ($uuid: UUID) { funding(uuid: $uuid) { uuid amount status } }`, needsFunding: true },

  // contribution_plan
  { module: 'contribution_plan', name: 'contributionPlan', query: `query { contributionPlan(first: 2) { totalCount } }`, perm: true },
  { module: 'contribution_plan', name: 'paymentPlan', query: `query { paymentPlan(first: 2) { totalCount } }`, perm: true },
  { module: 'contribution_plan', name: 'contributionPlanBundle', query: `query { contributionPlanBundle(first: 2) { totalCount } }`, perm: true },

  // payment
  { module: 'payment', name: 'payments', query: `query { payments(first: 2) { totalCount } }`, perm: true },

  // grievance
  { module: 'grievance_social_protection', name: 'tickets', query: `query { tickets(first: 2) { totalCount edges { node { id code status } } } }` },
  { module: 'grievance_social_protection', name: 'grievanceConfig', query: `query { grievanceConfig { grievanceTypes grievanceChannels } }` },

  // individual / social protection
  { module: 'individual', name: 'individual', query: `query { individual(first: 2) { totalCount } }`, perm: true },
  { module: 'individual', name: 'group', query: `query { group(first: 2) { totalCount } }`, perm: true },
  { module: 'social_protection', name: 'benefitPlan', query: `query { benefitPlan(first: 2) { totalCount } }`, perm: true },

  // payment_cycle / payroll
  { module: 'payment_cycle', name: 'paymentCycle', query: `query { paymentCycle(first: 2) { totalCount } }`, perm: true },
  { module: 'payroll', name: 'payroll', query: `query { payroll(first: 2) { totalCount } }`, perm: true },
  { module: 'payroll', name: 'paymentPoint', query: `query { paymentPoint(first: 2) { totalCount } }`, perm: true }
];

const FHIR_RESOURCES = [
  'Patient', 'Group', 'Coverage', 'Claim', 'ClaimResponse', 'Organization',
  'Location', 'InsurancePlan', 'Medication', 'ActivityDefinition',
  'Practitioner', 'Contract', 'Invoice', 'Subscription',
  'CodeSystem/diagnosis', 'CodeSystem/medical-item',
  'CodeSystem/patient-profession', 'ValueSet/items-pricelist'
];

// ------------------------------------------------------------
// Runner
// ------------------------------------------------------------
const results = { pass: 0, fail: 0, skip: 0 };
const failures = [];

function color(code, text) {
  const codes = { green: 32, red: 31, yellow: 33, gray: 90, cyan: 36, bold: 1 };
  return `\u001b[${codes[code] || 0}m${text}\u001b[0m`;
}

async function gql(query, variables, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${HOST}/api/graphql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) {
    throw new Error(`Respons bukan JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  return { status: res.status, json };
}

async function login() {
  const mutation = `
    mutation SmokeLogin($username: String!, $password: String!) {
      tokenAuth(username: $username, password: $password) { token }
    }`;
  const { json } = await gql(mutation, { username: USER, password: PASS });
  if (json.errors) throw new Error(json.errors.map(e => e.message).join(', '));
  return json.data.tokenAuth.token;
}

async function runQuery(op, token, ctx) {
  const label = `${op.module}/${op.name}`;
  if (FILTER && !label.toLowerCase().includes(FILTER) && !op.name.toLowerCase().includes(FILTER)) {
    return;
  }

  try {
    let vars = op.variables ? Object.assign({}, op.variables) : {};

    if (op.needsFamily) {
      if (!ctx.familyUuid) {
        results.skip++;
        console.log(`  ${color('yellow', 'SKIP')}  ${label.padEnd(42)} ${color('gray', 'no family in dataset')}`);
        return;
      }
      vars = { familyUuid: ctx.familyUuid, d: new Date().toISOString() };
    }

    if (op.needsPolicyValues) {
      if (!ctx.familyId || !ctx.productId) {
        results.skip++;
        console.log(`  ${color('yellow', 'SKIP')}  ${label.padEnd(42)} ${color('gray', 'no family/product pair')}`);
        return;
      }
      vars = { f: ctx.familyId, d: new Date().toISOString(), s: 'N', p: ctx.productId };
    }

    if (op.needsPayer) {
      if (!ctx.payerUuid) {
        results.skip++;
        console.log(`  ${color('yellow', 'SKIP')}  ${label.padEnd(42)} ${color('gray', 'no payer in dataset')}`);
        return;
      }
      vars = { uuid: ctx.payerUuid };
    }

    if (op.needsFunding) {
      if (!ctx.fundingUuid) {
        results.skip++;
        console.log(`  ${color('yellow', 'SKIP')}  ${label.padEnd(42)} ${color('gray', 'payer has no funding record')}`);
        return;
      }
      vars = { uuid: ctx.fundingUuid };
    }

    const { json } = await gql(op.query, vars, token);

    if (json.errors && json.errors.length) {
      const msg = json.errors.map(e => e.message).join(' | ');
      const isPerm = /unauthorized|permission|forbidden/i.test(msg);
      if (isPerm && op.perm) {
        results.skip++;
        console.log(`  ${color('yellow', 'SKIP')}  ${label.padEnd(42)} ${color('gray', msg)}`);
        return;
      }
      if (op.knownBroken) {
        results.skip++;
        console.log(`  ${color('yellow', 'SKIP')}  ${label.padEnd(42)} ${color('gray', op.knownBroken)}`);
        return;
      }
      results.fail++;
      failures.push({ label, msg });
      console.log(`  ${color('red', 'FAIL')}  ${label.padEnd(42)} ${color('gray', msg)}`);
      return;
    }

    results.pass++;
    const preview = VERBOSE ? color('gray', JSON.stringify(json.data).slice(0, 90)) : '';
    console.log(`  ${color('green', 'PASS')}  ${label.padEnd(42)} ${preview}`);
  } catch (err) {
    results.fail++;
    failures.push({ label, msg: err.message });
    console.log(`  ${color('red', 'FAIL')}  ${label.padEnd(42)} ${color('gray', err.message)}`);
  }
}

async function runFhir(resource, token) {
  const label = `fhir/${resource}`;
  if (FILTER && !label.toLowerCase().includes(FILTER)) return;

  try {
    const res = await fetch(`${HOST}/api/fhir/${resource}/?_count=2`, {
      headers: {
        Accept: 'application/fhir+json, application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    if (res.status === 401 || res.status === 403) {
      results.skip++;
      console.log(`  ${color('yellow', 'SKIP')}  ${label.padEnd(42)} ${color('gray', `HTTP ${res.status}`)}`);
      return;
    }
    if (!res.ok) {
      const body = await res.text();
      // Known upstream defect: ValueSet/* raises AttributeError in openIMIS 26.04.
      if (/ValueSet\//.test(resource) && /'function' object has no attribute 'model'/.test(body)) {
        results.skip++;
        console.log(`  ${color('yellow', 'SKIP')}  ${label.padEnd(42)} ${color('gray', 'openIMIS bug: ValueSet viewset')}`);
        return;
      }
      results.fail++;
      failures.push({ label, msg: `HTTP ${res.status}` });
      console.log(`  ${color('red', 'FAIL')}  ${label.padEnd(42)} ${color('gray', `HTTP ${res.status}`)}`);
      return;
    }

    const json = await res.json();
    results.pass++;
    const rt = json.resourceType || '?';
    const total = json.total !== undefined ? `total=${json.total}` : '';
    console.log(`  ${color('green', 'PASS')}  ${label.padEnd(42)} ${color('gray', `${rt} ${total}`)}`);
  } catch (err) {
    results.fail++;
    failures.push({ label, msg: err.message });
    console.log(`  ${color('red', 'FAIL')}  ${label.padEnd(42)} ${color('gray', err.message)}`);
  }
}

async function main() {
  console.log('');
  console.log(color('bold', '══════════════════════════════════════════════════════════════'));
  console.log(color('bold', '  OpenIMIS Sandbox — API Smoke Test'));
  console.log(color('bold', '══════════════════════════════════════════════════════════════'));
  console.log(`  Host     : ${HOST}`);
  console.log(`  Account  : ${USER}`);
  if (FILTER) console.log(`  Filter   : "${FILTER}"`);
  console.log('');

  // 1. health
  process.stdout.write('  Health check ... ');
  try {
    const res = await fetch(`${HOST}/api/health`);
    const json = await res.json();
    if (json.openimis === 'connected') {
      console.log(color('green', `OK (graphql=${json.graphql}, fhir=${json.fhir}, ${json.latencyMs}ms)`));
    } else {
      console.log(color('red', `OpenIMIS tidak terhubung: ${json.error || 'unknown'}`));
      console.log('');
      console.log(color('yellow', '  Pastikan Docker OpenIMIS berjalan:'));
      console.log(color('gray', '    cd openimis-dist_dkr && docker compose up -d'));
      console.log('');
      process.exit(1);
    }
  } catch (err) {
    console.log(color('red', `Sandbox tidak merespons: ${err.message}`));
    console.log(color('gray', '  Jalankan: cd frontend && npm start'));
    process.exit(1);
  }

  // 2. login
  process.stdout.write('  Login ... ');
  let token = null;
  try {
    token = await login();
    console.log(color('green', 'OK (JWT diterima)'));
  } catch (err) {
    console.log(color('red', `GAGAL: ${err.message}`));
    console.log(color('gray', '  Periksa kredensial di .env atau argumen --host'));
    process.exit(1);
  }
  // Resolve dataset anchors so scoped queries have something to bind to.
  const ctx = { familyId: null, familyUuid: null, payerUuid: null, fundingUuid: null, productId: null };

  try {
    const probe = await gql(
      `query { families(first: 1) { edges { node { id uuid } } } }`, {}, token
    );
    const node = probe.json?.data?.families?.edges?.[0]?.node;
    if (node) {
      const decoded = Buffer.from(node.id, 'base64').toString('utf8');
      ctx.familyId = parseInt(decoded.split(':').pop(), 10) || null;
      ctx.familyUuid = node.uuid;
    }
  } catch (e) { /* leave null */ }

  // A payer uuid is mandatory because Query.resolve_payer() ignores the
  // nullable `uuid` argument declared in the schema.
  try {
    const probe = await gql(
      `query { premiums(first: 10) { edges { node { payer { uuid } } } } }`, {}, token
    );
    const payer = probe.json?.data?.premiums?.edges
      ?.map(e => e.node.payer).filter(Boolean)[0];
    if (payer) ctx.payerUuid = payer.uuid;

    if (ctx.payerUuid) {
      const f = await gql(
        `query ($u: UUID) { payer(uuid: $u) { fundings { uuid } } }`,
        { u: ctx.payerUuid }, token
      );
      ctx.fundingUuid = f.json?.data?.payer?.fundings?.[0]?.uuid || null;
    }
  } catch (e) { /* leave null */ }

  // policyValues needs a product that actually has a policy.
  try {
    const probe = await gql(
      `query { policies(first: 1) { edges { node { product { id } } } } }`, {}, token
    );
    const prod = probe.json?.data?.policies?.edges?.[0]?.node?.product;
    if (prod && prod.id) {
      const decoded = Buffer.from(prod.id, 'base64').toString('utf8');
      ctx.productId = parseInt(decoded.split(':').pop(), 10) || null;
    }
  } catch (e) { /* leave null */ }

  console.log('');

  // 3. GraphQL operations
  if (!ONLY_FHIR) {
    console.log(color('cyan', '  GraphQL operations'));
    console.log(color('gray', '  ' + '─'.repeat(62)));
    for (const op of QUERIES) {
      await runQuery(op, token, ctx);
    }
    console.log('');
  }

  // 4. FHIR
  console.log(color('cyan', '  FHIR R4 resources'));
  console.log(color('gray', '  ' + '─'.repeat(62)));
  for (const r of FHIR_RESOURCES) {
    await runFhir(r, token);
  }
  console.log('');

  // 5. summary
  console.log(color('bold', '══════════════════════════════════════════════════════════════'));
  console.log(`  ${color('green', `PASS ${results.pass}`)}   ${color('yellow', `SKIP ${results.skip}`)}   ${color('red', `FAIL ${results.fail}`)}`);
  console.log(color('bold', '══════════════════════════════════════════════════════════════'));

  if (failures.length) {
    console.log('');
    console.log(color('red', '  Kegagalan:'));
    failures.forEach(f => console.log(`   • ${f.label} → ${f.msg}`));
  }

  if (results.skip > 0) {
    console.log('');
    console.log(color('gray', '  SKIP biasanya berarti operasi butuh hak akses khusus'));
    console.log(color('gray', '  atau modulnya tidak terpasang pada instalasi ini.'));
  }

  console.log('');
  process.exit(results.fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(color('red', `Fatal: ${err.message}`));
  process.exit(1);
});
