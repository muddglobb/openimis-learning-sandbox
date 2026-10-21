// Capture every GraphQL request the UI makes.
// Architecture:  Chrome -> sandbox server :4222 -> mock openIMIS :4111
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const { parse } = require('graphql');
const { requireChrome, PROJECT_ROOT } = require('./_shared');

const CHROME = requireChrome();
const CDP_PORT = 9455;
const MOCK_PORT = 4111;
const SANDBOX_PORT = 4222;

const FRONTEND = PROJECT_ROOT;

// --- mock openIMIS ------------------------------------------------------
const captured = [];

const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');

    if (req.url.startsWith('/api/graphql')) {
      let parsed = {};
      try { parsed = JSON.parse(body); } catch (e) { /* ignore */ }
      captured.push(parsed);

      const q = parsed.query || '';
      if (q.includes('tokenAuth')) {
        return res.end(JSON.stringify({ data: { tokenAuth: { token: 'mock.jwt', refreshToken: 'r', payload: {}, refreshExpiresIn: 3600 } } }));
      }
      if (/user\s*\{/.test(q)) {
        return res.end(JSON.stringify({ data: { user: { username: 'Admin', lastName: 'IMIS', otherNames: 'Admin' } } }));
      }
      if (q.includes('insurees')) {
        return res.end(JSON.stringify({ data: { insurees: {
          totalCount: 1,
          edges: [{ node: {
            id: 'VHlwZTox', uuid: 'u-1', chfId: '070707070', lastName: 'Doe', otherNames: 'John',
            dob: '1990-01-01', age: 36, head: true, phone: '0800', email: null,
            gender: { code: 'M' }, family: { id: 'VHlwZToy', uuid: 'f-1', address: 'Jl. A' },
            healthFacility: { id: 'VHlwZToz', code: 'RS001', name: 'RS A', level: 'H' },
            currentVillage: { name: 'Desa' }, relationship: null
          } }]
        } } }));
      }
      if (q.includes('healthFacilities')) {
        return res.end(JSON.stringify({ data: { healthFacilities: {
          totalCount: 1, edges: [{ node: { id: 'VHlwZToz', uuid: 'hf-1', code: 'RS001', name: 'RS A', level: 'H', careType: 'B', status: 'AC' } }]
        } } }));
      }
      if (q.includes('__schema')) {
        return res.end(JSON.stringify({ data: { __schema: { queryType: { name: 'Query' }, mutationType: { name: 'Mutation' }, types: [] } } }));
      }
      return res.end(JSON.stringify({ data: {} }));
    }

    if (req.url.startsWith('/api/api_fhir_r4')) {
      return res.end(JSON.stringify({ resourceType: 'Bundle', total: 0, entry: [] }));
    }

    res.setHeader('Content-Type', 'text/plain');
    res.end('ok');
  });
});

// --- helpers ------------------------------------------------------------
function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); }).on('error', reject);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  await new Promise(r => mock.listen(MOCK_PORT, r));
  console.log(`\n  Mock openIMIS   :${MOCK_PORT}`);

  // Start a sandbox instance pointed at the mock.
  const sandbox = spawn(process.execPath, ['server.js'], {
    cwd: FRONTEND,
    env: Object.assign({}, process.env, {
      PORT: String(SANDBOX_PORT),
      OPENIMIS_HOST: `http://127.0.0.1:${MOCK_PORT}`
    }),
    stdio: 'ignore'
  });
  await sleep(2000);
  console.log(`  Sandbox server  :${SANDBOX_PORT}`);

  // Verify the sandbox is up before driving the browser.
  for (let i = 0; i < 15; i++) {
    try { await get(`http://127.0.0.1:${SANDBOX_PORT}/`); break; }
    catch (e) { await sleep(400); }
  }

  const profile = path.join(process.env.TEMP || '.', 'cdp-cap-' + Date.now());
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: 'ignore' });

  await sleep(2500);
  let targets;
  for (let i = 0; i < 20; i++) {
    try {
      targets = JSON.parse(await get(`http://127.0.0.1:${CDP_PORT}/json/list`));
      if (targets.some(t => t.type === 'page')) break;
    } catch (e) { /* retry */ }
    await sleep(500);
  }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise(resolve => {
    const mid = ++id; pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result?.result?.value;
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${SANDBOX_PORT}/` });
  await sleep(6000);

  console.log(`  Auto-login      : ${captured.some(c => (c.query || '').includes('tokenAuth')) ? 'captured' : 'MISSING'}`);
  console.log('');

  const drivers = [
    ['simulation', `HospitalSimulation.init()`],
    ['mobile-jkn', `MobileJknSimulator.init()`],
    ['pcare', `PcareSimulator.init()`],
    ['patients', `PatientsModule.load()`],
    ['families', `FamiliesModule.load()`],
    ['medical', `MedicalModule.load('diagnoses')`],
    ['pricelist', `PricelistModule.load()`],
    ['facilities', `FacilitiesModule.load()`],
    ['claims', `ClaimsModule.load()`],
    ['policies', `PoliciesModule.load()`],
    ['finance', `FinanceModule.load()`],
    ['tickets', `TicketsModule.load()`],
    ['fhir', `FhirModule.load('Patient')`],
    ['api-catalog', `ApiCatalogModule.load()`],
    ['api-explorer', `ApiExplorerModule.init(); ApiExplorerModule.loadSchema()`]
  ];

  for (const [tab, expr] of drivers) {
    const before = captured.length;
    const r = await evaluate(`(function(){ try { AppRouter.navigate(${JSON.stringify(tab)}); ${expr}; return 'ok' } catch(e) { return 'ERR:'+e.message } })()`);
    await sleep(1000);
    const delta = captured.length - before;
    console.log(`  ${tab.padEnd(14)} +${String(delta).padStart(2)} req   ${r === 'ok' ? '' : r}`);
  }

  // Validate every captured document.
  console.log('');
  console.log('  ' + '-'.repeat(58));
  let ok = 0;
  const bad = [];
  for (const req of captured) {
    if (!req.query) continue;
    try { parse(req.query); ok++; }
    catch (e) { bad.push({ msg: e.message.split('\n')[0], doc: req.query.trim().slice(0, 120).replace(/\s+/g, ' ') }); }
  }
  console.log(`  Captured GraphQL docs : ${captured.length}`);
  console.log(`  Parsed OK             : ${ok}`);
  console.log(`  Invalid               : ${bad.length}`);
  if (bad.length) {
    bad.forEach(b => { console.log(`   x ${b.msg}`); console.log(`     ${b.doc}`); });
  }

  // Regression guard for field names that were wrong in v1.
  const suspects = ['currentUser', 'TicketInputMutation', 'PremiumInputMutation', 'family_Id', 'claim_Id', 'content:', 'isResolved'];
  const hits = [];
  for (const req of captured) {
    for (const s of suspects) {
      if (req.query && req.query.includes(s)) hits.push(`${s} :: ${req.query.trim().slice(0, 80).replace(/\s+/g, ' ')}`);
    }
  }
  console.log('');
  if (hits.length) {
    console.log('  REGRESSIONS FOUND:');
    hits.forEach(h => console.log('   x ' + h));
  } else {
    console.log('  No known-bad field names present.');
  }

  console.log('');
  ws.close();
  chrome.kill();
  sandbox.kill();
  mock.close();
  process.exit(bad.length || hits.length ? 1 : 0);
}

main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
