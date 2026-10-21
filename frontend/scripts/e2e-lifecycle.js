// End-to-end test against the LIVE openIMIS: create a claim, verify it,
// adjudicate it, then clean up. Proves the whole lifecycle really works.
// Talks to openIMIS directly, so no sandbox server needs to be running.
const { openimisHost } = require('./_shared');

const HOST = openimisHost();

async function gql(query, variables, token) {
  const headers = { 'Content-Type': 'application/json', 'User-Agent': 'sandbox-client' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(HOST + '/api/graphql', {
    method: 'POST', headers, body: JSON.stringify({ query, variables })
  });
  return res.json();
}

const relay = r => parseInt(Buffer.from(r, 'base64').toString('utf8').split(':').pop(), 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function ok(label, extra = '') {
  console.log(`  \u001b[32mPASS\u001b[0m  ${label.padEnd(46)} ${extra}`);
}
function fail(label, msg) {
  console.log(`  \u001b[31mFAIL\u001b[0m  ${label.padEnd(46)} ${msg}`);
}

(async () => {
  console.log('');
  console.log('  End-to-end lifecycle test against live openIMIS');
  console.log('  ' + '-'.repeat(62));

  const login = await gql('mutation { tokenAuth(username: "Admin", password: "admin123") { token } }');
  const token = login.data.tokenAuth.token;

  // ---- resolve reference data ----
  const ins = await gql('query { insurees(first: 1) { edges { node { id chfId lastName } } } }', {}, token);
  const insuree = ins.data.insurees.edges[0].node;

  const hf = await gql('query { healthFacilities(first: 1) { edges { node { id code name } } } }', {}, token);
  const facility = hf.data.healthFacilities.edges[0].node;

  const dx = await gql('query { diagnoses(first: 1) { edges { node { id code name } } } }', {}, token);
  const diagnosis = dx.data.diagnoses.edges[0].node;

  const svc = await gql('query { medicalServices(first: 1) { edges { node { id code name price } } } }', {}, token);
  const service = svc.data.medicalServices.edges[0].node;

  console.log(`  context: insuree=${insuree.chfId} hf=${facility.code} icd=${diagnosis.code} svc=${service.code}`);
  console.log('');

  const code = 'E2E-' + Date.now().toString().slice(-8);
  const today = new Date().toISOString().slice(0, 10);

  // ---- 1. createClaim ----
  const create = await gql(`
    mutation Create($input: CreateClaimMutationInput!) {
      createClaim(input: $input) { clientMutationId internalId }
    }`, {
    input: {
      clientMutationId: 'e2e-' + Date.now(),
      code,
      insureeId: relay(insuree.id),
      healthFacilityId: relay(facility.id),
      icdId: relay(diagnosis.id),
      dateFrom: today,
      dateTo: today,
      dateClaimed: today,
      visitType: 'O',
      careType: 'O',
    }
  }, token);

  if (create.errors) { fail('createClaim', create.errors[0].message); process.exit(1); }
  ok('createClaim', `code=${code}`);

  // ---- 2. wait for the async mutation to land ----
  let claim = null;
  for (let i = 0; i < 12; i++) {
    const q = await gql(`query ($c: String) {
      claims(first: 1, code: $c) { edges { node { id uuid code status claimed } } }
    }`, { c: code }, token);
    claim = q.data?.claims?.edges?.[0]?.node;
    if (claim) break;
    await sleep(700);
  }
  if (!claim) { fail('claim visible', 'not found after 8s'); process.exit(1); }
  ok('claim visible', `status=${claim.status} claimed=${claim.claimed}`);

  if (Number(claim.status) !== 2) {
    fail('initial status', `expected 2 (Entered), got ${claim.status}`);
  } else {
    ok('initial status is 2 (Entered)');
  }

  // ---- 3. submitClaims ----
  // openIMIS 26.04 payload only exposes clientMutationId + internalId.
  const submit = await gql(`
    mutation Submit($input: SubmitClaimsMutationInput!) {
      submitClaims(input: $input) { clientMutationId internalId }
    }`, { input: { clientMutationId: 'e2e-sub-' + Date.now(), uuids: [claim.uuid] } }, token);

  if (submit.errors) { fail('submitClaims', submit.errors[0].message); }
  else { ok('submitClaims', `internalId=${submit.data.submitClaims.internalId}`); }

  // ---- 4. processClaims ----
  const proc = await gql(`
    mutation Process($input: ProcessClaimsMutationInput!) {
      processClaims(input: $input) { clientMutationId internalId }
    }`, { input: { clientMutationId: 'e2e-proc-' + Date.now(), uuids: [claim.uuid] } }, token);

  if (proc.errors) { fail('processClaims', proc.errors[0].message); }
  else { ok('processClaims', `internalId=${proc.data.processClaims.internalId}`); }

  // ---- 5. read final state ----
  await sleep(1200);
  const final = await gql(`query ($c: String) {
    claims(first: 1, code: $c) { edges { node { status claimed approved valuated } } }
  }`, { c: code }, token);
  const f = final.data?.claims?.edges?.[0]?.node;
  ok('final state', `status=${f.status} claimed=${f.claimed} approved=${f.approved} valuated=${f.valuated}`);

  // ---- 6. deleteClaims (cleanup) ----
  const del = await gql(`
    mutation Del($input: DeleteClaimsMutationInput!) {
      deleteClaims(input: $input) { clientMutationId }
    }`, { input: { clientMutationId: 'e2e-del-' + Date.now(), uuids: [claim.uuid] } }, token);

  if (del.errors) fail('deleteClaims', del.errors[0].message);
  else ok('deleteClaims (cleanup)');

  console.log('');
  console.log('  ' + '-'.repeat(62));
  console.log('  Lifecycle verified: create -> submit -> process -> delete');
  console.log('');
})();
