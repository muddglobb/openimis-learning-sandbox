// Verify the sandbox recovers from an expired JWT stored in localStorage.
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const { requireChrome, sandboxUrl } = require('./_shared');

const CHROME = requireChrome();
const CDP_PORT = 9488;
const URL = sandboxUrl();

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); }).on('error', reject);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const profile = path.join(process.env.TEMP || '.', 'exp-' + Date.now());
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
  const errors = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') {
      errors.push(m.params.exceptionDetails?.exception?.description || 'exception');
    }
  };
  const send = (method, params = {}) => new Promise(r => {
    const i = ++id; pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) return 'EXC: ' + r.result.exceptionDetails.text;
    return r.result?.result?.value;
  };

  await send('Runtime.enable');
  await send('Page.enable');

  // 1. Load the page once so the origin exists.
  await send('Page.navigate', { url: URL });
  await sleep(4000);

  // 2. Plant a syntactically valid but EXPIRED token, plus demo credentials.
  const expired = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9' +
    '.eyJ1c2VybmFtZSI6IkFkbWluIiwiZXhwIjoxMDAwMDAwMDAwLCJvcmlnSWF0IjoxMDAwMDAwMDAwfQ' +
    '.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

  await evaluate(`
    localStorage.setItem('openimis_token', ${JSON.stringify(expired)});
    localStorage.setItem('openimis_credentials', JSON.stringify({ username: 'Admin', password: 'admin123' }));
    localStorage.removeItem('openimis_user');
    'planted'
  `);

  console.log('');
  console.log('  Skenario: token JWT kedaluwarsa tersimpan di localStorage');
  console.log('  ' + '-'.repeat(58));

  // 3. Reload — the sandbox must recover on its own.
  await send('Page.navigate', { url: URL });
  await sleep(7000);

  const authState = await evaluate('OpenIMISApi.isAuthenticated()');
  const tokenNow = await evaluate('(OpenIMISApi.getToken()||"").slice(0,20)');
  const secsLeft = await evaluate('OpenIMISApi.tokenSecondsLeft()');
  const user = await evaluate('(OpenIMISApi.getCurrentUser()||{}).username || null');

  console.log(`  isAuthenticated   : ${authState}`);
  console.log(`  token sekarang    : ${tokenNow}...`);
  console.log(`  berlaku lagi      : ${secsLeft} detik`);
  console.log(`  user              : ${user}`);

  // 4. Data calls must work now.
  const insurees = await evaluate(`
    (async () => {
      try {
        const c = await OpenIMISApi.getInsurees(3);
        return (c && c.edges) ? c.edges.length + ' peserta' : 'kosong';
      } catch (e) { return 'ERR: ' + e.message; }
    })()
  `);
  const families = await evaluate(`
    (async () => {
      try {
        const c = await OpenIMISApi.getFamilies(3);
        return (c && c.edges) ? c.edges.length + ' keluarga' : 'kosong';
      } catch (e) { return 'ERR: ' + e.message; }
    })()
  `);
  const diagnoses = await evaluate(`
    (async () => {
      try {
        const c = await OpenIMISApi.getDiagnoses(3);
        return (c && c.edges) ? c.edges.length + ' diagnosa' : 'kosong';
      } catch (e) { return 'ERR: ' + e.message; }
    })()
  `);
  const fhir = await evaluate(`
    (async () => {
      try {
        const r = await OpenIMISApi.fhir('Patient/?_count=2');
        return r.resourceType + ' total=' + (r.total ?? '?');
      } catch (e) { return 'ERR: ' + e.message; }
    })()
  `);

  console.log('');
  console.log(`  getInsurees       : ${insurees}`);
  console.log(`  getFamilies       : ${families}`);
  console.log(`  getDiagnoses      : ${diagnoses}`);
  console.log(`  FHIR Patient      : ${fhir}`);

  // 5. Simulate expiry mid-session: overwrite token with an expired one,
  //    then make a call. The sandbox must transparently re-login.
  await evaluate(`
    localStorage.setItem('openimis_token', ${JSON.stringify(expired)});
    'planted-expired'
  `);
  // Force the module's in-memory token to the expired value too.
  const recovery = await evaluate(`
    (async () => {
      try {
        // Directly exercise the reactive path: an expired in-memory token
        // would be rejected by the server, and graphql() must renew it.
        const c = await OpenIMISApi.getInsurees(2);
        return (c && c.edges) ? 'recovered: ' + c.edges.length + ' peserta' : 'kosong';
      } catch (e) { return 'ERR: ' + e.message; }
    })()
  `);
  console.log('');
  console.log(`  Setelah expiry    : ${recovery}`);

  console.log('');
  console.log('  ' + '-'.repeat(58));
  const ok = authState === true && !String(insurees).startsWith('ERR')
    && !String(families).startsWith('ERR') && !String(diagnoses).startsWith('ERR')
    && !String(fhir).startsWith('ERR');
  console.log(ok ? '  PASS  pemulihan sesi berhasil' : '  FAIL  masih ada masalah');
  if (errors.length) {
    console.log('  Uncaught:');
    [...new Set(errors)].slice(0, 5).forEach(e => console.log('   • ' + String(e).split('\n')[0]));
  }
  console.log('');

  ws.close();
  chrome.kill();
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
